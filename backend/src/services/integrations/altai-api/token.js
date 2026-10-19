// The token we give the apps after login. It packs the two things every team-API call needs:
// the user's SESSION and their MERCHANTID, so the apps only have to keep one string.
//
// It is NOT signed or encrypted. It doesn't need to be: the team's API checks the session on
// every call, so a tampered token simply gets rejected there (440 → 401).
// Treat it like a password anyway: anyone holding it can act as that user until it expires.

export function encodeToken({ session, merchantId }) {
    return Buffer.from(JSON.stringify({ s: session, m: String(merchantId) })).toString('base64url');
}

export function decodeToken(token) {
    try {
        const { s, m } = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
        if (typeof s === 'string' && s && typeof m === 'string' && m) return { session: s, merchantId: m };
    } catch {
        // fall through
    }
    return null;
}
