// Thin on purpose: checked input → customer/campaign service → JSON.
// req.user (who is asking) comes from requireSession.
import * as customers from '../services/customers/customer.service.js';
import * as campaigns from '../services/customers/campaign.service.js';

// ---------- customers ----------

export async function list(req, res) {
    res.json({ ok: true, customers: await customers.listCustomers(req.user, req.valid.query) });
}
export async function show(req, res) {
    res.json({ ok: true, customer: await customers.getCustomer(req.user, req.valid.params.id) });
}
export async function create(req, res) {
    res.status(201).json({ ok: true, customer: await customers.createCustomer(req.user, req.valid.body) });
}
export async function update(req, res) {
    res.json({ ok: true, customer: await customers.updateCustomer(req.user, req.valid.params.id, req.valid.body) });
}
export async function consent(req, res) {
    res.json({ ok: true, customer: await customers.setConsent(req.user, req.valid.params.id, req.valid.body) });
}
export async function erase(req, res) {
    res.json({ ok: true, customer: await customers.eraseCustomer(req.user, req.valid.params.id) });
}

// ---------- campaigns ----------

export async function listCampaigns(req, res) {
    res.json({ ok: true, campaigns: await campaigns.listCampaigns(req.user, req.valid.query) });
}
export async function showCampaign(req, res) {
    res.json({ ok: true, campaign: await campaigns.getCampaign(req.user, req.valid.params.id) });
}
export async function createCampaign(req, res) {
    res.status(201).json({ ok: true, campaign: await campaigns.createCampaign(req.user, req.valid.body) });
}
export async function updateCampaign(req, res) {
    res.json({ ok: true, campaign: await campaigns.updateCampaign(req.user, req.valid.params.id, req.valid.body) });
}
export async function previewCampaign(req, res) {
    res.json({ ok: true, ...(await campaigns.previewCampaign(req.user, req.valid.params.id)) });
}
export async function sendCampaign(req, res) {
    res.json({ ok: true, campaign: await campaigns.sendCampaign(req.user, req.valid.params.id) });
}
export async function campaignMessages(req, res) {
    res.json({ ok: true, messages: await campaigns.listMessages(req.user, req.valid.params.id, req.valid.query) });
}
