// An error that knows which HTTP status it should produce.
// Services throw these (e.g. 404 "Product not found"); errorHandler turns them into JSON.
export default class HttpError extends Error {
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}
