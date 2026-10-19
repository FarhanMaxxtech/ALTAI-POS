import { z } from 'zod';

const epc = z.string().trim().regex(/^[0-9A-Fa-f]{8,64}$/, 'EPC must be 8-64 hex characters').toUpperCase();
const storeId = z.string().trim().min(1).max(50);

export const loginSchema = z.strictObject({
    login_id: z.string().trim().min(1).max(100),
    password: z.string().min(1).max(200),
});

export const tagLookupSchema = z.strictObject({
    // Max 200 per request: at 5 in parallel against their API that's already a few seconds.
    epcs: z.array(epc).min(1).max(200).refine((l) => new Set(l).size === l.length, 'Duplicate EPC in list'),
    store_id: storeId.optional(),
    op_type: z.string().trim().max(30).optional(),
});

export const skuBalanceQuerySchema = z.object({
    sku: z.string().trim().min(1).max(64),
    store_id: storeId,
});
