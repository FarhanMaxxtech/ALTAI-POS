// Thin on purpose: checked input → read-only team-API stock adapter → JSON.
// Every call first checks the user may see that store (the team API's store list decides).
import * as stock from '../services/integrations/altai-api/stock.js';
import { assertStoreAccess } from '../services/pricing/settings.service.js';

export async function levels(req, res) {
    const { store_id: storeId, q, refresh } = req.valid.query;
    await assertStoreAccess(req.auth, storeId);
    res.json({ ok: true, ...(await stock.stockLevels(req.auth, storeId, { q, refresh: Boolean(refresh) })) });
}

export async function skuTags(req, res) {
    const { store_id: storeId, sku } = req.valid.query;
    await assertStoreAccess(req.auth, storeId);
    res.json({ ok: true, tags: await stock.skuTags(req.auth, storeId, sku) });
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
