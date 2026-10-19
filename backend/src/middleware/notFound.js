// Runs only when no route matched, so it must be registered AFTER all routes.
// Replies with JSON (not Express's default HTML page) because our clients expect JSON.
export default function notFound(req, res) {
    res.status(404).json({
        ok: false,
        error: `Not found: ${req.method} ${req.originalUrl}`,
    });
}
