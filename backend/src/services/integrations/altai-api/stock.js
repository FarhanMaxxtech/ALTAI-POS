import HttpError from '../../../lib/httpError.js';
import { request, expectOk } from './client.js';

// READ-ONLY inventory from the team's API: stock per store, and the history of transfers,
// stock counts, adjustments and checkouts. Nothing here changes stock. Creating, approving and
// voiding stay in the team's own website (decision 006).
//
// Field names follow the team's Postman docs (summarised in docs/api/team-api-reference.md).
// Each record also keeps the original as `raw`, and in development the backend log prints each
// response's real field names once ("[team API shape] …") so differences show up quickly.

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

// Everything we can tell about each tag, in TWO kinds of call instead of two per tag:
//   - ONE EpcList call with the whole list (`epcs`): where each tag is and its status, plus
//     `notFound` for tags the system doesn't know (documented in docs/api/team-api-reference.md)
//   - TagLookup per tag (max 5 at once, see lookupTags): what it is, and whether an unfinished
//     transfer/count/adjustment holds it (EpcList doesn't say that)
export async function inspectTags(auth, epcs, lookupTags) {
    const [lookup, list] = await Promise.all([
        lookupTags(auth, epcs),
        request({ method: 'POST', path: 'Stock/EpcList', auth, body: { epc: '', productName: '', storeId: '', page: 1, pageSize: epcs.length, epcs } })
            .then((res) => expectOk(res, 'Stock/EpcList'))
            .catch((err) => {
                if (err.status === 401 || err.status === 503) throw err; // session/config problems stop everything
                return { error: err.message };
            }),
    ]);

    const statusByEpc = new Map((list.data ?? []).map(mapEpcRow).map((r) => [r.epc, r]));
    const results = lookup.tags.map((t) => {
        const row = statusByEpc.get(t.epc);
        return {
            ...t,
            found: true,
            status: row?.status ?? null,
            // EpcList also knows the store; prefer it when TagLookup didn't say
            store_id: t.store_id ?? row?.store_id ?? null,
            store_name: t.store_name ?? row?.store_name ?? null,
            ...(list.error ? { status_error: list.error } : {}),
        };
    });

    // Keep the order the user typed them in.
    const byEpc = new Map([
        ...results.map((r) => [r.epc, r]),
        ...lookup.unknown.map((epc) => [epc, { epc, found: false }]),
        ...lookup.failed.map((f) => [f.epc, { epc: f.epc, found: null, error: f.error }]),
    ]);
    return epcs.map((epc) => byEpc.get(epc) ?? { epc, found: null, error: 'No answer' });
}

// ---------- transfers, stock counts, adjustments, checkouts ----------
// Field names as documented (docs/api/team-api-reference.md). The original record stays in `raw`.

