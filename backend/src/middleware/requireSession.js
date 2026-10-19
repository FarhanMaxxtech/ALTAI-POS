import HttpError from '../lib/httpError.js';
import { decodeToken } from '../services/integrations/altai-api/token.js';

// The apps send the token they got from POST /api/auth/login as:
//   Authorization: Bearer <token>
// We unpack it into req.auth = { session, merchantId } and pass both on to the team's API,
// which decides whether the session is still valid (440 → 401).
// We don't store sessions or passwords. When a session expires, the user logs in again.
export default function requireSession(req, res, next) {
    const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '');
    if (!match) return next(new HttpError(401, 'Log in first (missing Authorization: Bearer <token>)'));

    const auth = decodeToken(match[1]);
    if (!auth) return next(new HttpError(401, 'Invalid token. Please log in again', [{ code: 'SESSION_EXPIRED' }]));

    req.auth = auth;
    next();
}
