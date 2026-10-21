import { createHmac, timingSafeEqual } from 'node:crypto';
import config from '../../../config/index.js';

// The token we give the apps after login: like a sealed envelope.
//
// Inside (readable by anyone, so never put a password here):
//   s   the user's session with the team API
//   m   their merchant id
//   u   their login id (null for badge logins)
//   n   their display name
//   exp when the token stops working (seconds since 1970)
//
// The seal: an HMAC signature, made from the contents + AUTH_SECRET (a random key only this server
// knows, kept in .env). Change one character of the contents and the signature no longer matches,
// so the token is rejected. That matters because some data (shifts, cash) lives only in OUR
// database: there, nobody else checks the token, so we must be sure who is asking.
//
// Format: <contents in base64url>.<signature in base64url>

function sign(payloadPart) {
    if (!config.auth.secret) {
        throw Object.assign(new Error('AUTH_SECRET is missing in .env'), { status: 503 });
    }
    return createHmac('sha256', config.auth.secret).update(payloadPart).digest('base64url');
}

export function encodeToken({ session, merchantId, loginId = null, name = null }) {
    const exp = Math.floor(Date.now() / 1000) + config.auth.tokenHours * 3600;
    const payloadPart = Buffer.from(JSON.stringify({ s: session, m: String(merchantId), u: loginId, n: name, exp }))
        .toString('base64url');
    return `${payloadPart}.${sign(payloadPart)}`;
}

// Returns { session, merchantId, loginId, name } or null when the token is fake, edited or expired.
export function decodeToken(token) {
    const [payloadPart, signature, extra] = String(token).split('.');
    if (!payloadPart || !signature || extra !== undefined) return null;

    // Compare signatures in constant time, so an attacker can't guess one byte at a time
    // by measuring how long the comparison takes.
    const expected = Buffer.from(sign(payloadPart));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

    try {
        const { s, m, u, n, exp } = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
        if (typeof s !== 'string' || !s || typeof m !== 'string' || !m) return null;
        if (typeof exp !== 'number' || exp * 1000 < Date.now()) return null; // expired
        return { session: s, merchantId: m, loginId: u ?? null, name: n ?? null };
    } catch {
        return null;
    }
}
