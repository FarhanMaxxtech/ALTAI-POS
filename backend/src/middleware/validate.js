import HttpError from '../lib/httpError.js';

// Usage: router.post('/products', validate({ body: createProductSchema }), controller.create)
// Parsed (cleaned) values go to req.valid.body / req.valid.query / req.valid.params.
// Express 5 makes req.query read-only, which is why we don't overwrite it.
export default function validate(schemas) {
    return (req, res, next) => {
        req.valid = {};
        for (const part of ['params', 'query', 'body']) {
            if (!schemas[part]) continue;
            const result = schemas[part].safeParse(req[part] ?? {});
            if (!result.success) {
                const details = result.error.issues.map((i) => ({
                    field: [part, ...i.path].join('.'),
                    message: i.message,
                }));
                return next(new HttpError(400, 'Validation failed', details));
            }
            req.valid[part] = result.data;
        }
        next();
    };
}
