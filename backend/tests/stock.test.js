// Run with: npm test
// Read-only inventory views, against a FAKE copy of the team's API (never the real one).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

const SESSION = 'stock-test-session';
const calls = [];

// Store 12: 450 tags over 3 SKUs (3 pages of 200/200/50). Store 13: empty.
// Store 14: claims 20,000 tags (more than we fetch) to test the "incomplete" flag.
const skus = [
    { sku: 'CT-BLK-M', productName: 'Classic Tee', productCode: 'CT', varLabel: 'Black / M' },
    { sku: 'CT-BLK-L', productName: 'Classic Tee', productCode: 'CT', varLabel: 'Black / L' },
    { sku: 'LS-NVY-S', productName: 'Linen Shirt', productCode: 'LS', varLabel: 'Navy / S' },
];
const store12 = Array.from({ length: 450 }, (_, i) => ({
    epc: `e2801160${String(i).padStart(8, '0')}`, ...skus[i % 3],
    status: i % 10 === 0 ? 'SOLD' : 'IN', storeId: 12, storeName: 'MidValley', merchantId: 7,
}));

const fake = express();
fake.use(express.json());
fake.use((req, res, next) => {
    calls.push({ path: req.path, query: req.query, body: req.body });
    return req.get('SESSION') === SESSION ? next() : res.status(440).end();
});
fake.get('/rest/Stock/StoreList', (req, res) => res.json({ data: [{ id: 12, name: 'MidValley' }, { id: 13, name: 'Pavilion' }, { id: 14, name: 'Mega Warehouse' }] }));
fake.post('/rest/Stock/EpcList', (req, res) => {
    const { storeId, page, pageSize, epc } = req.body;
    if (epc) { // filtered by EPC (partial match, like a search)
        const rows = store12.filter((t) => storeId === '12' && t.epc.toUpperCase().includes(epc.toUpperCase()));
        return res.json({ recordsTotal: rows.length, data: rows.slice(0, pageSize) });
    }
    if (storeId === '14') {
        return res.json({ recordsTotal: 20000, data: Array.from({ length: pageSize }, (_, i) => ({ epc: `AA${page}${i}`, sku: 'BULK', status: 'IN', storeId: 14 })) });
    }
    const all = storeId === '12' ? store12 : [];
    res.json({ recordsTotal: all.length, data: all.slice((page - 1) * pageSize, page * pageSize) });
});
fake.post('/rest/Stock/TagLookup', (req, res) => {
    const tag = store12.find((t) => t.epc.toUpperCase() === req.body.epc);
    if (!tag) return res.json({ error: { message: 'Tag not found' } });
    const pending = tag.epc.endsWith('01');
    res.json({ productName: tag.productName, sku: tag.sku, productCode: tag.productCode, varLabel: tag.varLabel,
        varDetails: [], storeId: 12, storeName: 'MidValley', isPendingTransaction: pending, ...(pending ? { pendingTrxId: 'TRF-0042' } : {}) });
});
fake.get('/rest/Stock/TransferList', (req, res) => res.json({ data: [
    { trxId: 'TR-1', trxDate: '2026-10-20', status: 'pending', fromStoreName: 'MidValley', toStoreName: 'Pavilion', totalQty: 5, remark: 'Restock' },
] }));
fake.get('/rest/Stock/TransferInfo', (req, res) => (req.query.id === 'TR-1'
    ? res.json({ data: { trxId: 'TR-1', status: 'pending', fromStoreName: 'MidValley', toStoreName: 'Pavilion',
        items: [{ epc: 'E1', sku: 'CT-BLK-M', productName: 'Classic Tee', varLabel: 'Black / M' }, { epc: 'E2', sku: 'CT-BLK-M', productName: 'Classic Tee', varLabel: 'Black / M' }] } })
    : res.json({ error: { message: 'Transaction not found' } })));
fake.get('/rest/Stock/StockCountList', (req, res) => res.json({ data: [{ id: 41, date: '2026-10-19', status: 'approved', storeName: 'MidValley', epcs: ['E1', 'E2', 'E3'] }] }));
fake.get('/rest/Stock/StockCountInfo', (req, res) => res.json({ id: 41, status: 'approved', epcs: ['E1', 'E2', 'E3'] }));
fake.get('/rest/Stock/AdjustmentList', (req, res) => res.json({ list: [{ id: 7, trxType: 'damaged', status: 'void', qty: '2' }] }));

let fakeServer, api, db, stock, auth;

