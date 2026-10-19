import config from '../config/index.js';

// Express recognises an error handler by its 4 parameters, so keep `next` even though it's unused.
// Express 5 also forwards errors thrown inside async routes here automatically.
// eslint-disable-next-line no-unused-vars
export default function errorHandler(err, req, res, next) {
    const pg = fromPostgresError(err);

    // A service can throw an error with err.status = 400/404/409 to choose the HTTP status.
    const status = pg?.status ?? err.status ?? 500;

    // Only unexpected errors are worth a stack trace in the log; 4xx are the client's mistake.
    if (status >= 500) console.error(err);

    // Show the real message in development only. In production it could leak internal details.
    const message = pg?.message ?? (status < 500 || config.env === 'development'
        ? err.message
        : 'Internal server error');

    const body = { ok: false, error: message };
    if (err.details) body.details = err.details;
    res.status(status).json(body);
}

// The database is the final guard for rules like "SKU must be unique".
// Translate its error codes into proper HTTP answers instead of a generic 500.
// Codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
function fromPostgresError(err) {
    switch (err.code) {
        case '23505': return { status: 409, message: `Already exists (${err.constraint})` };
        case '23503': return { status: 400, message: `Referenced record does not exist (${err.constraint})` };
        case '23514': return { status: 400, message: `Value not allowed (${err.constraint})` };
        default: return null;
    }
}
