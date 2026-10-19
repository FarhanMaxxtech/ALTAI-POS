// Run with: npm test
// Uses the dev database. Everything created here starts with a unique run prefix and is removed afterwards.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db/index.js';

const RUN = `I${Date.now().toString(36).toUpperCase()}`;
const api = request(app);
let store, warehouse, black, white; // locations and variants used by every test

before(async () => {
    store = (await api.post('/api/locations').send({ code: `${RUN}-st`, name: `${RUN} Store` }).expect(201)).body.location;
    warehouse = (await api.post('/api/locations').send({ code: `${RUN}-wh`, name: `${RUN} Warehouse`, type: 'warehouse' }).expect(201)).body.location;

    const { body } = await api.post('/api/products').send({
        style_code: `${RUN}-tee`, name: `${RUN} Tee`, base_price: '39.90',
        variants: [
            { sku: `${RUN}-tee-blk-m`, color: 'Black', size: 'M' },
            { sku: `${RUN}-tee-wht-m`, color: 'White', size: 'M' },
        ],
    }).expect(201);
    [black, white] = ['Black', 'White'].map((c) => body.product.variants.find((v) => v.color === c));
});

after(async () => {
    const locIds = db('locations').whereLike('code', `${RUN}%`).select('id');
    await db('rfid_tags').whereIn('variant_id', [black.id, white.id]).del();
    await db('stock_movements').whereIn('location_id', locIds).del();
    await db('stock_levels').whereIn('location_id', locIds).del();
    await db('stock_transfers').whereIn('from_location_id', locIds).del();
    await db('products').whereLike('style_code', `${RUN}%`).del();
    await db('locations').whereLike('code', `${RUN}%`).del();
    await db.destroy();
});

const qtyAt = async (location, variant) =>
    (await db('stock_levels').where({ location_id: location.id, variant_id: variant.id }).first())?.quantity ?? 0;

// The ledger must always explain the balance exactly.
const assertLedgerMatches = async (location, variant) => {
    const { sum } = await db('stock_movements').where({ location_id: location.id, variant_id: variant.id })
        .sum('quantity_change as sum').first();
    assert.equal(Number(sum ?? 0), await qtyAt(location, variant), 'sum of movements = stock level');
};

test('receive stock into the warehouse', async () => {
    const res = await api.post('/api/inventory/receive').send({
        location_id: warehouse.id,
        lines: [{ variant_id: black.id, quantity: 30 }, { variant_id: white.id, quantity: 12 }],
        reason: 'PO-1001',
    }).expect(201);

    assert.equal(res.body.movements.length, 2);
    assert.equal(await qtyAt(warehouse, black), 30);
    assert.equal(await qtyAt(warehouse, white), 12);
    await assertLedgerMatches(warehouse, black);
});

test('transfer moves stock: out of one location, into the other, linked to one transfer', async () => {
    const res = await api.post('/api/inventory/transfer').send({
        from_location_id: warehouse.id, to_location_id: store.id,
        lines: [{ variant_id: black.id, quantity: 10 }],
    }).expect(201);

    assert.equal(await qtyAt(warehouse, black), 20);
    assert.equal(await qtyAt(store, black), 10);
    const types = res.body.movements.map((m) => m.type).sort();
    assert.deepEqual(types, ['transfer_in', 'transfer_out']);
    assert.ok(res.body.movements.every((m) => m.reference_type === 'transfer' && m.reference_id === res.body.transfer_id));
});

test('cannot take more than is in stock (409) and nothing changes', async () => {
    const res = await api.post('/api/inventory/transfer').send({
        from_location_id: warehouse.id, to_location_id: store.id,
        lines: [{ variant_id: white.id, quantity: 5 }, { variant_id: black.id, quantity: 999 }],
    }).expect(409);

    assert.equal(res.body.error, 'Insufficient stock');
    assert.equal(res.body.details[0].available, 20);
    // The white line was valid, but the whole transfer is rolled back.
    assert.equal(await qtyAt(warehouse, white), 12);
    assert.equal(await qtyAt(store, white), 0);
});

