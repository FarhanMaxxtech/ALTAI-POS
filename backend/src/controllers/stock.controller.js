// Thin on purpose: checked input → read-only team-API stock adapter → JSON.
// Every call that names a store first checks the user may see it (the team API's store list decides).
import * as stock from '../services/integrations/altai-api/stock.js';
import { lookupTags } from '../services/integrations/altai-api/index.js';
import { assertStoreAccess } from '../services/pricing/settings.service.js';

export async function levels(req, res) {
    const { store_id: storeId, q, refresh } = req.valid.query;
    await assertStoreAccess(req.auth, storeId);
    res.json({ ok: true, ...(await stock.stockLevels(req.auth, storeId, { q, refresh: Boolean(refresh) })) });
}

// The tags of one SKU (?sku=), or a search across a store's tags (?q=).
export async function storeTags(req, res) {
    const { store_id: storeId, sku, q } = req.valid.query;
    await assertStoreAccess(req.auth, storeId);
    if (sku) return res.json({ ok: true, tags: await stock.skuTags(req.auth, storeId, sku) });
    res.json({ ok: true, ...(await stock.searchStoreTags(req.auth, storeId, q)) });
}

// Tag inspector: everything known about each tag. The team API only answers for this merchant's tags.
export async function inspect(req, res) {
    res.json({ ok: true, tags: await stock.inspectTags(req.auth, req.valid.body.epcs, lookupTags) });
}

export async function transactions(req, res) {
    const { store_id: storeId, from, to, status } = req.valid.query;
    await assertStoreAccess(req.auth, storeId);
    const list = await stock.listTransactions(req.auth, req.valid.params.kind, { storeId, dateFrom: from, dateTo: to, status });
    res.json({ ok: true, from, to, transactions: list });
}

export async function transaction(req, res) {
    const { kind, id } = req.valid.params;
    res.json({ ok: true, transaction: await stock.transactionDetail(req.auth, kind, id) });
}
