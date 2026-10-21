import HttpError from '../../../lib/httpError.js';
import { request, expectOk } from './client.js';

// READ-ONLY inventory from the team's API: stock per store, and the history of transfers,
// stock counts and adjustments. Nothing here changes stock. Approving, voiding and creating stay
// in the team's own website (decision 006).
//
// Field names: EpcList is documented in the rfid_counter app. The transaction lists/details are
// not: that app treats them as unnamed data. So `normalizeTransaction` tries the likely names and
// keeps the original as `raw`. In development, the backend log prints each response's real field
// names once ("[team API shape] …"): use it to confirm and tighten the mapping.

// ---------- stock levels (Stock/EpcList: one row per physical tagged item) ----------

const PAGE_SIZE = 200;   // what the rfid_counter app uses
const MAX_PAGES = 50;    // = 10,000 tags per store; beyond that we say the list is incomplete
const CACHE_MS = 60_000; // re-use a store's list for 60 s, so page reloads don't flood their server
const cache = new Map(); // "<merchantId>|<storeId>" → { at, tags, total, complete }

function mapEpcRow(r) {
    return {
        epc: String(r.epc ?? '').toUpperCase(),
        sku: r.sku ?? null,
        product_name: r.productName ?? null,
        product_code: r.productCode ?? null,
        variation: r.varLabel ?? null,
        status: r.status === undefined || r.status === null ? 'unknown' : String(r.status),
        store_id: r.storeId === undefined || r.storeId === null ? null : String(r.storeId),
        store_name: r.storeName ?? null,
    };
}

async function fetchEpcPage(auth, storeId, page) {
    const data = expectOk(
        await request({ method: 'POST', path: 'Stock/EpcList', auth, body: { epc: '', productName: '', storeId, page, pageSize: PAGE_SIZE } }),
        'Stock/EpcList',
    );
    return { rows: (data?.data ?? []).map(mapEpcRow), total: Number(data?.recordsTotal ?? 0) };
}

// Every tagged item in one store (all pages), from the cache when it's fresh.
export async function storeTags(auth, storeId, { refresh = false } = {}) {
    const key = `${auth.merchantId}|${storeId}`;
    const hit = cache.get(key);
    if (hit && !refresh && Date.now() - hit.at < CACHE_MS) return { ...hit, cached: true };

    const tags = [];
    let total = 0;
    let complete = false;
    for (let page = 1; page <= MAX_PAGES; page++) {
        const result = await fetchEpcPage(auth, storeId, page);
        tags.push(...result.rows);
        total = result.total || tags.length;
        if (tags.length >= total || result.rows.length < PAGE_SIZE) { complete = true; break; }
    }

    const entry = { at: Date.now(), tags, total, complete };
    cache.set(key, entry);
    if (cache.size > 100) cache.delete(cache.keys().next().value); // keep the cache small: drop the oldest
    return { ...entry, cached: false };
}

// Stock per SKU in one store: how many tags, split by their status in the team's system.
// q matches part of the SKU, product name or product code.
export async function stockLevels(auth, storeId, { q, refresh } = {}) {
    const { tags, total, complete, at, cached } = await storeTags(auth, storeId, { refresh });
    const needle = q?.trim().toLowerCase();

    const bySku = new Map();
    for (const tag of tags) {
        const key = tag.sku ?? `(no SKU) ${tag.product_code ?? ''}`;
        if (!bySku.has(key)) {
            bySku.set(key, { sku: tag.sku, product_name: tag.product_name, product_code: tag.product_code, variation: tag.variation, total: 0, by_status: {} });
        }
        const row = bySku.get(key);
        row.total += 1;
        row.by_status[tag.status] = (row.by_status[tag.status] ?? 0) + 1;
    }

    let rows = [...bySku.values()];
    if (needle) {
        rows = rows.filter((r) => [r.sku, r.product_name, r.product_code].some((v) => v?.toLowerCase().includes(needle)));
    }
    rows.sort((a, b) => (a.product_name ?? '').localeCompare(b.product_name ?? '') || (a.sku ?? '').localeCompare(b.sku ?? ''));

    const statuses = [...new Set(tags.map((t) => t.status))].sort();
    return {
        store_id: storeId,
        as_of: new Date(at).toISOString(),
        from_cache: cached,
        complete,               // false = the store has more than 10,000 tags; only the first 10,000 are counted
        tag_count: tags.length,
        reported_total: total,  // what the team's API says the store has in total
        statuses,
        skus: rows,
    };
}

// The individual tags of one SKU in one store (from the same cached list).
export async function skuTags(auth, storeId, sku) {
    const { tags } = await storeTags(auth, storeId);
    return tags.filter((t) => t.sku === sku);
}

// Search a store's tags by part of the EPC, the SKU or the product name (from the cached list).
// Returns at most `limit` tags, plus how many matched in total.
export async function searchStoreTags(auth, storeId, q, { limit = 500 } = {}) {
    const { tags } = await storeTags(auth, storeId);
    const needle = q.trim().toLowerCase();
    const matches = tags.filter((t) => [t.epc, t.sku, t.product_name].some((v) => v?.toLowerCase().includes(needle)));
    return { total: matches.length, tags: matches.slice(0, limit) };
}

// ---------- tag inspector ----------

