// Money helpers for the screen. All arithmetic in whole cents (RM 12.50 → 1250), because decimals
// drift on computers (0.1 + 0.2 = 0.30000000000000004). Same rules as backend/src/lib/money.js.

// "12.50" → 1250. Returns null for anything that isn't a clean amount (max 2 decimals),
// so form fields can show "invalid" instead of crashing.
export function toCents(value) {
    const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(String(value ?? '').trim());
    if (!match) return null;
    const [, minus, whole, fraction = ''] = match;
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    return minus ? -cents : cents;
}

// 1250 → "12.50"
export function fromCents(cents) {
    const sign = cents < 0 ? '-' : '';
    const abs = Math.abs(cents);
    return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

// "12.50" or 1250 (cents) → "RM 12.50", with thousands separators: "RM 1,299.50"
export function formatRM(amount, { fromCentsValue = false } = {}) {
    const cents = fromCentsValue ? amount : toCents(amount);
    if (cents === null || cents === undefined) return '—';
    const [whole, fraction] = fromCents(Math.abs(cents)).split('.');
    return `${cents < 0 ? '−' : ''}RM ${Number(whole).toLocaleString('en-MY')}.${fraction}`;
}

// Malaysian ringgit notes and coins (same list as the backend accepts).
export const DENOMINATIONS = [
    { value: '100', label: 'RM 100' }, { value: '50', label: 'RM 50' }, { value: '20', label: 'RM 20' },
    { value: '10', label: 'RM 10' }, { value: '5', label: 'RM 5' }, { value: '1', label: 'RM 1' },
    { value: '0.50', label: '50 sen' }, { value: '0.20', label: '20 sen' }, { value: '0.10', label: '10 sen' },
    { value: '0.05', label: '5 sen' },
];
