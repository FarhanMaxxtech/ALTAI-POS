import HttpError from '../../../lib/httpError.js';
import { fromCents } from '../../../lib/money.js';
import { request, expectOk } from './client.js';

// READ-ONLY product catalogue from the team's API (Product/List and Product/Info, documented in
// docs/api/team-api-reference.md). A product (e.g. "Slim jeans") has SKUs (one per colour/size),
// and each SKU carries the team's price, cost and, when a store is given, the stock balance there.

// Their prices come as plain numbers (849, 49.9). We hand out money strings like everywhere else
// ("849.00"), rounding to whole cents so a float like 49.900000001 can't leak into the till.
function money(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? fromCents(Math.round(n * 100)) : null;
}
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const yes = (v) => v === true || v === 'Y' || v === 'y' || v === 1 || v === '1';

function mapSku(s) {
    return {
        sku_id: s.skuId === undefined || s.skuId === null ? null : String(s.skuId),
        sku: s.sku ?? null,
        active: yes(s.active),
        price: money(s.price),
        cost: money(s.cost),
        balance: num(s.balance),          // stock at the store asked for (null when no store was given)
        stock_warn: num(s.stockWarn),     // the team's "low stock" level
        variation: s.variationName ?? null,                // e.g. "Black / M"
        variations: (s.variations ?? []).map((v) => ({ type: v.type ?? null, value: v.value ?? null })),
        images: s.images ?? [],
        remark: s.remark ?? null,
    };
}

export function mapProduct(p) {
    const skus = Array.isArray(p.skus) ? p.skus.map(mapSku) : [];
    return {
        product_id: String(p.productId ?? ''),
        product_code: p.productCode ?? null,
        product_name: p.productName ?? null,
        description: p.description ?? null,
        active: yes(p.active),
        images: p.images ?? [],
        sku_count: num(p.skuCount) ?? skus.length,
        skus,
    };
}

// Filters are all optional. `name` and `sku` match part of the text; `store_id` adds balances.
export async function listProducts(auth, { code, name, sku, active, storeId, includeSkus = true, page = 1, pageSize = 20 }) {
    const body = {
        code: code ?? '',
        name: name ?? '',
        sku: sku ?? '',
        active: active ?? '',
        storeId: storeId ?? '',
        includeSkus: includeSkus ? 'Y' : 'N',
        page,
        pageSize,
    };
    const data = expectOk(await request({ method: 'POST', path: 'Product/List', auth, body }), 'Product/List');
    const rows = data?.data ?? [];
    return {
        page,
        page_size: pageSize,
        total: num(data?.recordsTotal),   // not in the docs' example; null when they don't send it
        products: rows.map(mapProduct),
    };
}

export async function productInfo(auth, productId, { storeId } = {}) {
    const data = expectOk(
        await request({ path: 'Product/Info', auth, query: { productId, storeId: storeId ?? '' } }),
        'Product/Info',
        { errorStatus: 404 },
    );
    const p = data?.data;
    if (!p || typeof p !== 'object') throw new HttpError(404, 'Product not found');
    return mapProduct(p);
}
