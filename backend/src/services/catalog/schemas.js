import { z } from 'zod';
import { money, code, optionalText, id, status, idParamSchema } from '../../lib/validators.js';

export { idParamSchema };

// ---------- categories ----------

export const createCategorySchema = z.strictObject({
    name: z.string().trim().min(1).max(100),
    parent_id: id.nullish(),
});

// ---------- variants ----------

export const createVariantSchema = z.strictObject({
    sku: code(64),
    barcode: z.string().trim().regex(/^[0-9A-Za-z-]{4,64}$/, 'Invalid barcode').nullish(),
    color: optionalText(50),
    size: optionalText(20),
    price: money.nullish(), // omit to use the product's base_price
});

export const updateVariantSchema = createVariantSchema
    .omit({ sku: true }) // SKUs are permanent: sales history and labels refer to them
    .extend({ status })
    .partial()
    .refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');

// ---------- products ----------

export const createProductSchema = z.strictObject({
    style_code: code(50),
    name: z.string().trim().min(1).max(200),
    description: optionalText(5000),
    brand: optionalText(100),
    category_id: id.nullish(),
    base_price: money,
    variants: z.array(createVariantSchema).min(1, 'A product needs at least one variant'),
});

export const updateProductSchema = createProductSchema
    .omit({ style_code: true, variants: true })
    .extend({ status })
    .partial()
    .refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');

export const listProductsQuerySchema = z.object({
    q: z.string().trim().max(100).optional(),
    category_id: id.optional(),
    status: status.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
});


export const lookupQuerySchema = z.object({
    code: z.string().trim().min(1).max(64),
});
