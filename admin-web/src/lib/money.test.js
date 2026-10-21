// Run with: npm test (inside admin-web/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCents, fromCents, formatRM } from './money.js';

test('toCents: clean amounts become whole cents; anything else is null', () => {
    assert.equal(toCents('12.5'), 1250);
    assert.equal(toCents(' 200 '), 20000);
    assert.equal(toCents('0.05'), 5);
    assert.equal(toCents('1.005'), null);
    assert.equal(toCents('abc'), null);
    assert.equal(toCents(''), null);
});

test('formatRM: readable amounts, negatives with a real minus sign', () => {
    assert.equal(formatRM('1299.5'), 'RM 1,299.50');
    assert.equal(formatRM(-450, { fromCentsValue: true }), '−RM 4.50');
    assert.equal(formatRM('nope'), '—');
    assert.equal(fromCents(0), '0.00');
});
