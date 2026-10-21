// Tax (SST) and cash rounding for the screen, in whole cents. Same rules as backend/src/lib/tax.js,
// used for live examples ("a RM 49.90 tag means …"). The backend does the real calculation.

// "6" / "6.25" → 600 / 625 (hundredths of a percent). null if it isn't a valid rate.
export function rateToBasisPoints(rate) {
    const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(String(rate ?? '').trim());
    if (!match) return null;
    const bp = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
    return bp <= 10000 ? bp : null;
}

const divideRounded = (numerator, denominator) => Number((numerator * 2n + denominator) / (denominator * 2n));

// Tag price in cents → { net (before tax), tax, total (customer pays) }.
export function splitTax(cents, rate, inclusive) {
    const bp = rateToBasisPoints(rate);
    if (bp === null || !Number.isInteger(cents)) return null;
    const amount = BigInt(cents);
    if (inclusive) {
        const tax = divideRounded(amount * BigInt(bp), 10000n + BigInt(bp));
        return { net: cents - tax, tax, total: cents };
    }
    const tax = divideRounded(amount * BigInt(bp), 10000n);
    return { net: cents, tax, total: cents + tax };
}

// Bank Negara rule: cash totals to the nearest 5 sen.
export const roundCash = (cents) => Math.round(cents / 5) * 5;
