import HttpError from '../lib/httpError.js';

// The till sends the session token it got from POST /api/auth/login as:
//   Authorization: Bearer <token>
// We pass it on to the team's API, which decides whether it's still valid (440 → 401).
// We don't store sessions or passwords. When a session expires, the till logs in again.
export default function requireSession(req, res, next) {
    const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '');
    if (!match) return next(new HttpError(401, 'Log in first (missing Authorization: Bearer <token>)'));
    req.session = match[1];
    next();
}
