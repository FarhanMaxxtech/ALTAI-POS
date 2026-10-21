// Tests for src/lib/tax.js. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateToBasisPoints, splitTax, roundCash } from '../src/lib/tax.js';

test('rates in basis points', () => {
    assert.equal(rateToBasisPoints('6'), 600);
    assert.equal(rateToBasisPoints('6.00'), 600);
    assert.equal(rateToBasisPoints('6.25'), 625);
    assert.equal(rateToBasisPoints(10), 1000);
    assert.equal(rateToBasisPoints('0'), 0);
    assert.throws(() => rateToBasisPoints('6.255'));
    assert.throws(() => rateToBasisPoints('101'));
});

test('tax-inclusive: the tax is inside the tag price', () => {
    // 49.90 × 6/106 = 2.8245… → 2.82
    assert.deepEqual(splitTax(4990, '6', true), { net: 4708, tax: 282, total: 4990 });
    // 100.00 at 10%: 100 × 10/110 = 9.0909… → 9.09
    assert.deepEqual(splitTax(10000, '10', true), { net: 9091, tax: 909, total: 10000 });
});

test('tax-exclusive: the tax is added on top', () => {
    // 49.90 × 6% = 2.994 → 2.99
    assert.deepEqual(splitTax(4990, '6', false), { net: 4990, tax: 299, total: 5289 });
    // half a sen rounds up: 0.25 × 10% = 0.025 → 0.03
    assert.deepEqual(splitTax(25, '10', false), { net: 25, tax: 3, total: 28 });
});

test('0% tax, zero amounts and refunds', () => {
    assert.deepEqual(splitTax(4990, '0', true), { net: 4990, tax: 0, total: 4990 });
    assert.deepEqual(splitTax(0, '6', false), { net: 0, tax: 0, total: 0 });
    assert.deepEqual(splitTax(-4990, '6', true), { net: -4708, tax: -282, total: -4990 }, 'a refund mirrors the sale');
});

test('huge amounts stay exact (BigInt inside)', () => {
    const tenBillionRinggit = 1_000_000_000_000; // in cents
    assert.deepEqual(splitTax(tenBillionRinggit, '6', false), { net: tenBillionRinggit, tax: 60_000_000_000, total: 1_060_000_000_000 });
});

test("Bank Negara cash rounding to the nearest 5 sen", () => {
    const cases = { 1230: 1230, 1231: 1230, 1232: 1230, 1233: 1235, 1234: 1235, 1235: 1235, 1236: 1235, 1237: 1235, 1238: 1240, 1239: 1240 };
    for (const [input, expected] of Object.entries(cases)) assert.equal(roundCash(Number(input)), expected, input);
    assert.equal(roundCash(-1233), -1235, 'refunds round the same way');
    assert.equal(roundCash(0), 0);
});
