// Run with: npm test
// Shifts & cash, end to end through the API. Uses the dev database, under a made-up merchant id
// that's unique to this run, and deletes everything it created at the end.
// The team API is replaced by a small fake that only answers the store list.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

const RUN = `S${Date.now().toString(36).toUpperCase()}`; // this run's merchant id
const OTHER = `${RUN}X`;                                  // a second business, for isolation tests
const SESSION = 'shift-test-session';

const fake = express();
fake.use((req, res, next) => (req.get('SESSION') === SESSION ? next() : res.status(440).end()));
fake.get('/rest/Stock/StoreList', (req, res) => res.json({ data: [{ id: 12, name: 'MidValley' }, { id: 13, name: 'Pavilion' }] }));

let fakeServer, api, db, cashier, manager, otherBusiness;

before(async () => {
    fakeServer = fake.listen(0);
    await new Promise((r) => fakeServer.once('listening', r));
    process.env.ALTAI_API_BASE_URL = `http://127.0.0.1:${fakeServer.address().port}/rest`;
    process.env.ALTAI_API_KEY = 'fake-key';
    process.env.AUTH_SECRET = 'test-secret-for-signing-tokens';
    ({ default: db } = await import('../src/db/index.js'));
    api = request((await import('../src/app.js')).default);
    const { encodeToken } = await import('../src/services/integrations/altai-api/token.js');
    const bearer = (merchantId, loginId, name) =>
        ({ Authorization: `Bearer ${encodeToken({ session: SESSION, merchantId, loginId, name })}` });
    cashier = bearer(RUN, 'aina', 'Aina');
    manager = bearer(RUN, 'farid', 'Farid');
    otherBusiness = bearer(OTHER, 'zed', 'Zed');
});

after(async () => {
    const ids = db('shifts').whereIn('merchant_id', [RUN, OTHER]).select('id');
    await db('cash_movements').whereIn('shift_id', ids).del();
    await db('shifts').whereIn('merchant_id', [RUN, OTHER]).del();
    await db.destroy();
    fakeServer.close();
});

const open = (headers, body) => api.post('/api/shifts').set(headers).send(body);
const move = (headers, id, body) => api.post(`/api/shifts/${id}/movements`).set(headers).send(body);
const close = (headers, id, body) => api.post(`/api/shifts/${id}/close`).set(headers).send(body);

let shiftId;

test('open a shift: float, who opened it, store name, expected cash = float', async () => {
    const res = await open(cashier, { store_id: '12', register: 't1', opening_float: '200' }).expect(201);
    const s = res.body.shift;
    shiftId = s.id;
    assert.equal(s.status, 'open');
    assert.equal(s.register, 'T1', 'till names are stored upper-case');
    assert.equal(s.store_name, 'MidValley');
    assert.equal(s.opened_by_name, 'Aina', 'taken from the signed token, not from the request');
    assert.equal(s.opening_float, '200.00');
    assert.equal(s.report.expected_cash, '200.00');
});

test('only one open shift per till; another till is fine', async () => {
    const res = await open(manager, { store_id: '12', register: 'T1', opening_float: '100' }).expect(409);
    assert.match(res.body.error, /already has an open shift/);
    const t2 = await open(manager, { store_id: '12', register: 'T2', opening_float: '0' }).expect(201);
    await close(manager, t2.body.shift.id, { counted_cash: '0' }).expect(200);
});

test("a store the user can't access → 403", async () => {
    await open(cashier, { store_id: '99', register: 'T1', opening_float: '100' }).expect(403);
});

test('pay-in, pay-out and drop change the expected cash exactly', async () => {
    await move(cashier, shiftId, { type: 'pay_in', amount: '50', reason: 'More change from safe' }).expect(201);
    await move(cashier, shiftId, { type: 'pay_out', amount: '20.50', reason: 'Cleaning supplies' }).expect(201);
    const res = await move(manager, shiftId, { type: 'drop', amount: 100 }).expect(201);

    const r = res.body.shift.report;
    assert.deepEqual(
        [r.opening_float, r.pay_ins, r.pay_outs, r.drops, r.expected_cash, r.movement_count],
        ['200.00', '50.00', '20.50', '100.00', '129.50', 3], // 200 + 50 − 20.50 − 100
    );
    assert.deepEqual(res.body.shift.movements.map((m) => m.created_by_name), ['Aina', 'Aina', 'Farid']);
});