before(async () => {
    fakeServer = fake.listen(0);
    await new Promise((r) => fakeServer.once('listening', r));
    process.env.ALTAI_API_BASE_URL = `http://127.0.0.1:${fakeServer.address().port}/rest`;
    process.env.ALTAI_API_KEY = 'fake-key';
    process.env.AUTH_SECRET = 'test-secret-for-signing-tokens';
    ({ default: db } = await import('../src/db/index.js'));
    api = request((await import('../src/app.js')).default);
    stock = await import('../src/services/integrations/altai-api/stock.js');
    const { encodeToken } = await import('../src/services/integrations/altai-api/token.js');
    auth = { Authorization: `Bearer ${encodeToken({ session: SESSION, merchantId: '7', loginId: 'aina', name: 'Aina' })}` };
});

after(async () => {
    await db.destroy();
    fakeServer.close();
});

const epcListCalls = () => calls.filter((c) => c.path === '/rest/Stock/EpcList').length;

test('stock levels: all pages fetched, counted per SKU, split by status', async () => {
    stock.clearStockCache();
    const before = epcListCalls();
    const res = await api.get('/api/stock/levels').set(auth).query({ store_id: '12' }).expect(200);
    assert.equal(epcListCalls() - before, 3, '450 tags = 3 pages of 200');
    const b = res.body;
    assert.deepEqual([b.tag_count, b.reported_total, b.complete, b.from_cache], [450, 450, true, false]);
    assert.deepEqual(b.statuses, ['IN', 'SOLD']);
    const blackM = b.skus.find((s) => s.sku === 'CT-BLK-M');
    assert.deepEqual([blackM.total, blackM.by_status, blackM.variation], [150, { IN: 135, SOLD: 15 }, 'Black / M']);
    assert.deepEqual(b.skus.map((s) => s.sku), ['CT-BLK-L', 'CT-BLK-M', 'LS-NVY-S'], 'sorted by product, then SKU');
});

test('stock levels: re-used for 60 s, "refresh" fetches again; search filters', async () => {
    const before = epcListCalls();
    const cached = await api.get('/api/stock/levels').set(auth).query({ store_id: '12', q: 'linen' }).expect(200);
    assert.equal(epcListCalls(), before, 'no new calls to the team API');
    assert.equal(cached.body.from_cache, true);
    assert.deepEqual(cached.body.skus.map((s) => s.sku), ['LS-NVY-S']);

    await api.get('/api/stock/levels').set(auth).query({ store_id: '12', refresh: '1' }).expect(200);
    assert.equal(epcListCalls() - before, 3);
});

test('the tags of one SKU', async () => {
    const res = await api.get('/api/stock/tags').set(auth).query({ store_id: '12', sku: 'LS-NVY-S' }).expect(200);
    assert.equal(res.body.tags.length, 150);
    assert.match(res.body.tags[0].epc, /^E2801160/, 'EPCs upper-case');
});

test('an empty store, and a store too big to fetch completely', async () => {
    const empty = await api.get('/api/stock/levels').set(auth).query({ store_id: '13' }).expect(200);
    assert.deepEqual([empty.body.tag_count, empty.body.skus.length, empty.body.complete], [0, 0, true]);

    const big = await api.get('/api/stock/levels').set(auth).query({ store_id: '14' }).expect(200);
    assert.deepEqual([big.body.tag_count, big.body.reported_total, big.body.complete], [10000, 20000, false]);
});

test('transfers: filters passed on (default last 30 days), fields mapped, original kept', async () => {
    const res = await api.get('/api/stock/transfers').set(auth).query({ store_id: '12', to: '2026-10-21' }).expect(200);
    const sent = calls.findLast((c) => c.path === '/rest/Stock/TransferList');
    // { ...x }: Express 5 builds query objects without a prototype; copy it into a plain object to compare.
    assert.deepEqual({ ...sent.query }, { fromStoreId: '12', dateFrom: '2026-09-21', dateTo: '2026-10-21' });

    const t = res.body.transactions[0];
    assert.deepEqual(
        (({ id, date, status, store_name, to_store_name, quantity, remark }) => ({ id, date, status, store_name, to_store_name, quantity, remark }))(t),
        { id: 'TR-1', date: '2026-10-20', status: 'pending', store_name: 'MidValley', to_store_name: 'Pavilion', quantity: 5, remark: 'Restock' },
    );
    assert.equal(t.raw.trxId, 'TR-1');
});

