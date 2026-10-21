import HttpError from '../lib/httpError.js';
import { decodeToken } from '../services/integrations/altai-api/token.js';

// Guards every route that needs a logged-in user.
//
// The apps send the token they got from POST /api/auth/login as:
//   Authorization: Bearer <token>
// We check its signature and expiry (see token.js), then attach to the request:
//   req.auth = { session, merchantId }       → passed on to the team's API
//   req.user = { loginId, name, merchantId } → used in OUR data, e.g. who opened a shift
// A missing, edited or expired token gets 401, and the app sends the user back to the login page.
export default function requireSession(req, res, next) {
    const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '');
    if (!match) return next(new HttpError(401, 'Log in first (missing Authorization: Bearer <token>)'));

    let decoded;
    try {
        decoded = decodeToken(match[1]);
    } catch (err) {
        return next(err); // e.g. AUTH_SECRET missing on the server → 503
    }
    if (!decoded) return next(new HttpError(401, 'Your session has expired. Please log in again', [{ code: 'SESSION_EXPIRED' }]));

    req.auth = { session: decoded.session, merchantId: decoded.merchantId };
    req.user = { loginId: decoded.loginId, name: decoded.name ?? 'Staff', merchantId: decoded.merchantId };
    next();
}