test('bad movements are refused', async () => {
    const noReason = await move(cashier, shiftId, { type: 'pay_out', amount: '5' }).expect(400);
    assert.equal(noReason.body.details[0].field, 'body.reason');
    await move(cashier, shiftId, { type: 'pay_in', amount: '0' }).expect(400);
    await move(cashier, shiftId, { type: 'pay_in', amount: '1.005' }).expect(400);
    await move(cashier, shiftId, { type: 'sale', amount: '10' }).expect(400); // sales come from checkout

    const tooMuch = await move(cashier, shiftId, { type: 'drop', amount: '500' }).expect(409);
    assert.match(tooMuch.body.error, /RM 129\.50 available/);
});

test('X report: the current shift of a till, with running totals', async () => {
    const res = await api.get('/api/shifts/current').set(cashier).query({ store_id: '12', register: 't1' }).expect(200);
    assert.equal(res.body.shift.id, shiftId);
    assert.equal(res.body.shift.report.expected_cash, '129.50');

    const none = await api.get('/api/shifts/current').set(cashier).query({ store_id: '13', register: 'T1' }).expect(200);
    assert.equal(none.body.shift, null, 'no open shift on that till');
});

test('closing: the notes and coins must add up to the counted cash', async () => {
    const res = await close(cashier, shiftId, { counted_cash: '125.00', breakdown: { '100': 1, '20': 1 } }).expect(400);
    assert.match(res.body.error, /RM 120\.00/);
    await close(cashier, shiftId, { counted_cash: '125', breakdown: { '3': 1 } }).expect(400); // no RM 3 note
});

test('CONCURRENCY: two people close the same shift at once → exactly one succeeds', async () => {
    const body = { counted_cash: '125.00', breakdown: { '100': 1, '20': 1, '5': 1 }, note: 'Short RM 4.50' };
    const [a, b] = await Promise.all([close(cashier, shiftId, body), close(manager, shiftId, body)]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);

    const z = (a.status === 200 ? a : b).body.shift; // the Z report
    assert.equal(z.status, 'closed');
    assert.equal(z.expected_cash, '129.50');
    assert.equal(z.counted_cash, '125.00');
    assert.equal(z.variance, '-4.50', 'negative = cash short');
    assert.deepEqual(z.count_breakdown, { '100': 1, '20': 1, '5': 1 });
});

test('a closed shift takes no more cash movements', async () => {
    await move(cashier, shiftId, { type: 'pay_in', amount: '1' }).expect(409);
});

test('many small amounts add up to the exact cent', async () => {
    const res = await open(cashier, { store_id: '13', register: 'T9', opening_float: '0.10' }).expect(201);
    const id = res.body.shift.id;
    for (let i = 0; i < 10; i++) await move(cashier, id, { type: 'pay_in', amount: '0.10' }).expect(201);
    for (let i = 0; i < 3; i++) await move(cashier, id, { type: 'pay_out', amount: '0.20', reason: 'Parking' }).expect(201);
    const after = await api.get(`/api/shifts/${id}`).set(cashier).expect(200);
    assert.equal(after.body.shift.report.expected_cash, '0.50'); // 0.10 + 10×0.10 − 3×0.20
    await close(cashier, id, { counted_cash: '0.50' }).expect(200);
});

test("another business can't see or touch these shifts", async () => {
    await api.get(`/api/shifts/${shiftId}`).set(otherBusiness).expect(404);
    await move(otherBusiness, shiftId, { type: 'pay_in', amount: '1' }).expect(404);
    const list = await api.get('/api/shifts').set(otherBusiness).expect(200);
    assert.equal(list.body.shifts.length, 0);

    const mine = await api.get('/api/shifts').set(cashier).query({ status: 'closed' }).expect(200);
    assert.equal(mine.body.shifts.length, 3);
});

test('no token → 401', async () => {
    await api.get('/api/shifts').expect(401);
    await api.post('/api/shifts').send({ store_id: '12', register: 'T1', opening_float: '1' }).expect(401);
});
