// Thin on purpose: validated input → team API adapter → JSON.
import * as altai from '../services/integrations/altai-api/index.js';

export async function login(req, res) {
    res.json({ ok: true, ...(await altai.login(req.valid.body)) });
}

// Lets the web app check, after a page reload, whether its saved token still works.
export async function me(req, res) {
    res.json({ ok: true, merchant_id: req.auth.merchantId, permissions: await altai.getPermissions(req.auth) });
}

export async function listStores(req, res) {
    res.json({ ok: true, stores: await altai.listStores(req.auth) });
}

export async function lookupTags(req, res) {
    const { epcs, store_id, op_type } = req.valid.body;
    res.json({ ok: true, ...(await altai.lookupTags(req.auth, epcs, { storeId: store_id, opType: op_type })) });
}

export async function skuBalance(req, res) {
    const { sku, store_id } = req.valid.query;
    res.json({ ok: true, ...(await altai.getSkuBalance(req.auth, sku, store_id)) });
}