const pick = (obj, ...keys) => {
    for (const k of keys) if (obj?.[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    return null;
};
const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

// Codes the docs explain. Everything else is shown as "Status <code>" until the team tells us more.
const STATUS_NAMES = { counts: { 10: 'Pending Review', 30: 'Approved' } };
const TYPE_NAMES = { ADI: 'Stock in', ADO: 'Stock out', TFO: 'Out of source store', TFI: 'Into destination store' };

function statusLabel(kind, r) {
    const code = pick(r, 'status');
    return pick(r, 'statusName') ?? STATUS_NAMES[kind]?.[code] ?? (code === null ? null : `Status ${code}`);
}

export function normalizeTransaction(kind, r) {
    const type = pick(r, 'trxType');
    return {
        id: String(pick(r, 'id', 'trxId') ?? ''),     // what TransferInfo/…Info?id= expects
        trx_id: pick(r, 'trxId'),                      // the team's own transaction number
        // What staff recognise: a stock count's refno (FS4-SCA000006), else the transaction number, else the id.
        reference: String(pick(r, 'refno', 'trxId', 'id') ?? ''),
        date: pick(r, 'trxDate'),
        status: pick(r, 'status'),                     // the raw code (1, 10, 30, "Y"…)
        status_label: statusLabel(kind, r),
        type,                                          // ADI / ADO (adjustments)
        type_label: type ? (TYPE_NAMES[type] ?? type) : null,
        store_id: pick(r, 'storeId', 'fromStoreId')?.toString() ?? null,
        store_name: pick(r, 'storeName', 'fromStoreName'),
        store_code: pick(r, 'fromStoreCode', 'storeCode'),
        to_store_name: pick(r, 'toStoreName'),
        to_store_code: pick(r, 'toStoreCode'),
        remark: pick(r, 'remark'),
        // Stock counts carry totals in the list; the others only have quantities in their lines.
        totals: kind === 'counts'
            ? { counted: num(r.totalCounted), expected: num(r.totalExpected), variance: num(r.totalVariance) }
            : null,
        raw: r,
    };
}

// Detail lines are per SKU (not per tag), with quantity fields that depend on the kind.
function normalizeLine(it) {
    return {
        sku: pick(it, 'sku'),
        product_code: pick(it, 'productCode'),
        product_name: pick(it, 'productName'),
        variation: pick(it, 'varLabel'),
        qty: num(it.qty),               // transfers, checkouts
        qty_in: num(it.qtyIn),          // adjustments
        qty_out: num(it.qtyOut),        // adjustments
        counted: num(it.counted),       // stock counts
        expected: num(it.expected),     // stock counts
        variance: num(it.variance),     // stock counts
        line_type: pick(it, 'trxType'), // transfers: TFO (out of source) / TFI (into destination)
    };
}

// The number of items in a detail, counted once (a transfer lists each SKU twice: TFO and TFI).
function itemCount(kind, lines, header) {
    if (kind === 'counts') return header.totals?.counted ?? lines.reduce((s, l) => s + (l.counted ?? 0), 0);
    if (kind === 'adjustments') return lines.reduce((s, l) => s + (l.qty_in ?? 0) + (l.qty_out ?? 0), 0);
    if (kind === 'transfers') return lines.filter((l) => l.line_type !== 'TFI').reduce((s, l) => s + (l.qty ?? 0), 0);
    return lines.reduce((s, l) => s + (l.qty ?? 0), 0);
}

// The four kinds and their documented endpoints. Transfers are filtered by their SOURCE store.
const KINDS = {
    transfers:   { list: 'Stock/TransferList',   info: 'Stock/TransferInfo',   storeParam: 'fromStoreId' },
    counts:      { list: 'Stock/StockCountList', info: 'Stock/StockCountInfo', storeParam: 'storeId' },
    adjustments: { list: 'Stock/AdjustmentList', info: 'Stock/AdjustmentInfo', storeParam: 'storeId' },
    checkouts:   { list: 'Stock/CheckoutList',   info: 'Stock/CheckoutInfo',   storeParam: 'storeId' },
};

// The team's list endpoints only filter by store and date, so the optional status filter is applied
// here: it matches the code ("30") or part of the label ("approved").
export async function listTransactions(auth, kind, { storeId, dateFrom, dateTo, status }) {
    const k = KINDS[kind];
    const data = expectOk(
        await request({ path: k.list, auth, query: { [k.storeParam]: storeId, dateFrom, dateTo } }),
        k.list,
    );
    const list = (data?.data ?? (Array.isArray(data) ? data : [])).map((r) => normalizeTransaction(kind, r));
    if (!status) return list;
    const needle = status.trim().toLowerCase();
    return list.filter((t) => String(t.status).toLowerCase() === needle || t.status_label?.toLowerCase().includes(needle));
}

export async function transactionDetail(auth, kind, id) {
    const k = KINDS[kind];
    const data = expectOk(await request({ path: k.info, auth, query: { id } }), k.info, { errorStatus: 404 });
    const detail = data?.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : data;
    if (!detail || typeof detail !== 'object') throw new HttpError(502, `Team API returned an unexpected ${k.info} response`);
    const header = normalizeTransaction(kind, detail);
    const lines = Array.isArray(detail.lines) ? detail.lines.map(normalizeLine) : [];
    return { ...header, lines, item_count: itemCount(kind, lines, header) };
}

// For tests: forget cached store lists.
export function clearStockCache() {
    cache.clear();
}
