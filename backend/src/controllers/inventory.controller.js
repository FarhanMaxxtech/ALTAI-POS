// Thin on purpose: take the validated input, call the service, send JSON.
import * as locations from '../services/inventory/location.service.js';
import * as stock from '../services/inventory/stock.service.js';
import * as rfid from '../services/inventory/rfid.service.js';

// ---------- locations ----------

export async function listLocations(req, res) {
    res.json({ ok: true, locations: await locations.listLocations() });
}

export async function createLocation(req, res) {
    res.status(201).json({ ok: true, location: await locations.createLocation(req.valid.body) });
}

export async function updateLocation(req, res) {
    res.json({ ok: true, location: await locations.updateLocation(req.valid.params.id, req.valid.body) });
}

// ---------- stock ----------

export async function getStock(req, res) {
    res.json({ ok: true, stock: await stock.getStock(req.valid.query) });
}

export async function listMovements(req, res) {
    res.json({ ok: true, movements: await stock.listMovements(req.valid.query) });
}

export async function receive(req, res) {
    res.status(201).json({ ok: true, movements: await stock.receive(req.valid.body) });
}

export async function adjust(req, res) {
    res.status(201).json({ ok: true, movement: await stock.adjust(req.valid.body) });
}

export async function transfer(req, res) {
    res.status(201).json({ ok: true, ...(await stock.transfer(req.valid.body)) });
}

export async function count(req, res) {
    res.status(201).json({ ok: true, variances: await stock.count(req.valid.body) });
}

// ---------- RFID ----------

export async function registerTags(req, res) {
    res.status(201).json({ ok: true, tags: await rfid.registerTags(req.valid.body) });
}

export async function resolveTags(req, res) {
    res.json({ ok: true, ...(await rfid.resolveTags(req.valid.body.epcs)) });
}

export async function updateTag(req, res) {
    res.json({ ok: true, tag: await rfid.updateTag(req.valid.params.epc, req.valid.body) });
}
