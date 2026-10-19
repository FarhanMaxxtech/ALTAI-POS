import config from '../../../config/index.js';
import HttpError from '../../../lib/httpError.js';
import { request, expectOk } from './client.js';
import { encodeToken } from './token.js';

// The team's API in OUR terms: snake_case fields, numbers as numbers, consistent shapes.
// If their field names change, only the mapping functions here change.
// Field names marked "unconfirmed" come from guesses in the rfid_counter app. Check them
// against the API docs/Postman collection when the team sends it.

// ---------- login ----------

// Note: their server allows ONE active session per login. Logging in again (e.g. on a second
// till with the same account) ends the first session. Each till needs its own login.
//
// Two ways to log in, same endpoint:
//   { login_id, password }  — typed at the login screen
//   { epc }                 — staff badge tapped on an RFID reader
// Success: HTTP 200, session in the "session" response header, body { name, merchantId, ... }.
// Failure: often still HTTP 200, with { error: { message } } in the body and no session header.
export async function login({ login_id, password, epc }) {
    const body = epc ? { loginId: '', password: '', epc } : { loginId: login_id, password };
    const res = await request({ method: 'POST', path: 'Merchant/Login', body });
    const session = res.headers.get('session');

    if (res.status !== 200 || !session || res.data?.error) {
        // Same message for "unknown user" and "wrong password": don't tell an attacker which one.
        throw new HttpError(401, epc ? 'Badge not recognised' : 'Invalid login ID or password');
    }

    const merchantId = String(res.data?.merchantId ?? config.altaiApi.merchantId);
    return {
        token: encodeToken({ session, merchantId }),
        user: { name: res.data?.name ?? login_id ?? 'Staff', login_id: login_id ?? null, merchant_id: merchantId },
    };
}

// The permission ids this user has, e.g. [1, 4, 7]. What each id means: ask the team (unconfirmed).
export async function getPermissions(auth) {
    const data = expectOk(await request({ path: 'Merchant/AccessControl', auth }), 'Merchant/AccessControl');
    return (data?.data ?? []).map((p) => Number(p.id)).filter(Number.isFinite);
}

// ---------- stores ----------

export async function listStores(auth) {
    const data = expectOk(await request({ path: 'Stock/StoreList', auth }), 'Stock/StoreList');
    return (data?.data ?? []).map((s) => ({
        id: String(s.id ?? s.storeId),     // unconfirmed: id vs storeId
        name: s.name ?? s.storeName ?? '', // unconfirmed: name vs storeName
        raw: s,                            // full original record until the shape is confirmed
    }));
}

// ---------- tags ----------

function mapTag(epc, d) {
    return {
        epc,
        sku: d.sku ?? null,
        product_name: d.productName ?? null,
        product_code: d.productCode ?? null,
        variation: d.varLabel ?? null,           // e.g. "Black / M"
        variation_details: d.varDetails ?? [],   // [{ typeName, value, ... }]
        store_id: (d.currentStoreId ?? d.storeId)?.toString() ?? null, // unconfirmed field name
        store_name: d.storeName ?? null,
        pending_transaction: Boolean(d.isPendingTransaction ?? d.isPending ?? d.pending ?? false),
    };
}

export async function lookupTag(auth, epc, { storeId, opType } = {}) {
    const body = { epc };
    if (storeId) body.storeId = storeId;
    if (opType) body.opType = opType;
    const data = expectOk(
        await request({ method: 'POST', path: 'Stock/TagLookup', auth, body }),
        'Stock/TagLookup',
        { errorStatus: 404 }, // { error } from TagLookup = tag not known
    );
    return mapTag(epc, data);
}

// Their API looks up one EPC per call, but a reader sends many at once. Run at most
// MAX_PARALLEL lookups at a time (same limit as the rfid_counter app), so a scan burst
// doesn't flood their server.
const MAX_PARALLEL = 5;

export async function lookupTags(auth, epcs, options) {
    const results = new Array(epcs.length);
    let next = 0;
    const worker = async () => {
        while (next < epcs.length) {
            const i = next++;
            try {
                results[i] = { ok: true, tag: await lookupTag(auth, epcs[i], options) };
            } catch (err) {
                // An expired session or a missing key fails the whole batch; other errors are per-tag.
                if (err.status === 401 || err.status === 503) throw err;
                results[i] = { ok: false, epc: epcs[i], status: err.status ?? 500, error: err.message };
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL, epcs.length) }, worker));

    return {
        tags: results.filter((r) => r.ok).map((r) => r.tag),
        unknown: results.filter((r) => !r.ok && r.status === 404).map((r) => r.epc),
        failed: results.filter((r) => !r.ok && r.status !== 404).map(({ epc, error }) => ({ epc, error })),
    };
}

// ---------- stock ----------

// Confirmed response: { "balance": 3, "sku": "BS4", "storeId": "12", "storeName": "MidValley" }
export async function getSkuBalance(auth, sku, storeId) {
    const data = expectOk(
        await request({ path: 'Stock/SkuBalance', query: { sku, storeId }, auth }),
        'Stock/SkuBalance',
        { errorStatus: 404 },
    );
    const balance = Number(data?.balance);
    if (!Number.isFinite(balance)) throw new HttpError(502, 'Team API returned an invalid balance');
    return { sku: data.sku ?? sku, store_id: String(data.storeId ?? storeId), store_name: data.storeName ?? null, balance };
}
