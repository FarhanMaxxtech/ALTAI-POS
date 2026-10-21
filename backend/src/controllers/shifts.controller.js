// Thin on purpose: take the checked input, call the shift service, send JSON back.
// req.user (who is asking) and req.auth (their team-API session) come from requireSession.
import * as shifts from '../services/shifts/shift.service.js';

export async function list(req, res) {
    res.json({ ok: true, shifts: await shifts.listShifts(req.user, req.valid.query) });
}

export async function current(req, res) {
    res.json({ ok: true, shift: await shifts.getCurrentShift(req.user, req.valid.query) });
}

export async function show(req, res) {
    res.json({ ok: true, shift: await shifts.getShift(req.user, req.valid.params.id) });
}

export async function open(req, res) {
    res.status(201).json({ ok: true, shift: await shifts.openShift(req.user, req.auth, req.valid.body) });
}

export async function addMovement(req, res) {
    res.status(201).json({ ok: true, shift: await shifts.addMovement(req.user, req.valid.params.id, req.valid.body) });
}

export async function close(req, res) {
    res.json({ ok: true, shift: await shifts.closeShift(req.user, req.valid.params.id, req.valid.body) });
}
