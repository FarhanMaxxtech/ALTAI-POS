import db from '../../db/index.js';
import HttpError from '../../lib/httpError.js';

// ======================================================================
// The ONLY place that changes stock. Every receive, adjust, count, transfer
// (and later every sale and return) goes through applyChanges().
//
// Why it's safe when two tills sell the same item at the same moment:
//   1. Everything runs inside one DB transaction.
//   2. Each stock row is locked with SELECT ... FOR UPDATE before we read it,
//      so a second request waits until the first commits. No lost updates.
//   3. Rows are always locked in the same order (location_id, variant_id).
//      If request A locked X then Y while request B locked Y then X, each would
//      wait for the other forever (a "deadlock"). A fixed order prevents that.
//   4. The movement row and the new balance are written together, so the
//      ledger and stock_levels can never disagree.
// ======================================================================

const key = (locationId, variantId) => `${locationId}:${variantId}`;

// Lock the stock rows for these location × variant pairs and return their current quantities.
async function lockRows(trx, pairs) {
    const unique = [...new Map(pairs.map((p) => [key(p.location_id, p.variant_id), p])).values()]
        .sort((a, b) => a.location_id - b.location_id || a.variant_id - b.variant_id);

    const current = new Map();
    for (const { location_id, variant_id } of unique) {
        const lockRow = () => trx('stock_levels').where({ location_id, variant_id }).forUpdate().first('quantity');
        let row = await lockRow();
        if (!row) {
            // First time this item is stocked here: create the row at 0, then lock it.
            // (If another request creates it at the same moment, the conflict is ignored.)
            await trx('stock_levels').insert({ location_id, variant_id, quantity: 0 }).onConflict(['location_id', 'variant_id']).ignore();
            row = await lockRow();
        }
        current.set(key(location_id, variant_id), row.quantity);
    }
    return current;
}

// changes: [{ location_id, variant_id, quantity_change, type, reason?, reference_type?, reference_id? }]
// Must be called with a transaction (trx). Returns the inserted movement rows.
export async function applyChanges(trx, changes) {
    const balances = await lockRows(trx, changes);
    const movements = [];

    for (const c of changes) {
        const k = key(c.location_id, c.variant_id);
        const available = balances.get(k);
        const next = available + c.quantity_change;

        if (next < 0) {
            throw new HttpError(409, 'Insufficient stock', [{
                location_id: c.location_id, variant_id: c.variant_id, available, requested: -c.quantity_change,
            }]);
        }

        await trx('stock_levels').where({ location_id: c.location_id, variant_id: c.variant_id })
            .update({ quantity: next, updated_at: trx.fn.now() });
        balances.set(k, next);

        const [movement] = await trx('stock_movements').insert({
            location_id: c.location_id,
            variant_id: c.variant_id,
            type: c.type,
            quantity_change: c.quantity_change,
            balance_after: next,
            reason: c.reason ?? null,
            reference_type: c.reference_type ?? null,
            reference_id: c.reference_id ?? null,
            created_by: c.created_by ?? null,
        }).returning('*');
        movements.push(movement);
    }
    return movements;
}

async function assertActiveLocations(trx, ids) {
    const rows = await trx('locations').whereIn('id', ids).select('id', 'status');
    for (const id of ids) {
        const loc = rows.find((r) => Number(r.id) === id);
        if (!loc) throw new HttpError(400, `Location ${id} does not exist`);
        if (loc.status !== 'active') throw new HttpError(409, `Location ${id} is archived`);
    }
}

// ---------- operations ----------

export async function receive({ location_id, lines, reason }) {
    return db.transaction(async (trx) => {
        await assertActiveLocations(trx, [location_id]);
        return applyChanges(trx, lines.map((l) => ({
            location_id, variant_id: l.variant_id, quantity_change: l.quantity, type: 'receive', reason,
        })));
    });
}

export async function adjust({ location_id, variant_id, quantity_change, reason }) {
    return db.transaction(async (trx) => {
        await assertActiveLocations(trx, [location_id]);
        const [movement] = await applyChanges(trx, [{ location_id, variant_id, quantity_change, type: 'adjust', reason }]);
        return movement;
    });
}

export async function transfer({ from_location_id, to_location_id, lines, reason }) {
    return db.transaction(async (trx) => {
        await assertActiveLocations(trx, [from_location_id, to_location_id]);
        const [{ id }] = await trx('stock_transfers').insert({ from_location_id, to_location_id, reason }).returning('id');
        const ref = { reference_type: 'transfer', reference_id: id, reason };
        const movements = await applyChanges(trx, lines.flatMap((l) => [
            { ...ref, location_id: from_location_id, variant_id: l.variant_id, quantity_change: -l.quantity, type: 'transfer_out' },
            { ...ref, location_id: to_location_id, variant_id: l.variant_id, quantity_change: l.quantity, type: 'transfer_in' },
        ]));
        return { transfer_id: Number(id), movements };
    });
}

// Stock take: staff count what's physically on the shelf; the system adjusts to match
// and reports the difference ("variance") per item.
export async function count({ location_id, lines, reason }) {
    return db.transaction(async (trx) => {
        await assertActiveLocations(trx, [location_id]);
        const expected = await lockRows(trx, lines.map((l) => ({ location_id, variant_id: l.variant_id })));

        const variances = lines.map((l) => {
            const before = expected.get(key(location_id, l.variant_id));
            return { variant_id: l.variant_id, expected: before, counted: l.counted_quantity, difference: l.counted_quantity - before };
        });

        // Only items that differ produce a movement (a movement of 0 isn't allowed).
        await applyChanges(trx, variances.filter((v) => v.difference !== 0).map((v) => ({
            location_id, variant_id: v.variant_id, quantity_change: v.difference, type: 'count', reason: reason ?? 'Stock count',
        })));
        return variances;
    });
}

// ---------- reads ----------

export async function getStock({ location_id, variant_id, sku }) {
    const q = db('stock_levels as s')
        .join('variants as v', 'v.id', 's.variant_id')
        .join('products as p', 'p.id', 'v.product_id')
        .join('locations as l', 'l.id', 's.location_id')
        .select('s.location_id', 'l.code as location_code', 's.variant_id', 'v.sku', 'p.name as product_name',
            'v.color', 'v.size', 's.quantity', 's.updated_at')
        .orderBy(['l.code', 'v.sku']);
    if (location_id) q.where('s.location_id', location_id);
    if (variant_id) q.where('s.variant_id', variant_id);
    if (sku) q.where('v.sku', sku.toUpperCase());
    return q;
}

export async function listMovements({ location_id, variant_id, limit, offset }) {
    const q = db('stock_movements').orderBy('id', 'desc').limit(limit).offset(offset);
    if (location_id) q.where({ location_id });
    if (variant_id) q.where({ variant_id });
    return q;
}
