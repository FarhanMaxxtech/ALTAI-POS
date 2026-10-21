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
const BADGE_EPC = 'E2BADAE001';
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
        return res.set('session', FAKE_SESSION).json({ name: 'Aina', merchantId: 42 });
    }
    if (req.body.epc === BADGE_EPC) {
        return res.set('session', FAKE_SESSION).json({ name: 'Badge User', merchantId: 42 });
    }
    // Like the real API: a failed login is still HTTP 200, with the error in the body.
    res.json({ error: { message: 'Invalid credentials' } });
});
fake.get('/rest/Merchant/AccessControl', (req, res) => res.json({ data: [{ id: 602130, name: 'Stock Transfer' }, { id: '450', name: 'Tags' }, { name: 'no id' }] }));
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

let fakeServer, api, config, db, encodeToken, decodeToken, auth;


before(async () => {
    fakeServer = fake.listen(0);
    await new Promise((r) => fakeServer.once('listening', r));
    process.env.ALTAI_API_BASE_URL = `http://127.0.0.1:${fakeServer.address().port}/rest`;
    process.env.ALTAI_API_KEY = FAKE_KEY;
    process.env.ALTAI_MERCHANT_ID = '7';
    process.env.ALTAI_API_TIMEOUT_MS = '500';
    process.env.AUTH_SECRET = 'test-secret-for-signing-tokens';
    // Imported only now, so config reads the env vars above (dotenv never overrides set vars).
    ({ default: config } = await import('../src/config/index.js'));
    ({ default: db } = await import('../src/db/index.js'));
    api = request((await import('../src/app.js')).default);
    ({ encodeToken, decodeToken } = await import('../src/services/integrations/altai-api/token.js'));
    // A valid token, like the one our login returns: session + the merchant id from the login
    // response (42, not .env's 7), signed with the test secret.
    auth = { Authorization: `Bearer ${encodeToken({ session: FAKE_SESSION, merchantId: '42', loginId: 'cashier1', name: 'Aina' })}` };
});

after(async () => {
    await db.destroy();
    fakeServer.close();
});

// ---------- tests ----------

test('login: token carries the session header + merchant id from the response; user name returned', async () => {
    const res = await api.post('/api/auth/login').send({ login_id: 'cashier1', password: 'test-pass' }).expect(200);
    assert.deepEqual(decodeToken(res.body.token), { session: FAKE_SESSION, merchantId: '42', loginId: 'cashier1', name: 'Aina' });
    assert.deepEqual(res.body.user, { name: 'Aina', login_id: 'cashier1', merchant_id: '42' });

    const sent = calls.findLast((c) => c.path === '/rest/Merchant/Login');
    assert.equal(sent.apikey, FAKE_KEY, 'API key sent to the team API');
    assert.equal(sent.merchant, '7', 'before login we only know the default merchant from .env');
});

test('later calls use the merchant id from login, not the .env default', async () => {
    await api.get('/api/stores').set(auth).expect(200);
    assert.equal(calls.findLast((c) => c.path === '/rest/Stock/StoreList').merchant, '42');
});

test('badge login with an EPC', async () => {
    const res = await api.post('/api/auth/login').send({ epc: BADGE_EPC.toLowerCase() }).expect(200);
    assert.equal(res.body.user.name, 'Badge User');
    await api.post('/api/auth/login').send({ epc: 'E2FFFFFF99' }).expect(401);
});

test('wrong password (HTTP 200 + error body upstream) → 401, API key never leaks', async () => {
    const res = await api.post('/api/auth/login').send({ login_id: 'cashier1', password: 'wrong' }).expect(401);
    assert.equal(res.body.error, 'Invalid login ID or password');
    assert.ok(!JSON.stringify(res.body).includes(FAKE_KEY));
});

test('login validation: empty fields, or password and badge mixed → 400', async () => {
    await api.post('/api/auth/login').send({ login_id: '', password: '' }).expect(400);
    await api.post('/api/auth/login').send({ login_id: 'a', password: 'b', epc: BADGE_EPC }).expect(400);
});

test('protected routes: no token / garbage token / expired session → 401', async () => {
    await api.get('/api/stores').expect(401);
    await api.get('/api/stores').set({ Authorization: 'Bearer not-a-real-token' }).expect(401);
    const expired = encodeToken({ session: 'old-session', merchantId: '42' });
    const res = await api.get('/api/stores').set({ Authorization: `Bearer ${expired}` }).expect(401);
    assert.equal(res.body.details[0].code, 'SESSION_EXPIRED');
});

test('signed token: edited contents are rejected without calling the team API', async () => {
    const [payloadPart, signature] = auth.Authorization.slice('Bearer '.length).split('.');
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString());
    // Try to become someone else, keeping the old signature.
    const forgedPart = Buffer.from(JSON.stringify({ ...payload, n: 'The Boss', m: '99' })).toString('base64url');
    const before = calls.length;
    await api.get('/api/stores').set({ Authorization: `Bearer ${forgedPart}.${signature}` }).expect(401);
    assert.equal(calls.length, before, 'rejected by us, the team API was never asked');
});

test('signed token: an expired token is rejected', async () => {
    const savedHours = config.auth.tokenHours;
    config.auth.tokenHours = -1; // a token that expired an hour ago
    try {
        const old = encodeToken({ session: FAKE_SESSION, merchantId: '42', name: 'Aina' });
        await api.get('/api/stores').set({ Authorization: `Bearer ${old}` }).expect(401);
    } finally {
        config.auth.tokenHours = savedHours;
    }
});

test('/auth/me returns merchant and permission ids', async () => {
    const res = await api.get('/api/auth/me').set(auth).expect(200);
    assert.deepEqual(res.body, { ok: true, merchant_id: '42', permissions: [{ id: 602130, name: 'Stock Transfer' }, { id: 450, name: 'Tags' }] });
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
        pending_transaction: false, pending_transaction_id: null,
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
