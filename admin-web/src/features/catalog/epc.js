// Helper functions for working with RFID tag codes (EPCs).
//
// In plain words: an EPC is the unique code stored inside one RFID tag. Every physical item
// has its own EPC, even two identical T-shirts. These functions don't draw anything on screen.
// They only clean up and organise data, so they're easy to test on their own (see epc.test.js).

// A valid EPC is 8 to 64 characters, using only 0-9 and A-F ("hexadecimal").
// This is the same rule our backend uses, so we catch typos here before calling the server.
const EPC_PATTERN = /^[0-9A-F]{8,64}$/;

// The backend accepts at most 200 tags per request (see docs/api/altai-adapter.md).
export const MAX_PER_REQUEST = 200;

// Turn whatever the user typed, pasted or scanned into a clean list of EPCs.
//
// Input can be one code per line (what a scanner produces), or separated by commas or spaces.
// Returns:
//   epcs       — valid codes, upper-case, each one only once, in the order they came
//   invalid    — pieces of text that aren't valid EPCs (shown to the user so they can fix them)
//   duplicates — how many times a code appeared again (one item scanned twice by accident)
export function parseEpcs(text) {
    const pieces = text.split(/[\s,;]+/).map((p) => p.trim().toUpperCase()).filter(Boolean);

    const seen = new Set();
    const epcs = [];
    const invalid = [];
    let duplicates = 0;

    for (const piece of pieces) {
        if (!EPC_PATTERN.test(piece)) {
            invalid.push(piece);
        } else if (seen.has(piece)) {
            duplicates += 1;
        } else {
            seen.add(piece);
            epcs.push(piece);
        }
    }
    return { epcs, invalid, duplicates };
}

// Cut a long list into smaller lists of at most `size` items.
// Example: chunk([1,2,3,4,5], 2) → [[1,2], [3,4], [5]]
export function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
}

// The lookup gives one row per tag. A shop owner thinks in products, not tags, so we group tags
// that have the same SKU into one row and count them.
// Example: 3 tags of "Classic Tee, Black / M" → one row with tagCount 3.
//
// Returns rows sorted by product name, then SKU, each with:
//   sku, productName, productCode, variation, tagCount, epcs (the codes), stores (names),
//   pendingCount (tags currently inside an unfinished transfer or count)
export function groupBySku(tags) {
    const rows = new Map();

    for (const tag of tags) {
        const key = tag.sku ?? `no-sku:${tag.product_code ?? ''}:${tag.variation ?? ''}`;
        if (!rows.has(key)) {
            rows.set(key, {
                key,
                sku: tag.sku ?? null,
                productName: tag.product_name ?? 'Unknown product',
                productCode: tag.product_code ?? null,
                variation: tag.variation ?? null,
                tagCount: 0,
                epcs: [],
                stores: new Set(),
                pendingCount: 0,
            });
        }
        const row = rows.get(key);
        row.tagCount += 1;
        row.epcs.push(tag.epc);
        if (tag.store_name) row.stores.add(tag.store_name);
        if (tag.pending_transaction) row.pendingCount += 1;
    }

    return [...rows.values()]
        .map((row) => ({ ...row, stores: [...row.stores].sort() }))
        .sort((a, b) => a.productName.localeCompare(b.productName) || (a.sku ?? '').localeCompare(b.sku ?? ''));
}
