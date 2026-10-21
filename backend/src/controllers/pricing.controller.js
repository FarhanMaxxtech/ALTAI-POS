// Thin on purpose: checked input → pricing/settings service → JSON.
// req.user (who) and req.auth (their team-API session, for store access checks) come from requireSession.
import * as settings from '../services/pricing/settings.service.js';
import * as prices from '../services/pricing/price.service.js';

// ---------- settings ----------

export async function getBusiness(req, res) {
    res.json({ ok: true, settings: await settings.getBusinessSettings(req.user) });
}
export async function updateBusiness(req, res) {
    res.json({ ok: true, settings: await settings.updateBusinessSettings(req.user, req.valid.body) });
}
export async function getStore(req, res) {
    res.json({ ok: true, settings: await settings.getStoreSettings(req.user, req.auth, req.valid.params.storeId) });
}
export async function updateStore(req, res) {
    res.json({ ok: true, settings: await settings.updateStoreSettings(req.user, req.auth, req.valid.params.storeId, req.valid.body) });
}

// ---------- prices ----------

export async function list(req, res) {
    res.json({ ok: true, prices: await prices.listPrices(req.user, req.valid.query) });
}
export async function set(req, res) {
    res.json({ ok: true, price: await prices.setPrice(req.user, req.auth, req.valid.params.sku, req.valid.body) });
}
export async function remove(req, res) {
    res.json({ ok: true, ...(await prices.removePrice(req.user, req.auth, req.valid.params.sku, req.valid.query)) });
}
export async function bulk(req, res) {
    res.json({ ok: true, ...(await prices.bulkSetPrice(req.user, req.auth, req.valid.body)) });
}
export async function history(req, res) {
    res.json({ ok: true, history: await prices.priceHistory(req.user, req.valid.params.sku) });
}
export async function resolve(req, res) {
    res.json({ ok: true, ...(await prices.resolvePrices(req.user, req.auth, req.valid.body)) });
}
