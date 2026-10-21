// Run with: npm test (inside admin-web/). Same answers as backend/tests/tax.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitTax, roundCash, rateToBasisPoints } from './tax.js';

test('inclusive and exclusive SST', () => {
    assert.deepEqual(splitTax(4990, '6', true), { net: 4708, tax: 282, total: 4990 });
    assert.deepEqual(splitTax(4990, '6', false), { net: 4990, tax: 299, total: 5289 });
    assert.equal(splitTax(4990, 'abc', true), null);
    assert.equal(rateToBasisPoints('101'), null);
});

test('cash rounding to 5 sen', () => {
    assert.deepEqual([1231, 1233, 1237, 1238].map(roundCash), [1230, 1235, 1235, 1240]);
});
