// Money helpers: all cash arithmetic happens in whole cents.
//
// Why: computers store decimals like 0.1 inexactly, so 0.1 + 0.2 gives 0.30000000000000004.
// Over a day of cash movements those tiny errors add up and a drawer looks "1 sen short".
// Whole numbers are exact, so we turn "12.50" into 1250 cents, do the maths, and turn it back.
//
// The database (NUMERIC) and the API (strings like "12.50") never see a float either.

// "12.50" / "12.5" / "12" / 12.5 / "-3.20"  →  1250 / 1250 / 1200 / 1250 / -320
export function toCents(value) {
    const text = String(value).trim();
    const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(text);
    if (!match) throw new Error(`Not a money amount: "${text}"`);
    const [, minus, whole, fraction = ''] = match;
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    return minus ? -cents : cents;
}

// 1250 → "12.50", -320 → "-3.20", 0 → "0.00"
export function fromCents(cents) {
    if (!Number.isInteger(cents)) throw new Error(`Cents must be a whole number, got ${cents}`);
    const sign = cents < 0 ? '-' : '';
    const abs = Math.abs(cents);
    return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

// For messages shown to people: 1250 → "RM 12.50"
export const formatRM = (cents) => `RM ${fromCents(cents)}`;
