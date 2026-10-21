// Thin on purpose: checked input → read-only team-API product adapter → JSON.
// Asking for balances at a store first checks the user may see that store.
import * as products from '../services/integrations/altai-api/products.js';
import { assertStoreAccess } from '../services/pricing/settings.service.js';

export async function list(req, res) {
    const { q, code, sku, active, store_id: storeId, skus, page, page_size: pageSize } = req.valid.query;
    if (storeId) await assertStoreAccess(req.auth, storeId);
    const result = await products.listProducts(req.auth, {
        name: q, code, sku, active, storeId, includeSkus: skus === '1', page, pageSize,
    });
    res.json({ ok: true, ...result });
}

export async function show(req, res) {
    const storeId = req.valid.query.store_id;
    if (storeId) await assertStoreAccess(req.auth, storeId);
    res.json({ ok: true, product: await products.productInfo(req.auth, req.valid.params.productId, { storeId }) });
}
