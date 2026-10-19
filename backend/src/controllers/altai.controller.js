// Thin on purpose: validated input → team API adapter → JSON.
import * as altai from '../services/integrations/altai-api/index.js';

export async function login(req, res) {
    const { session } = await altai.login(req.valid.body.login_id, req.valid.body.password);
    res.json({ ok: true, token: session });
}

export async function listStores(req, res) {
    res.json({ ok: true, stores: await altai.listStores(req.session) });
}

export async function lookupTags(req, res) {
    const { epcs, store_id, op_type } = req.valid.body;
    res.json({ ok: true, ...(await altai.lookupTags(req.session, epcs, { storeId: store_id, opType: op_type })) });
}

export async function skuBalance(req, res) {
    const { sku, store_id } = req.valid.query;
    res.json({ ok: true, ...(await altai.getSkuBalance(req.session, sku, store_id)) });
}
