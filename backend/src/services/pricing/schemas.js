import { z } from 'zod';
import { money } from '../../lib/validators.js';
import { rateToBasisPoints } from '../../lib/tax.js';

// What valid price and settings requests look like. Anything else gets a 400 with the reasons.

const optionalText = (max) => z.string().trim().max(max).nullish().transform((v) => v || null);
// SKUs come from the team's system: keep them exactly as given, just no spaces and not too long.
export const sku = z.string().trim().min(1).max(64).regex(/^\S+$/, 'A SKU has no spaces');
const storeId = z.string().trim().min(1).max(50);
const reason = z.string().trim().max(255).optional();

// A tax rate like "6", "6.00" or 10, between 0 and 100 with at most 2 decimals.
const taxRate = z.union([z.number(), z.string().trim()]).transform(String).refine((v) => {
    try { rateToBasisPoints(v); return true; } catch { return false; }
}, 'Enter a rate between 0 and 100, e.g. 6 or 10');

// ---------- settings ----------

export const businessSettingsSchema = z.strictObject({
    business_name: optionalText(150),
    company_reg_no: optionalText(50),
    sst_reg_no: optionalText(50),
    sst_rate: taxRate,
    prices_include_tax: z.boolean(),
    cash_rounding: z.boolean(),
    default_receipt_footer: optionalText(500),
}).partial().refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');

export const storeSettingsSchema = z.strictObject({
    address: optionalText(300),
    phone: optionalText(30),
    receipt_footer: optionalText(500),
}).partial().refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');

export const storeParamSchema = z.object({ storeId });

// ---------- prices ----------

export const skuParamSchema = z.object({ sku });

export const setPriceSchema = z.strictObject({
    price: money,
    store_id: storeId.nullish(),           // omit/null = the default price for all stores
    product_name: optionalText(200),
    reason,
});

export const removePriceQuerySchema = z.object({ store_id: storeId.optional() });

export const bulkPriceSchema = z.strictObject({
    skus: z.array(sku).min(1).max(500).refine((l) => new Set(l).size === l.length, 'Each SKU only once'),
    price: money,
    store_id: storeId.nullish(),
    reason,
});

export const listPricesQuerySchema = z.object({
    q: z.string().trim().max(100).optional(),
    store_id: storeId.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
    offset: z.coerce.number().int().min(0).default(0),
});

export const resolvePricesSchema = z.strictObject({
    skus: z.array(sku).min(1).max(500),
    store_id: storeId,
});
