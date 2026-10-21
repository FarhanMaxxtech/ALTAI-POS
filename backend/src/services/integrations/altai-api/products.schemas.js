import { z } from 'zod';

// Product catalogue queries (read-only). Mirrors the team's Product/List filters.
export const productListQuerySchema = z.object({
    q: z.string().trim().max(100).optional(),          // part of the product name
    code: z.string().trim().max(64).optional(),        // exact product code
    sku: z.string().trim().max(64).optional(),         // part of a SKU
    active: z.enum(['Y', 'N']).optional(),
    store_id: z.string().trim().min(1).max(50).optional(), // adds each SKU's stock at that store
    skus: z.enum(['0', '1']).default('1'),              // 0 = products only (faster)
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20), // the team's limit is 100
});

export const productParamSchema = z.object({ productId: z.string().trim().regex(/^\d{1,20}$/, 'Product id must be a number') });
export const productInfoQuerySchema = z.object({ store_id: z.string().trim().min(1).max(50).optional() });
