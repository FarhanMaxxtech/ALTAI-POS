import db from '../../db/index.js';
import HttpError from '../../lib/httpError.js';
import { toCents } from '../../lib/money.js';
import { assertStoreAccess, getBusinessSettings } from './settings.service.js';

// PRICES: what each SKU costs.
//
// Every SKU can have:
//   a DEFAULT price (store_id = null)  → used in every store
//   a STORE price (store_id = "12")    → overrides the default in that one store, e.g. an outlet
// The price the till charges ("effective price") = the store price if there is one, else the default.
// A SKU with neither can't be sold until someone sets a price.
//
// Every change goes into price_history (old → new, who, when, why), so "why did this cost RM 39
// last week?" always has an answer.

// Find the current price row for one SKU in one place (default or a store), locking it so two
// people changing the same price at once are handled one after the other.
function findPriceRow(trx, user, sku, storeId) {
    return trx('prices')
        .where({ merchant_id: user.merchantId, sku })
        .where((w) => (storeId ? w.where('store_id', storeId) : w.whereNull('store_id')))
        .forUpdate()
        .first('id', 'price', 'product_name');
}

async function setOne(trx, user, { sku, price, store_id: storeId = null, product_name: productName, reason }) {
    const existing = await findPriceRow(trx, user, sku, storeId);
    if (existing) {
        const changes = { price, updated_by_name: user.name, updated_at: trx.fn.now() };
        if (productName !== undefined && productName !== null) changes.product_name = productName;
        await trx('prices').where({ id: existing.id }).update(changes);
    } else {
        await trx('prices').insert({
            merchant_id: user.merchantId, sku, store_id: storeId, price,
            product_name: productName ?? null, updated_by_name: user.name,
        });
    }
    // Only real price changes go into the history (fixing a typo in the name isn't a price change).
    // Compare in cents: the database says "49.90", the request may say "49.9". Same price.
    if (!existing || toCents(existing.price) !== toCents(price)) {
        await trx('price_history').insert({
            merchant_id: user.merchantId, sku, store_id: storeId,
            old_price: existing?.price ?? null, new_price: price,
            reason: reason ?? null, changed_by_name: user.name,
        });
    }
}

// ---------- reading ----------

// One row per SKU: its default price, and (when store_id is given) that store's own price and the
// effective one. q matches part of the SKU or the product name.
export async function listPrices(user, { q, store_id: storeId, limit, offset }) {
    const query = db('prices')
        .where({ merchant_id: user.merchantId })
        .groupBy('sku')
        .orderBy('sku')
        .limit(limit)
        .offset(offset)
        .select(
            'sku',
            db.raw('max(product_name) as product_name'),
            db.raw('max(price) filter (where store_id is null) as default_price'),
            db.raw('count(*) filter (where store_id is not null)::int as store_price_count'),
            db.raw('max(updated_at) as updated_at'),
        );
    if (storeId) query.select(db.raw('max(price) filter (where store_id = ?) as store_price', [storeId]));
    if (q) {
        const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
        query.where((w) => w.whereILike('sku', pattern).orWhereILike('product_name', pattern));
    }

    const rows = await query;
    return rows.map((r) => ({
        ...r,
        store_price: r.store_price ?? null,
        effective_price: storeId ? (r.store_price ?? r.default_price ?? null) : r.default_price ?? null,
    }));
}

export async function priceHistory(user, sku) {
    return db('price_history')
        .where({ merchant_id: user.merchantId, sku })
        .orderBy('id', 'desc')
        .limit(200)
        .select('store_id', 'old_price', 'new_price', 'reason', 'changed_by_name', 'created_at');
}

// For the till: the price to charge for each SKU in one store, plus the tax rules to apply.
// SKUs without any price come back with price null, so the till can say "no price set".
export async function resolvePrices(user, auth, { skus, store_id: storeId }) {
    await assertStoreAccess(auth, storeId);
    const rows = await db('prices')
        .where({ merchant_id: user.merchantId })
        .whereIn('sku', skus)
        .where((w) => w.whereNull('store_id').orWhere('store_id', storeId))
        .select('sku', 'store_id', 'price', 'product_name');

    const prices = {};
    for (const sku of skus) {
        const storeRow = rows.find((r) => r.sku === sku && r.store_id === storeId);
        const defaultRow = rows.find((r) => r.sku === sku && r.store_id === null);
        const chosen = storeRow ?? defaultRow;
        prices[sku] = {
            price: chosen?.price ?? null,
            source: storeRow ? 'store' : defaultRow ? 'default' : null,
            product_name: storeRow?.product_name ?? defaultRow?.product_name ?? null,
        };
    }
    const settings = await getBusinessSettings(user);
    return {
        store_id: storeId,
        prices,
        tax: { sst_rate: settings.sst_rate, prices_include_tax: settings.prices_include_tax, cash_rounding: settings.cash_rounding },
    };
}

// ---------- changing ----------

export async function setPrice(user, auth, sku, data) {
    if (data.store_id) await assertStoreAccess(auth, data.store_id);
    await db.transaction((trx) => setOne(trx, user, { sku, ...data }));
    return (await listPrices(user, { q: sku, store_id: data.store_id ?? undefined, limit: 200, offset: 0 }))
        .find((r) => r.sku === sku);
}

// The same price for many SKUs at once, e.g. every size and colour of one style. All or nothing.
export async function bulkSetPrice(user, auth, { skus, price, store_id: storeId, reason }) {
    if (storeId) await assertStoreAccess(auth, storeId);
    await db.transaction(async (trx) => {
        for (const sku of skus) await setOne(trx, user, { sku, price, store_id: storeId ?? null, reason });
    });
    return { updated: skus.length };
}

// Remove a price. Removing a store's price makes that store fall back to the default.
export async function removePrice(user, auth, sku, { store_id: storeId }) {
    if (storeId) await assertStoreAccess(auth, storeId);
    await db.transaction(async (trx) => {
        const existing = await findPriceRow(trx, user, sku, storeId ?? null);
        if (!existing) throw new HttpError(404, storeId ? `${sku} has no price of its own at store ${storeId}` : `${sku} has no default price`);
        await trx('prices').where({ id: existing.id }).del();
        await trx('price_history').insert({
            merchant_id: user.merchantId, sku, store_id: storeId ?? null,
            old_price: existing.price, new_price: null, reason: 'Price removed', changed_by_name: user.name,
        });
    });
    return { removed: true };
}
