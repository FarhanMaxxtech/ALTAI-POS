// Tests for src/lib/money.js. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCents, fromCents, formatRM } from '../src/lib/money.js';

test('toCents: the usual ways an amount is written', () => {
    assert.equal(toCents('12.50'), 1250);
    assert.equal(toCents('12.5'), 1250);
    assert.equal(toCents('12'), 1200);
    assert.equal(toCents(12.5), 1250);
    assert.equal(toCents('0.05'), 5);
    assert.equal(toCents('-3.20'), -320);
});

test('toCents: refuses anything that is not a clean amount', () => {
    for (const bad of ['12.505', 'abc', '', '1,000.00', '12.']) {
        assert.throws(() => toCents(bad), /Not a money amount/, bad);
    }
});

test('fromCents and formatRM', () => {
    assert.equal(fromCents(1250), '12.50');
    assert.equal(fromCents(5), '0.05');
    assert.equal(fromCents(0), '0.00');
    assert.equal(fromCents(-320), '-3.20');
    assert.equal(formatRM(129950), 'RM 1299.50');
    assert.throws(() => fromCents(12.5));
});

test('cents stay exact where decimals drift', () => {
    assert.notEqual(0.1 + 0.2, 0.3); // the problem
    assert.equal(fromCents(toCents('0.1') + toCents('0.2')), '0.30'); // the fix
});
