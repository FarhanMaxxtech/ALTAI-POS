// Run with: npm test
// Prices, tax and receipt settings, end to end through the API. Uses the dev database under a
// made-up merchant id unique to this run, and deletes everything it created at the end.
// The team API is replaced by a small fake that only answers the store list (stores 12 and 13).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

const RUN = `P${Date.now().toString(36).toUpperCase()}`;
const OTHER = `${RUN}X`;
const SESSION = 'pricing-test-session';

const fake = express();
fake.use((req, res, next) => (req.get('SESSION') === SESSION ? next() : res.status(440).end()));
fake.get('/rest/Stock/StoreList', (req, res) => res.json({ data: [{ id: 12, name: 'MidValley' }, { id: 13, name: 'Outlet Store' }] }));

let fakeServer, api, db, manager, otherBusiness;

before(async () => {
    fakeServer = fake.listen(0);
    await new Promise((r) => fakeServer.once('listening', r));
    process.env.ALTAI_API_BASE_URL = `http://127.0.0.1:${fakeServer.address().port}/rest`;
    process.env.ALTAI_API_KEY = 'fake-key';
    process.env.AUTH_SECRET = 'test-secret-for-signing-tokens';
    ({ default: db } = await import('../src/db/index.js'));
    api = request((await import('../src/app.js')).default);
    const { encodeToken } = await import('../src/services/integrations/altai-api/token.js');
    const bearer = (merchantId, name) => ({ Authorization: `Bearer ${encodeToken({ session: SESSION, merchantId, loginId: name.toLowerCase(), name })}` });
    manager = bearer(RUN, 'Farid');
    otherBusiness = bearer(OTHER, 'Zed');
});

after(async () => {
    for (const table of ['price_history', 'prices', 'store_settings', 'business_settings']) {
        await db(table).whereIn('merchant_id', [RUN, OTHER]).del();
    }
    await db.destroy();
    fakeServer.close();
});

const put = (path, body) => api.put(`/api/${path}`).set(manager).send(body);
const listAt = async (storeId) => (await api.get('/api/prices').set(manager).query(storeId ? { store_id: storeId } : {}).expect(200)).body.prices;
const historyOf = async (sku) => (await api.get(`/api/prices/${encodeURIComponent(sku)}/history`).set(manager).expect(200)).body.history;

test('business settings: safe defaults until saved (0% SST, prices include tax, cash rounding on)', async () => {
    const res = await api.get('/api/settings/business').set(manager).expect(200);
    assert.deepEqual(
        (({ sst_rate, prices_include_tax, cash_rounding }) => ({ sst_rate, prices_include_tax, cash_rounding }))(res.body.settings),
        { sst_rate: '0.00', prices_include_tax: true, cash_rounding: true },
    );
});

test('business settings: save, and bad tax rates are refused', async () => {
    const res = await put('settings/business', { business_name: 'Altai Apparel Sdn Bhd', sst_rate: '6', sst_reg_no: 'W10-1234-56789012' }).expect(200);
    assert.deepEqual([res.body.settings.business_name, res.body.settings.sst_rate, res.body.settings.updated_by_name], ['Altai Apparel Sdn Bhd', '6.00', 'Farid']);
    // A second save changes only what's sent.
    const again = await put('settings/business', { prices_include_tax: false }).expect(200);
    assert.deepEqual([again.body.settings.sst_rate, again.body.settings.prices_include_tax], ['6.00', false]);
    await put('settings/business', { prices_include_tax: true }).expect(200);

    await put('settings/business', { sst_rate: '101' }).expect(400);
    await put('settings/business', { sst_rate: '6.255' }).expect(400);
    await put('settings/business', { sst_rate: -1 }).expect(400);
});

test('store settings: receipt details per store; only stores you can access', async () => {
    const empty = await api.get('/api/settings/stores/13').set(manager).expect(200);
    assert.equal(empty.body.settings.store_name, 'Outlet Store');
    assert.equal(empty.body.settings.address, null);

    const res = await put('settings/stores/13', { address: 'Lot 1, Jalan Outlet, 47000 Sungai Buloh', receipt_footer: 'Exchange within 7 days with receipt.' }).expect(200);
    assert.equal(res.body.settings.receipt_footer, 'Exchange within 7 days with receipt.');
    await put('settings/stores/99', { phone: '03-1234 5678' }).expect(403);
});

