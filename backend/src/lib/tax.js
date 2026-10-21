// Tax (SST) and cash rounding, all in whole cents.
//
// Two ways a shop can show prices:
//   tax-INCLUSIVE (normal in Malaysian retail): the tag price already contains the tax.
//       RM 49.90 at 6%  →  tax = 49.90 × 6 / 106 = 2.82,  before tax = 47.08,  customer pays 49.90
//   tax-EXCLUSIVE: the tax is added on top of the tag price.
//       RM 49.90 at 6%  →  tax = 49.90 × 6 / 100 = 2.99,  customer pays 52.89
//
// The rate is handled in "basis points" (hundredths of a percent): 6% = 600, 6.25% = 625. With whole
// numbers everywhere, and BigInt for the multiplication so even huge amounts can't overflow, the
// result is exact; the only rounding is the final one to the nearest sen (half rounds up).

// "6", "6.00", "6.25" or 6 → 600 / 600 / 625 / 600
export function rateToBasisPoints(rate) {
    const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(String(rate).trim());
    if (!match) throw new Error(`Not a tax rate: "${rate}"`);
    const bp = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
    if (bp > 10000) throw new Error(`Tax rate above 100%: "${rate}"`);
    return bp;
}

// numerator / denominator, rounded to the nearest whole number (half up). Both non-negative BigInts.
function divideRounded(numerator, denominator) {
    return Number((numerator * 2n + denominator) / (denominator * 2n));
}

// Split an amount into "before tax", "tax" and "total".
// cents: the amount as shown on the price tag. rate: e.g. "6.00". inclusive: does the tag include tax?
export function splitTax(cents, rate, inclusive) {
    if (!Number.isInteger(cents)) throw new Error(`Cents must be a whole number, got ${cents}`);
    const sign = cents < 0 ? -1 : 1;        // refunds are negative: same maths, sign kept
    const amount = BigInt(Math.abs(cents));
    const bp = BigInt(rateToBasisPoints(rate));

    let tax;
    let net;
    if (inclusive) {
        tax = divideRounded(amount * bp, 10000n + bp);
        net = Number(amount) - tax;
    } else {
        tax = divideRounded(amount * bp, 10000n);
        net = Number(amount);
    }
    // `+ 0` turns a "-0" into 0, so a zero amount never shows as negative.
    return { net: sign * net + 0, tax: sign * tax + 0, total: sign * (net + tax) + 0 };
}

// Malaysia's cash rounding (Bank Negara): cash totals are rounded to the nearest 5 sen.
//   x.x1, x.x2 → down to x.x0     x.x3, x.x4 → up to x.x5
//   x.x6, x.x7 → down to x.x5     x.x8, x.x9 → up to x.(x+1)0
// Only for CASH payments; card and e-wallet pay the exact amount.
export function roundCash(cents) {
    const sign = cents < 0 ? -1 : 1;
    return sign * Math.round(Math.abs(cents) / 5) * 5 + 0;
}
