// Run with: npm test
// The team's product catalogue (read-only), against a FAKE copy of the team's API (never the real one).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

const SESSION = 'products-test-session';
const calls = [];

// One product in the documented shape (docs/api/team-api-reference.md): 2 SKUs, prices as plain numbers.
const tee = {
    productId: 301, productCode: 'CT', productName: 'Classic Tee', description: 'Cotton', active: 'Y', images: [], skuCount: 2,
    skus: [
        { skuId: 9001, sku: 'CT-BLK-M', active: 'Y', price: 49.9, cost: 18, balance: 7, stockWarn: 2, remark: '', images: [],
            variationName: 'Black / M', variations: [{ type: 'Colour', value: 'Black' }, { type: 'Size', value: 'M' }] },
        { skuId: 9002, sku: 'CT-BLK-L', active: 'N', price: 849, cost: null, balance: null, stockWarn: null, images: [],
            variationName: 'Black / L', variations: [] },
    ],
};

const fake = express();
fake.use(express.json());
fake.use((req, res, next) => {
    calls.push({ path: req.path, query: req.query, body: req.body });
    return req.get('SESSION') === SESSION ? next() : res.status(440).end();
});
fake.get('/rest/Stock/StoreList', (req, res) => res.json({ data: [{ id: 12, name: 'MidValley' }] }));
fake.post('/rest/Product/List', (req, res) => res.json({ data: req.body.includeSkus === 'N' ? [{ ...tee, skus: undefined }] : [tee] }));
fake.get('/rest/Product/Info', (req, res) => (req.query.productId === '301'
    ? res.json({ data: tee })
    : res.json({ error: 'Product not found' })));

let fakeServer, api, db, auth;

before(async () => {
    fakeServer = fake.listen(0);
    await new Promise((r) => fakeServer.once('listening', r));
    process.env.ALTAI_API_BASE_URL = `http://127.0.0.1:${fakeServer.address().port}/rest`;
    process.env.ALTAI_API_KEY = 'fake-key';
    process.env.AUTH_SECRET = 'test-secret-for-signing-tokens';
    ({ default: db } = await import('../src/db/index.js'));
    api = request((await import('../src/app.js')).default);
    const { encodeToken } = await import('../src/services/integrations/altai-api/token.js');
    auth = { Authorization: `Bearer ${encodeToken({ session: SESSION, merchantId: '7', loginId: 'aina', name: 'Aina' })}` };
});

after(async () => {
    await db.destroy();
    fakeServer.close();
});

const lastList = () => calls.findLast((c) => c.path === '/rest/Product/List');

test('product list: filters passed on, prices become money strings, SKUs mapped', async () => {
    const res = await api.get('/api/catalog/products').set(auth).query({ q: 'tee', store_id: '12', page: '2', page_size: '50' }).expect(200);
    assert.deepEqual(lastList().body, { code: '', name: 'tee', sku: '', active: '', storeId: '12', includeSkus: 'Y', page: 2, pageSize: 50 });

    const p = res.body.products[0];
    assert.deepEqual([res.body.page, res.body.page_size, p.product_id, p.product_name, p.active, p.sku_count], [2, 50, '301', 'Classic Tee', true, 2]);
    assert.deepEqual(p.skus[0], {
        sku_id: '9001', sku: 'CT-BLK-M', active: true, price: '49.90', cost: '18.00', balance: 7, stock_warn: 2,
        variation: 'Black / M', variations: [{ type: 'Colour', value: 'Black' }, { type: 'Size', value: 'M' }], images: [], remark: '',
    });
    assert.deepEqual([p.skus[1].price, p.skus[1].cost, p.skus[1].balance, p.skus[1].active], ['849.00', null, null, false]);
});

test('product list: products only; defaults', async () => {
    const res = await api.get('/api/catalog/products').set(auth).query({ skus: '0' }).expect(200);
    assert.deepEqual([lastList().body.includeSkus, lastList().body.page, lastList().body.pageSize], ['N', 1, 20]);
    assert.deepEqual(res.body.products[0].skus, []);
});

test('product detail; unknown product → 404', async () => {
    const res = await api.get('/api/catalog/products/301').set(auth).query({ store_id: '12' }).expect(200);
    assert.equal(calls.findLast((c) => c.path === '/rest/Product/Info').query.storeId, '12');
    assert.equal(res.body.product.skus.length, 2);
    await api.get('/api/catalog/products/999').set(auth).expect(404);
});

test('refused: page size over 100, bad id, store without access, no token', async () => {
    await api.get('/api/catalog/products').set(auth).query({ page_size: '101' }).expect(400);
    await api.get('/api/catalog/products/abc').set(auth).expect(400);
    await api.get('/api/catalog/products').set(auth).query({ store_id: '99' }).expect(403);
    await api.get('/api/catalog/products').expect(401);
});
