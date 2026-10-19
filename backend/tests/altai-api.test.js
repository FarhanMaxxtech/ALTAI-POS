// Run with: npm test
// Tests the adapter against a FAKE copy of the team's API started inside this test.
// It never calls the real altairfid server, and needs no real key or password.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

// ---------- fake upstream (behaves like the real API as seen in rfid_counter) ----------

const FAKE_KEY = 'fake-test-key';
const FAKE_SESSION = 'fake-session-1';
const calls = [];
let inFlight = 0;
let maxInFlight = 0;

const fake = express();
fake.use(express.json());
fake.use((req, res, next) => {
    calls.push({ path: req.path, apikey: req.get('APIKEY'), merchant: req.get('MERCHANTID'), session: req.get('SESSION') });
    if (req.get('APIKEY') !== FAKE_KEY) return res.status(403).json({ error: 'bad key' });
    if (req.path !== '/rest/Merchant/Login' && req.get('SESSION') !== FAKE_SESSION) return res.status(440).end();
    next();
});
fake.post('/rest/Merchant/Login', (req, res) => {
    if (req.body.loginId === 'cashier1' && req.body.password === 'test-pass') {
        return res.set('session', FAKE_SESSION).json({ ok: true });
    }
    res.status(401).json({ error: 'Invalid' });
});
fake.get('/rest/Stock/StoreList', (req, res) => res.json({ data: [{ id: 12, name: 'MidValley' }, { id: 13, name: 'Pavilion' }] }));
fake.post('/rest/Stock/TagLookup', async (req, res) => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, req.body.epc.startsWith('DEAD') ? 1500 : 30)); // DEAD… = too slow
    inFlight--;
    if (req.body.epc.startsWith('0000')) return res.json({ error: 'Tag not found' }); // still HTTP 200!
    res.json({
        productName: 'Classic Tee', sku: 'CT-BLK-M', productCode: 'CT', varLabel: 'Black / M',
        varDetails: [{ typeName: 'Colour', value: 'Black' }], storeId: 12, storeName: 'MidValley',
    });
});
fake.get('/rest/Stock/SkuBalance', (req, res) => {
    if (req.query.sku === 'NOPE') return res.json({ error: 'SKU not found' });
    res.json({ balance: 3, sku: req.query.sku, storeId: req.query.storeId, storeName: 'MidValley' });
});

// ---------- start fake, point our config at it, then load our app ----------

let fakeServer, api, config, db;
const auth = { Authorization: `Bearer ${FAKE_SESSION}` };

before(async () => {
    fakeServer = fake.listen(0);
    await new Promise((r) => fakeServer.once('listening', r));
    process.env.ALTAI_API_BASE_URL = `http://127.0.0.1:${fakeServer.address().port}/rest`;
    process.env.ALTAI_API_KEY = FAKE_KEY;
    process.env.ALTAI_MERCHANT_ID = '7';
    process.env.ALTAI_API_TIMEOUT_MS = '500';
    // Imported only now, so config reads the env vars above (dotenv never overrides set vars).
    ({ default: config } = await import('../src/config/index.js'));
    ({ default: db } = await import('../src/db/index.js'));
    api = request((await import('../src/app.js')).default);
});

after(async () => {
    await db.destroy();
    fakeServer.close();
});

// ---------- tests ----------

test('login returns the session token from the response header', async () => {
    const res = await api.post('/api/auth/login').send({ login_id: 'cashier1', password: 'test-pass' }).expect(200);
    assert.equal(res.body.token, FAKE_SESSION);

    const sent = calls.findLast((c) => c.path === '/rest/Merchant/Login');
    assert.equal(sent.apikey, FAKE_KEY, 'API key sent to the team API');
    assert.equal(sent.merchant, '7', 'merchant id from .env');
});

test('wrong password → 401, and the API key never appears in our responses', async () => {
    const res = await api.post('/api/auth/login').send({ login_id: 'cashier1', password: 'wrong' }).expect(401);
    assert.equal(res.body.error, 'Invalid login ID or password');
    assert.ok(!JSON.stringify(res.body).includes(FAKE_KEY));
});

test('protected routes need a token; an expired session (440) becomes 401 SESSION_EXPIRED', async () => {
    await api.get('/api/stores').expect(401);
    const res = await api.get('/api/stores').set({ Authorization: 'Bearer old-session' }).expect(401);
    assert.equal(res.body.details[0].code, 'SESSION_EXPIRED');
});

test('store list is mapped to { id, name }', async () => {
    const res = await api.get('/api/stores').set(auth).expect(200);
    assert.deepEqual(res.body.stores.map(({ id, name }) => ({ id, name })), [
        { id: '12', name: 'MidValley' }, { id: '13', name: 'Pavilion' },
    ]);
});

test('tag lookup: batch of EPCs → found / unknown / failed, max 5 in parallel', async () => {
    const known = Array.from({ length: 12 }, (_, i) => `E28011${String(i).padStart(4, '0')}`);
    const unknown = '0000AAAA';
    const slow = 'DEADBEEF';
    maxInFlight = 0;

    const res = await api.post('/api/tags/lookup').set(auth)
        .send({ epcs: [...known.map((e) => e.toLowerCase()), unknown, slow], store_id: '12' }).expect(200);

    assert.equal(res.body.tags.length, 12);
    assert.deepEqual(res.body.tags[0], {
        epc: known[0], sku: 'CT-BLK-M', product_name: 'Classic Tee', product_code: 'CT', variation: 'Black / M',
        variation_details: [{ typeName: 'Colour', value: 'Black' }], store_id: '12', store_name: 'MidValley',
        pending_transaction: false,
    });
    assert.deepEqual(res.body.unknown, [unknown], '200 + { error } is treated as "not found"');
    assert.equal(res.body.failed.length, 1, 'the slow tag timed out, the rest still came back');
    assert.equal(res.body.failed[0].epc, slow);
    assert.ok(maxInFlight <= 5, `never more than 5 lookups at once (saw ${maxInFlight})`);
});

test('SKU balance; unknown SKU → 404', async () => {
    const res = await api.get('/api/stock/balance').set(auth).query({ sku: 'CT-BLK-M', store_id: '12' }).expect(200);
    assert.equal(res.body.balance, 3);
    assert.equal(res.body.store_name, 'MidValley');
    await api.get('/api/stock/balance').set(auth).query({ sku: 'NOPE', store_id: '12' }).expect(404);
});

test('missing API key → 503 instead of calling the team API', async () => {
    const saved = config.altaiApi.apiKey;
    config.altaiApi.apiKey = null;
    try {
        const before = calls.length;
        const res = await api.get('/api/stores').set(auth).expect(503);
        assert.match(res.body.error, /ALTAI_API_KEY/);
        assert.equal(calls.length, before, 'no request was sent');
    } finally {
        config.altaiApi.apiKey = saved;
    }
});

test('team API down → 502', async () => {
    const saved = config.altaiApi.baseUrl;
    config.altaiApi.baseUrl = 'http://127.0.0.1:9/rest'; // nothing listens on port 9
    try {
        await api.get('/api/stores').set(auth).expect(502);
    } finally {
        config.altaiApi.baseUrl = saved;
    }
});