test('default price; the same price typed differently is not a "change"', async () => {
    const res = await put('prices/CT-BLK-M', { price: '49.90', product_name: 'Classic Tee Black M', reason: 'New season' }).expect(200);
    assert.deepEqual([res.body.price.default_price, res.body.price.product_name], ['49.90', 'Classic Tee Black M']);

    await put('prices/CT-BLK-M', { price: 49.9 }).expect(200);
    assert.equal((await historyOf('CT-BLK-M')).length, 1, '49.9 = 49.90: no extra history entry');

    await put('prices/CT-BLK-M', { price: '45', reason: 'Price drop' }).expect(200);
    const history = await historyOf('CT-BLK-M');
    assert.deepEqual(history.map((h) => [h.old_price, h.new_price, h.reason, h.changed_by_name]), [
        ['49.90', '45.00', 'Price drop', 'Farid'],
        [null, '49.90', 'New season', 'Farid'],
    ]);
});

test('a store price overrides the default in that store only', async () => {
    await put('prices/CT-BLK-M', { price: '39.90', store_id: '13', reason: 'Outlet price' }).expect(200);

    const outlet = (await listAt('13')).find((p) => p.sku === 'CT-BLK-M');
    assert.deepEqual([outlet.default_price, outlet.store_price, outlet.effective_price], ['45.00', '39.90', '39.90']);
    const midValley = (await listAt('12')).find((p) => p.sku === 'CT-BLK-M');
    assert.deepEqual([midValley.store_price, midValley.effective_price], [null, '45.00']);
    const all = (await listAt()).find((p) => p.sku === 'CT-BLK-M');
    assert.equal(all.store_price_count, 1);

    await put('prices/CT-BLK-M', { price: '10', store_id: '99' }).expect(403);
});

test('resolve (for the till): price per SKU in a store, plus the tax rules', async () => {
    const res = await api.post('/api/prices/resolve').set(manager).send({ skus: ['CT-BLK-M', 'NO-PRICE-SKU'], store_id: '13' }).expect(200);
    assert.deepEqual(res.body.prices['CT-BLK-M'], { price: '39.90', source: 'store', product_name: 'Classic Tee Black M' });
    assert.deepEqual(res.body.prices['NO-PRICE-SKU'], { price: null, source: null, product_name: null });
    assert.deepEqual(res.body.tax, { sst_rate: '6.00', prices_include_tax: true, cash_rounding: true });

    const mv = await api.post('/api/prices/resolve').set(manager).send({ skus: ['CT-BLK-M'], store_id: '12' }).expect(200);
    assert.equal(mv.body.prices['CT-BLK-M'].source, 'default');
});

test('removing the store price falls back to the default, and is recorded', async () => {
    await api.delete('/api/prices/CT-BLK-M').set(manager).query({ store_id: '13' }).expect(200);
    const outlet = (await listAt('13')).find((p) => p.sku === 'CT-BLK-M');
    assert.deepEqual([outlet.store_price, outlet.effective_price], [null, '45.00']);
    const last = (await historyOf('CT-BLK-M'))[0];
    assert.deepEqual([last.store_id, last.old_price, last.new_price], ['13', '39.90', null]);
    await api.delete('/api/prices/CT-BLK-M').set(manager).query({ store_id: '13' }).expect(404);
});

test('bulk: one price for every size of a style, all or nothing', async () => {
    const skus = ['LS-NVY-S', 'LS-NVY-M', 'LS-NVY-L'];
    const res = await api.post('/api/prices/bulk').set(manager).send({ skus, price: '89.00', reason: 'Linen shirt launch' }).expect(200);
    assert.equal(res.body.updated, 3);
    const list = await listAt();
    assert.deepEqual(skus.map((s) => list.find((p) => p.sku === s)?.default_price), ['89.00', '89.00', '89.00']);

    await api.post('/api/prices/bulk').set(manager).send({ skus: ['A1', 'A1'], price: '1' }).expect(400);
    await api.post('/api/prices/bulk').set(manager).send({ skus: ['A1'], price: '1', store_id: '99' }).expect(403);
});

test('search by SKU or name; bad input refused', async () => {
    const byName = (await api.get('/api/prices').set(manager).query({ q: 'classic tee' }).expect(200)).body.prices;
    assert.deepEqual(byName.map((p) => p.sku), ['CT-BLK-M']);
    const bySku = (await api.get('/api/prices').set(manager).query({ q: 'ls-nvy' }).expect(200)).body.prices;
    assert.equal(bySku.length, 3);

    await put('prices/X1', { price: '-5' }).expect(400);
    await put('prices/X1', { price: '1.005' }).expect(400);
    await put(`prices/${encodeURIComponent('HAS SPACE')}`, { price: '1' }).expect(400);
});

test("another business sees none of it; no token → 401", async () => {
    const theirs = (await api.get('/api/prices').set(otherBusiness).expect(200)).body.prices;
    assert.equal(theirs.length, 0);
    const theirSettings = (await api.get('/api/settings/business').set(otherBusiness).expect(200)).body.settings;
    assert.equal(theirSettings.sst_rate, '0.00');
    await api.get('/api/prices').expect(401);
    await api.get('/api/settings/business').expect(401);
});
