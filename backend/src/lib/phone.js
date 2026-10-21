// Phone numbers: turn whatever the cashier typed into ONE standard form (E.164, e.g. +60123456789).
//
// Why: "012-345 6789", "0123456789", "60123456789" and "+60 12-345 6789" are the same phone.
// If we stored them as typed, one customer could be registered four times, and a promotion would
// reach them four times. Storing the standard form makes the phone a reliable customer id, and it's
// also the format WhatsApp needs.
//
// Malaysian numbers (local "0…" or "60…") become +60…; numbers typed with "+" or "00" in front are
// kept as international numbers.

// +60 followed by 8 to 10 digits, not starting with 0 (Malaysian mobiles are +601…, e.g. +60123456789).
const MALAYSIA = /^\+60[1-9]\d{7,9}$/;
// Any other country: + and 8 to 15 digits in total (the international maximum).
const INTERNATIONAL = /^\+[1-9]\d{7,14}$/;

// Returns the standard form, or null when it can't be a valid phone number.
export function normalizePhone(input) {
    if (input === null || input === undefined) return null;
    let s = String(input).trim().replace(/[\s\-().]/g, ''); // remove spaces, dashes, brackets, dots

    if (s.startsWith('00')) s = `+${s.slice(2)}`;          // 0060… → +60…
    else if (s.startsWith('0')) s = `+60${s.slice(1)}`;     // 012… (local Malaysian) → +6012…
    else if (s.startsWith('60')) s = `+${s}`;              // 6012… → +6012…
    if (!/^\+\d+$/.test(s)) return null;                    // anything left that isn't digits: invalid

    if (s.startsWith('+60')) return MALAYSIA.test(s) ? s : null;
    return INTERNATIONAL.test(s) ? s : null;
}

// For display: +60123456789 → "+60 12-345 6789". Other countries stay as stored.
export function formatPhone(e164) {
    const m = /^\+60(1\d)(\d{3,4})(\d{4})$/.exec(e164 ?? '');
    return m ? `+60 ${m[1]}-${m[2]} ${m[3]}` : (e164 ?? '');
}