// The status of ONE tag in its store, with a small targeted query (EpcList filtered by EPC)
// instead of downloading the whole store. null when the team's API doesn't list it there.
async function tagStatus(auth, storeId, epc) {
    const data = expectOk(
        await request({ method: 'POST', path: 'Stock/EpcList', auth, body: { epc, productName: '', storeId, page: 1, pageSize: 10 } }),
        'Stock/EpcList',
    );
    // The filter may match partially, so pick the exact EPC.
    const row = (data?.data ?? []).map(mapEpcRow).find((r) => r.epc === epc.toUpperCase());
    return row?.status ?? null;
}

// Everything we can tell about each tag: what it is (TagLookup), where it is, its status there
// (EpcList), and whether an unfinished transfer/count holds it. At most 3 status queries run at once.
export async function inspectTags(auth, epcs, lookupTags) {
    const { tags, unknown, failed } = await lookupTags(auth, epcs);
    const results = tags.map((t) => ({ ...t, found: true, status: null }));

    let next = 0;
    const worker = async () => {
        while (next < results.length) {
            const r = results[next++];
            if (!r.store_id) continue; // not in any store (e.g. never stocked in): no status to look up
            try {
                r.status = await tagStatus(auth, r.store_id, r.epc);
            } catch (err) {
                if (err.status === 401 || err.status === 503) throw err; // session/config problems stop everything
                r.status_error = err.message;
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(3, results.length) }, worker));

    // Keep the order the user typed them in.
    const byEpc = new Map([
        ...results.map((r) => [r.epc, r]),
        ...unknown.map((epc) => [epc, { epc, found: false }]),
        ...failed.map((f) => [f.epc, { epc: f.epc, found: null, error: f.error }]),
    ]);
    return epcs.map((epc) => byEpc.get(epc) ?? { epc, found: null, error: 'No answer' });
}

// ---------- transfers, stock counts, adjustments ----------

const pick = (obj, ...keys) => {
    for (const k of keys) if (obj?.[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    return null;
};

// The likely field names, best guess first. Unknown ones stay in `raw`.
export function normalizeTransaction(r) {
    const items = pick(r, 'items', 'details', 'lines', 'products', 'epcs');
    const quantity = pick(r, 'totalQty', 'qty', 'quantity', 'epcCount', 'itemCount', 'total');
    return {
        id: String(pick(r, 'id', 'trxId', 'transactionId') ?? ''),
        reference: pick(r, 'trxNo', 'referenceNo', 'docNo', 'code'),
        date: pick(r, 'trxDate', 'date', 'createdAt', 'createdDate', 'createDate'),
        type: pick(r, 'trxType', 'type', 'typeName'),
        status: pick(r, 'status', 'statusName', 'statusText'),
        store_name: pick(r, 'storeName', 'fromStoreName', 'fromStore'),
        to_store_name: pick(r, 'toStoreName', 'toStore'),
        quantity: quantity === null ? (Array.isArray(items) ? items.length : null) : Number(quantity),
        remark: pick(r, 'remark', 'remarks', 'note'),
        created_by: pick(r, 'createdBy', 'createdByName', 'userName', 'user'),
        raw: r,
    };
}

// Lines of a transaction detail, in one shape: the EPC, SKU, product and variation when present.
function normalizeLines(detail) {
    const items = pick(detail, 'items', 'details', 'lines', 'products', 'epcs') ?? [];
    if (!Array.isArray(items)) return [];
    return items.map((it) => (typeof it === 'string'
        ? { epc: it, sku: null, product_name: null, variation: null, quantity: 1, status: null }
        : {
            epc: pick(it, 'epc'),
            sku: pick(it, 'sku'),
            product_name: pick(it, 'productName', 'name'),
            variation: pick(it, 'varLabel', 'variation'),
            quantity: Number(pick(it, 'qty', 'quantity') ?? 1),
            status: pick(it, 'status'),
        }));
}

// The three kinds, and their endpoints and filter names as the team's app uses them.
const KINDS = {
    transfers:   { list: 'Stock/TransferList',   info: 'Stock/TransferInfo',   storeParam: 'fromStoreId' },
    counts:      { list: 'Stock/StockCountList', info: 'Stock/StockCountInfo', storeParam: 'storeId' },
    adjustments: { list: 'Stock/AdjustmentList', info: 'Stock/AdjustmentInfo', storeParam: 'storeId' },
};

export async function listTransactions(auth, kind, { storeId, dateFrom, dateTo, status }) {
    const k = KINDS[kind];
    const data = expectOk(
        await request({ path: k.list, auth, query: { [k.storeParam]: storeId, dateFrom, dateTo, status } }),
        k.list,
    );
    const list = data?.data ?? data?.list ?? (Array.isArray(data) ? data : []);
    return list.map(normalizeTransaction);
}

export async function transactionDetail(auth, kind, id) {
    const k = KINDS[kind];
    const data = expectOk(await request({ path: k.info, auth, query: { id } }), k.info, { errorStatus: 404 });
    const detail = data?.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : data;
    if (!detail || typeof detail !== 'object') throw new HttpError(502, `Team API returned an unexpected ${k.info} response`);
    return { ...normalizeTransaction(detail), lines: normalizeLines(detail) };
}

// For tests: forget cached store lists.
export function clearStockCache() {
    cache.clear();
}
