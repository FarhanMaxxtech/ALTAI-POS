import db from '../../db/index.js';
import HttpError from '../../lib/httpError.js';

// RFID tags identify ONE physical item (unlike a barcode, which is the same on every Black/M tee).
// Registering or reading a tag never changes stock quantities. Quantities only change through
// stock.service.js. Tags answer "which exact items are where?"; stock_levels answers "how many?".

// Commission (register) tags that were just encoded/attached to items of one variant.
export async function registerTags({ epcs, variant_id, location_id = null }) {
    const rows = epcs.map((epc) => ({ epc, variant_id, location_id, status: 'in_stock' }));
    // A duplicate EPC → unique violation → 409 via errorHandler.
    return db('rfid_tags').insert(rows).returning(['epc', 'variant_id', 'location_id', 'status']);
}

// What the till / handheld calls after reading many tags at once.
// Returns what each EPC is, plus the EPCs we don't know.
export async function resolveTags(epcs) {
    const found = await db('rfid_tags as t')
        .join('variants as v', 'v.id', 't.variant_id')
        .join('products as p', 'p.id', 'v.product_id')
        .whereIn('t.epc', epcs)
        .select('t.epc', 't.status', 't.location_id', 't.last_seen_at',
            'v.id as variant_id', 'v.sku', 'v.color', 'v.size', 'p.name as product_name',
            db.raw('coalesce(v.price, p.base_price) as effective_price'));

    const known = new Set(found.map((t) => t.epc));
    return { tags: found, unknown: epcs.filter((e) => !known.has(e)) };
}

// e.g. mark as missing after a count, or move to another location.
export async function updateTag(epc, changes) {
    const [row] = await db('rfid_tags').where({ epc })
        .update({ ...changes, updated_at: db.fn.now() })
        .returning(['epc', 'variant_id', 'location_id', 'status', 'last_seen_at']);
    if (!row) throw new HttpError(404, `Tag ${epc} not registered`);
    return row;
}
