import db from '../../db/index.js';
import HttpError from '../../lib/httpError.js';

// Money comes back from PostgreSQL NUMERIC as a string ("49.00"). We keep it a string on purpose:
// converting to a JS number would bring back float rounding errors.

const PRODUCT_COLUMNS = ['id', 'style_code', 'name', 'description', 'brand', 'category_id', 'base_price', 'status', 'created_at', 'updated_at'];

function variantsWithPrice() {
    return db('variants as v')
        .join('products as p', 'p.id', 'v.product_id')
        .select(
            'v.id', 'v.product_id', 'v.sku', 'v.barcode', 'v.color', 'v.size', 'v.price', 'v.status',
            // The price the till charges: the variant's own price, otherwise the product's base price.
            db.raw('coalesce(v.price, p.base_price) as effective_price'),
        );
}

// Escape % and _ so a search for "50%" doesn't become a wildcard.
const likePattern = (text) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;

export async function listProducts({ q, category_id, status, limit, offset }) {
    const query = db('products as p')
        .select(PRODUCT_COLUMNS.map((c) => `p.${c}`))
        .select(db.raw('(select count(*)::int from variants v where v.product_id = p.id) as variant_count'))
        .orderBy('p.name')
        .limit(limit)
        .offset(offset);

    if (category_id) query.where('p.category_id', category_id);
    if (status) query.where('p.status', status);
    if (q) {
        const pattern = likePattern(q);
        query.where((w) => w
            .whereILike('p.name', pattern)
            .orWhereILike('p.style_code', pattern)
            .orWhereExists(db('variants as v').whereRaw('v.product_id = p.id').whereILike('v.sku', pattern)));
    }
    return query;
}

export async function getProduct(id) {
    const product = await db('products').select(PRODUCT_COLUMNS).where({ id }).first();
    if (!product) throw new HttpError(404, `Product ${id} not found`);
    product.variants = await variantsWithPrice().where('v.product_id', id).orderBy(['v.color', 'v.size', 'v.id']);
    return product;
}

export async function createProduct({ variants, ...product }) {
    // Product + all its variants are saved together, or not at all.
    // If variant #3 has a duplicate SKU, the product row is rolled back too.
    const productId = await db.transaction(async (trx) => {
        const [{ id }] = await trx('products').insert(product).returning('id');
        await trx('variants').insert(variants.map((v) => ({ ...v, product_id: id })));
        return id;
    });
    return getProduct(productId);
}

export async function updateProduct(id, changes) {
    const count = await db('products').where({ id }).update({ ...changes, updated_at: db.fn.now() });
    if (!count) throw new HttpError(404, `Product ${id} not found`);
    return getProduct(id);
}

export async function addVariant(productId, variant) {
    const product = await db('products').where({ id: productId }).first('id');
    if (!product) throw new HttpError(404, `Product ${productId} not found`);
    const [{ id }] = await db('variants').insert({ ...variant, product_id: productId }).returning('id');
    return variantsWithPrice().where('v.id', id).first();
}

export async function updateVariant(id, changes) {
    const count = await db('variants').where({ id }).update({ ...changes, updated_at: db.fn.now() });
    if (!count) throw new HttpError(404, `Variant ${id} not found`);
    return variantsWithPrice().where('v.id', id).first();
}

// What the till calls when a barcode is scanned or a SKU is typed.
// Only sellable (active) items are returned.
export async function lookupByCode(code) {
    const variant = await variantsWithPrice()
        .select('p.name as product_name', 'p.style_code')
        .where((w) => w.where('v.sku', code.toUpperCase()).orWhere('v.barcode', code))
        .andWhere('v.status', 'active')
        .andWhere('p.status', 'active')
        .first();
    if (!variant) throw new HttpError(404, `No active item with SKU or barcode "${code}"`);
    return variant;
}