test('transfer detail with lines; unknown id → 404', async () => {
    const res = await api.get('/api/stock/transfers/TR-1').set(auth).expect(200);
    assert.equal(res.body.transaction.lines.length, 2);
    assert.deepEqual(res.body.transaction.lines[0], { epc: 'E1', sku: 'CT-BLK-M', product_name: 'Classic Tee', variation: 'Black / M', quantity: 1, status: null });
    await api.get('/api/stock/transfers/NOPE').set(auth).expect(404);
});

test('stock counts and adjustments: other names for the same things', async () => {
    const counts = await api.get('/api/stock/counts').set(auth).query({ store_id: '12', status: 'approved' }).expect(200);
    assert.deepEqual(calls.findLast((c) => c.path === '/rest/Stock/StockCountList').query.storeId, '12');
    assert.deepEqual([counts.body.transactions[0].id, counts.body.transactions[0].quantity], ['41', 3], 'quantity from the EPC list');

    const detail = await api.get('/api/stock/counts/41').set(auth).expect(200);
    assert.deepEqual(detail.body.transaction.lines.map((l) => l.epc), ['E1', 'E2', 'E3'], 'plain EPC strings become lines');

    const adj = await api.get('/api/stock/adjustments').set(auth).query({ store_id: '12' }).expect(200);
    assert.deepEqual([adj.body.transactions[0].type, adj.body.transactions[0].status, adj.body.transactions[0].quantity], ['damaged', 'void', 2]);
});

test('tag inspector: what, where, status there, pending transaction; order kept; unknown flagged', async () => {
    const sold = store12[0].epc.toUpperCase();     // i = 0 → SOLD
    const pending = store12[1].epc.toUpperCase();  // ends in 01 → in a pending transfer
    const unknown = '0000AAAA1111';
    const res = await api.post('/api/tags/inspect').set(auth).send({ epcs: [pending, unknown, sold.toLowerCase()] }).expect(200);
    const [a, b, c] = res.body.tags;

    assert.deepEqual(
        (({ epc, found, sku, store_name, status, pending_transaction, pending_transaction_id }) => ({ epc, found, sku, store_name, status, pending_transaction, pending_transaction_id }))(a),
        { epc: pending, found: true, sku: 'CT-BLK-L', store_name: 'MidValley', status: 'IN', pending_transaction: true, pending_transaction_id: 'TRF-0042' },
    );
    assert.deepEqual(b, { epc: unknown, found: false });
    assert.deepEqual([c.epc, c.status, c.pending_transaction], [sold, 'SOLD', false]);

    const statusCalls = calls.filter((x) => x.path === '/rest/Stock/EpcList' && x.body?.epc);
    assert.ok(statusCalls.length >= 2 && statusCalls.every((x) => x.body.pageSize === 10), 'small targeted status queries, not the whole store');
});

test('tag inspector: limits', async () => {
    const many = Array.from({ length: 51 }, (_, i) => `E280${String(i).padStart(8, '0')}`);
    await api.post('/api/tags/inspect').set(auth).send({ epcs: many }).expect(400);
    await api.post('/api/tags/inspect').set(auth).send({ epcs: ['E2801160AA', 'e2801160aa'] }).expect(400);
});

test("search a store's tags by part of an EPC, SKU or product", async () => {
    const byProduct = await api.get('/api/stock/tags').set(auth).query({ store_id: '12', q: 'linen' }).expect(200);
    assert.deepEqual([byProduct.body.total, byProduct.body.tags.length], [150, 150]);
    const byEpc = await api.get('/api/stock/tags').set(auth).query({ store_id: '12', q: '00000449' }).expect(200);
    assert.deepEqual(byEpc.body.tags.map((t) => t.epc), ['E280116000000449']);

    await api.get('/api/stock/tags').set(auth).query({ store_id: '12', q: 'x' }).expect(400);
    await api.get('/api/stock/tags').set(auth).query({ store_id: '12', q: 'linen', sku: 'LS-NVY-S' }).expect(400);
    await api.get('/api/stock/tags').set(auth).query({ store_id: '12' }).expect(400);
});

test('refused: bad dates, too long a range, unknown kind, store without access, no token', async () => {
    await api.get('/api/stock/transfers').set(auth).query({ store_id: '12', from: '2026-10-21', to: '2026-10-01' }).expect(400);
    await api.get('/api/stock/transfers').set(auth).query({ store_id: '12', from: '2026-01-01', to: '2026-10-01' }).expect(400);
    await api.get('/api/stock/sales').set(auth).query({ store_id: '12' }).expect(400);
    await api.get('/api/stock/levels').set(auth).query({ store_id: '99' }).expect(403);
    await api.get('/api/stock/levels').query({ store_id: '12' }).expect(401);
});
