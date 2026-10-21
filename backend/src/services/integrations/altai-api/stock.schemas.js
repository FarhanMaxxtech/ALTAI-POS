import { z } from 'zod';

// What valid stock requests look like (all read-only). Anything else gets a 400 with the reasons.

const storeId = z.string().trim().min(1).max(50);
const MAX_RANGE_DAYS = 92; // about 3 months per request, so one page can't ask for years of history

export const stockLevelsQuerySchema = z.object({
    store_id: storeId,
    q: z.string().trim().max(100).optional(),
    refresh: z.enum(['1', 'true']).optional(), // skip the 60-second cache
});

// Either the tags of one SKU (sku=…), or a search (q=… matches part of EPC, SKU or product name).
export const skuTagsQuerySchema = z.object({
    store_id: storeId,
    sku: z.string().trim().min(1).max(64).optional(),
    q: z.string().trim().min(2, 'Type at least 2 characters').max(64).optional(),
}).refine((v) => Boolean(v.sku) !== Boolean(v.q), { message: 'Send either sku or q', path: ['q'] });

const epc = z.string().trim().regex(/^[0-9A-Fa-f]{8,64}$/, 'EPC must be 8-64 hex characters').toUpperCase();
export const inspectSchema = z.strictObject({
    // At most 50: one EpcList call covers them all, but each tag still costs one TagLookup.
    epcs: z.array(epc).min(1).max(50).refine((l) => new Set(l).size === l.length, 'Duplicate EPC in list'),
});

export const kindParamSchema = z.object({ kind: z.enum(['transfers', 'counts', 'adjustments', 'checkouts']) });
export const kindIdParamSchema = kindParamSchema.extend({ id: z.string().trim().min(1).max(50) });

// Dates as YYYY-MM-DD. Default: the last 30 days up to today.
export const transactionsQuerySchema = z.object({
    store_id: storeId,
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    status: z.string().trim().max(30).optional(),
}).transform((q) => {
    const today = new Date().toISOString().slice(0, 10);
    const to = q.to ?? today;
    const from = q.from ?? new Date(Date.parse(`${to}T00:00:00Z`) - 30 * 86400_000).toISOString().slice(0, 10);
    return { ...q, from, to };
}).refine((q) => q.from <= q.to, { message: '"from" must be on or before "to"', path: ['from'] })
    .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / 86400_000 <= MAX_RANGE_DAYS,
        { message: `Pick at most ${MAX_RANGE_DAYS} days at a time`, path: ['from'] });
