// Tests for src/lib/phone.js. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, formatPhone } from '../src/lib/phone.js';

test('every way of typing the same Malaysian mobile gives one standard number', () => {
    for (const typed of ['0123456789', '012-345 6789', '012 3456789', '(012) 345-6789', '60123456789', '+60123456789', '+60 12-345 6789', '0060123456789']) {
        assert.equal(normalizePhone(typed), '+60123456789', typed);
    }
});

test('11-digit Malaysian mobiles (011-…) and landlines work too', () => {
    assert.equal(normalizePhone('011-2345 6789'), '+601123456789');
    assert.equal(normalizePhone('03-2141 2345'), '+60321412345');
});

test('foreign numbers typed with + or 00 are kept', () => {
    assert.equal(normalizePhone('+65 9123 4567'), '+6591234567');
    assert.equal(normalizePhone('0044 7911 123456'), '+447911123456');
});

test('nonsense is rejected', () => {
    for (const bad of ['', 'abc', '12345', '012-34', '+60 0123456789', '0123456789012345', null, undefined]) {
        assert.equal(normalizePhone(bad), null, String(bad));
    }
});

test('formatPhone: readable Malaysian mobiles', () => {
    assert.equal(formatPhone('+60123456789'), '+60 12-345 6789');
    assert.equal(formatPhone('+601123456789'), '+60 11-2345 6789');
    assert.equal(formatPhone('+6591234567'), '+6591234567');
});
