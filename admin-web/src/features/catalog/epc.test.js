// Tests for epc.js. Run with: npm test  (inside admin-web/)
// Each test feeds the helper an example and checks the answer, so if someone changes the rules
// by mistake, a test fails before the change reaches the shop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEpcs, chunk, groupBySku, priceForRow } from './epc.js';

test('parseEpcs: one code per line, as a scanner types them', () => {
    const result = parseEpcs('E2801160600002\nE2801160600003\n');
    assert.deepEqual(result, { epcs: ['E2801160600002', 'E2801160600003'], invalid: [], duplicates: 0 });
});

test('parseEpcs: commas, spaces, lower-case and blank lines are all fine', () => {
    const result = parseEpcs('  e2801160600002, E2801160600003 \n\n e2801160600004 ');
    assert.deepEqual(result.epcs, ['E2801160600002', 'E2801160600003', 'E2801160600004']);
});

test('parseEpcs: the same tag scanned twice is kept once and counted as a duplicate', () => {
    const result = parseEpcs('E2801160600002\ne2801160600002\nE2801160600002');
    assert.deepEqual(result.epcs, ['E2801160600002']);
    assert.equal(result.duplicates, 2);
});

test('parseEpcs: typos are reported, not sent to the server', () => {
    const result = parseEpcs('E2801160600002\nHELLO123\nE28');
    assert.deepEqual(result.epcs, ['E2801160600002']);
    assert.deepEqual(result.invalid, ['HELLO123', 'E28']); // not hex / too short
});

test('chunk: splits a list into batches of at most N', () => {
    assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    assert.deepEqual(chunk([], 200), []);
});

test('groupBySku: tags of the same SKU become one row with a count', () => {
    const tag = (epc, sku, extra = {}) => ({
        epc, sku, product_name: 'Classic Tee', product_code: 'CT', variation: 'Black / M',
        store_name: 'MidValley', pending_transaction: false, ...extra,
    });
    const rows = groupBySku([
        tag('A1', 'CT-BLK-M'),
        tag('A2', 'CT-BLK-M', { store_name: 'Pavilion', pending_transaction: true }),
        tag('B1', 'CT-BLK-L', { variation: 'Black / L' }),
        { epc: 'C1', sku: 'AB-001', product_name: 'Ankle Boot', store_name: null },
    ]);

    assert.deepEqual(rows.map((r) => [r.sku, r.tagCount]), [['AB-001', 1], ['CT-BLK-L', 1], ['CT-BLK-M', 2]]);
    const blackM = rows.find((r) => r.sku === 'CT-BLK-M');
    assert.deepEqual(blackM.epcs, ['A1', 'A2']);
    assert.deepEqual(blackM.stores, ['MidValley', 'Pavilion']);
    assert.equal(blackM.pendingCount, 1);
});

test('priceForRow: one price, prices that vary by store, no price, unknown', () => {
    const tags = [
        { sku: 'A', store_id: '12' }, { sku: 'A', store_id: '12' },
        { sku: 'B', store_id: '12' }, { sku: 'B', store_id: '13' },
        { sku: 'C', store_id: '12' },
        { sku: 'D', store_id: null },
    ];
    const map = { '12|A': '49.90', '12|B': '89.00', '13|B': '79.00', '12|C': null };
    assert.deepEqual(priceForRow(tags, 'A', map), { kind: 'price', price: '49.90' });
    assert.deepEqual(priceForRow(tags, 'B', map), { kind: 'varies' });
    assert.deepEqual(priceForRow(tags, 'C', map), { kind: 'none' });
    assert.deepEqual(priceForRow(tags, 'D', map), { kind: 'unknown' });
});
