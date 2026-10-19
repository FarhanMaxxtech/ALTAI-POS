import config from '../config/index.js';

// Express recognises an error handler by its 4 parameters, so keep `next` even though it's unused.
// Express 5 also forwards errors thrown inside async routes here automatically.
// eslint-disable-next-line no-unused-vars
export default function errorHandler(err, req, res, next) {
    console.error(err);

    // A service can throw an error with err.status = 400/404/409 to choose the HTTP status.
    const status = err.status ?? 500;

    // Show the real message in development only. In production it could leak internal details.
    const message = status < 500 || config.env === 'development'
        ? err.message
        : 'Internal server error';

    res.status(status).json({ ok: false, error: message });
}
