import { z } from 'zod';

// Shared Zod building blocks used by every module's schemas.
// Request bodies use z.strictObject: an unknown field (a typo, or "sku" on an update) is a 400,
// not silently ignored.

// Money arrives as 49.9 or "49.90"; we keep it as a string so it never passes through a float.
export const money = z
    .union([z.number(), z.string().trim()])
    .transform(String)
    .pipe(z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Must be an amount like 49.90 (max 2 decimals)'));

// Codes are compared case-insensitively, so store them upper-case: "ct-001" → "CT-001".
export const code = (max) => z.string().trim().min(1).max(max).regex(/^[A-Za-z0-9._-]+$/, 'Only letters, digits, . _ -').toUpperCase();

export const optionalText = (max) => z.string().trim().max(max).nullish().transform((v) => v || null);
export const id = z.coerce.number().int().positive();
export const status = z.enum(['active', 'archived']);
export const idParamSchema = z.object({ id });

// Reject lists that name the same thing twice, e.g. two lines for the same variant.
export const uniqueBy = (field) => (items) => new Set(items.map((i) => i[field])).size === items.length;
