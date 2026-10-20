import config from '../../../config/index.js';
import HttpError from '../../../lib/httpError.js';

// Low-level HTTP client for the team's API (altairfid). Only this file knows its headers, its
// status codes and its error format. Everything above it gets either data or an HttpError.
//
// What the API expects (from the rfid_counter app):
//   APIKEY     — our application key (from .env, never sent to the tills)
//   MERCHANTID — which merchant's data
//   SESSION    — the user's session token from Merchant/Login (a response *header*)
// Status 440 means the session expired. A 200 response can still carry { "error": "..." }.

export const SESSION_EXPIRED = 'SESSION_EXPIRED';

// auth = { session, merchantId } of the logged-in user (from the token). Login itself has no auth yet,
// so it falls back to the default merchant id from .env.
export async function request({ method = 'GET', path, query, body, auth }) {
    const { baseUrl, apiKey, merchantId: defaultMerchantId, timeoutMs } = config.altaiApi;
    if (!apiKey) throw new HttpError(503, 'Team API is not configured (ALTAI_API_KEY missing in .env)');

    const url = new URL(`${baseUrl}/${path}`);
    for (const [k, v] of Object.entries(query ?? {})) if (v != null) url.searchParams.set(k, v);

    const headers = { APIKEY: apiKey, MERCHANTID: auth?.merchantId ?? defaultMerchantId, Accept: 'application/json' };
    if (auth?.session) headers.SESSION = auth.session;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let res;
    try {
        res = await fetch(url, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(timeoutMs), // never let a slow upstream hang the till
        });
    } catch (err) {
        if (err.name === 'TimeoutError') throw new HttpError(504, `Team API timed out (${path})`);
        throw new HttpError(502, `Team API unreachable (${path})`);
    }

    if (res.status === 440) {
        throw new HttpError(401, 'Session expired. Please log in again', [{ code: SESSION_EXPIRED }]);
    }

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }

    if (res.ok) logShapeOnce(path, data);
    return { status: res.status, headers: res.headers, data };
}

// Development aid while the team's API docs are missing: log the FIELD NAMES (never the values)
// of the first successful response from each endpoint, so we can confirm our mappings.
// Lists are described by their first item. Remove once the docs/Postman collection arrive.
const loggedShapes = new Set();
function logShapeOnce(path, data) {
    if (config.env !== 'development' || loggedShapes.has(path) || data == null) return;
    loggedShapes.add(path);
    const describe = (v, depth = 0) => {
        if (Array.isArray(v)) return v.length ? [describe(v[0], depth + 1)] : [];
        if (v && typeof v === 'object' && depth < 3) {
            return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, describe(x, depth + 1)]));
        }
        return v === null ? 'null' : typeof v;
    };
    console.info(`[team API shape] ${path}:`, JSON.stringify(describe(data)));
}

// For normal calls: anything other than 2xx, or a body with "error", becomes an HttpError.
// errorStatus: what an { error } body means for this endpoint (e.g. 404 for "tag not found").
export function expectOk({ status, data }, path, { errorStatus = 422 } = {}) {
    if (status < 200 || status >= 300) {
        // Their 4xx/5xx is our 502: from the till's point of view, the server we depend on failed.
        console.error(`Team API ${path} returned ${status}`, data);
        throw new HttpError(502, `Team API error (${path}, status ${status})`);
    }
    if (data && typeof data === 'object' && 'error' in data) {
        throw new HttpError(errorStatus, errorMessage(data.error));
    }
    return data;
}

// Their error is sometimes a string, sometimes { message: "..." }.
export function errorMessage(error) {
    if (typeof error === 'string') return error;
    return error?.message ? String(error.message) : 'Team API reported an error';
}