test('CONCURRENCY: 20 simultaneous sales of 1 against stock of 10 → exactly 10 succeed', async () => {
    assert.equal(await qtyAt(store, black), 10);

    const attempts = Array.from({ length: 20 }, () => api.post('/api/inventory/adjust').send({
        location_id: store.id, variant_id: black.id, quantity_change: -1, reason: 'concurrency test',
    }));
    const statuses = (await Promise.all(attempts)).map((r) => r.status);

    assert.equal(statuses.filter((s) => s === 201).length, 10, 'exactly 10 sales succeed');
    assert.equal(statuses.filter((s) => s === 409).length, 10, 'the other 10 are refused');
    assert.equal(await qtyAt(store, black), 0, 'never negative, no lost updates');
    await assertLedgerMatches(store, black);

    // Each successful movement saw a different balance: 9, 8, ... 0 (no two read the same value).
    const balances = (await db('stock_movements')
        .where({ location_id: store.id, variant_id: black.id, type: 'adjust' }).pluck('balance_after')).sort((a, b) => a - b);
    assert.deepEqual(balances, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('stock count sets the counted quantity and reports variances', async () => {
    const res = await api.post('/api/inventory/count').send({
        location_id: warehouse.id,
        lines: [{ variant_id: black.id, counted_quantity: 18 }, { variant_id: white.id, counted_quantity: 12 }],
    }).expect(201);

    const byVariant = Object.fromEntries(res.body.variances.map((v) => [v.variant_id, v]));
    assert.deepEqual(byVariant[black.id], { variant_id: black.id, expected: 20, counted: 18, difference: -2 });
    assert.equal(byVariant[white.id].difference, 0);
    assert.equal(await qtyAt(warehouse, black), 18);
    await assertLedgerMatches(warehouse, black);

    const countMoves = await db('stock_movements').where({ location_id: warehouse.id, type: 'count' });
    assert.equal(countMoves.length, 1, 'no movement for items that matched');
});

test('adjust requires a reason; duplicate lines and same-location transfers are rejected', async () => {
    await api.post('/api/inventory/adjust').send({ location_id: store.id, variant_id: white.id, quantity_change: 1 }).expect(400);
    await api.post('/api/inventory/receive').send({
        location_id: store.id, lines: [{ variant_id: white.id, quantity: 1 }, { variant_id: white.id, quantity: 2 }],
    }).expect(400);
    await api.post('/api/inventory/transfer').send({
        from_location_id: store.id, to_location_id: store.id, lines: [{ variant_id: white.id, quantity: 1 }],
    }).expect(400);
});

test('archived location cannot receive stock', async () => {
    const loc = (await api.post('/api/locations').send({ code: `${RUN}-old`, name: 'Closed store' }).expect(201)).body.location;
    await api.patch(`/api/locations/${loc.id}`).send({ status: 'archived' }).expect(200);
    await api.post('/api/inventory/receive').send({ location_id: loc.id, lines: [{ variant_id: white.id, quantity: 1 }] }).expect(409);
});

test('stock and movement queries', async () => {
    const stock = await api.get('/api/inventory/stock').query({ location_id: warehouse.id }).expect(200);
    assert.deepEqual(stock.body.stock.map((s) => [s.sku, s.quantity]), [[`${RUN}-TEE-BLK-M`, 18], [`${RUN}-TEE-WHT-M`, 12]]);

    const moves = await api.get('/api/inventory/movements').query({ location_id: warehouse.id, variant_id: black.id }).expect(200);
    assert.deepEqual(moves.body.movements.map((m) => m.type), ['count', 'transfer_out', 'receive'], 'newest first');
});

test('RFID: register tags, resolve a mixed read, update status', async () => {
    const epcs = [`${RUN}A1`, `${RUN}A2`].map((e) => Buffer.from(e).toString('hex')); // unique hex EPCs per run
    await api.post('/api/rfid/tags').send({ epcs, variant_id: black.id, location_id: store.id }).expect(201);
    await api.post('/api/rfid/tags').send({ epcs: [epcs[0]], variant_id: black.id }).expect(409); // already registered

    const unknownEpc = 'E28000000000000000000000';
    const res = await api.post('/api/rfid/resolve').send({ epcs: [epcs[0].toLowerCase(), unknownEpc] }).expect(200);
    assert.equal(res.body.tags.length, 1);
    assert.equal(res.body.tags[0].sku, `${RUN}-TEE-BLK-M`);
    assert.equal(res.body.tags[0].effective_price, '39.90');
    assert.deepEqual(res.body.unknown, [unknownEpc]);

    const upd = await api.patch(`/api/rfid/tags/${epcs[1]}`).send({ status: 'missing' }).expect(200);
    assert.equal(upd.body.tag.status, 'missing');

    // Tags never change quantities.
    assert.equal(await qtyAt(store, black), 0);
});
