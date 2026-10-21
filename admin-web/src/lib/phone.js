// Show a stored phone number nicely: +60123456789 → "+60 12-345 6789". Other countries stay as stored.
// (The backend does the real checking and converting: backend/src/lib/phone.js.)
export function formatPhone(e164) {
    const m = /^\+60(1\d)(\d{3,4})(\d{4})$/.exec(e164 ?? '');
    return m ? `+60 ${m[1]}-${m[2]} ${m[3]}` : (e164 ?? '');
}
