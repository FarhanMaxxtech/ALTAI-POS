import { z } from 'zod';
import { code, id, status, uniqueBy } from '../../lib/validators.js';

const qty = z.number().int().positive().max(1_000_000);
const reason = z.string().trim().max(255).nullish();

// Lines like [{ variant_id: 5, quantity: 10 }]; the same variant may appear only once.
const lines = (shape) => z.array(z.strictObject(shape)).min(1).max(500)
    .refine(uniqueBy('variant_id'), 'Each variant may appear only once');

// ---------- locations ----------

export const createLocationSchema = z.strictObject({
    code: code(20),
    name: z.string().trim().min(1).max(100),
    type: z.enum(['store', 'warehouse']).default('store'),
});

export const updateLocationSchema = z.strictObject({
    name: z.string().trim().min(1).max(100),
    status,
}).partial().refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');

// ---------- stock operations ----------

export const receiveSchema = z.strictObject({
    location_id: id,
    lines: lines({ variant_id: id, quantity: qty }),
    reason,
});

export const adjustSchema = z.strictObject({
    location_id: id,
    variant_id: id,
    quantity_change: z.number().int().refine((n) => n !== 0, 'Must not be 0'),
    // Manual corrections must say why (damaged, found, theft...). That's what auditors ask first.
    reason: z.string().trim().min(3).max(255),
});

export const transferSchema = z.strictObject({
    from_location_id: id,
    to_location_id: id,
    lines: lines({ variant_id: id, quantity: qty }),
    reason,
}).refine((t) => t.from_location_id !== t.to_location_id, {
    message: 'From and to location must differ', path: ['to_location_id'],
});

export const countSchema = z.strictObject({
    location_id: id,
    lines: lines({ variant_id: id, counted_quantity: z.number().int().min(0).max(1_000_000) }),
    reason,
});

export const stockQuerySchema = z.object({
    location_id: id.optional(),
    variant_id: id.optional(),
    sku: z.string().trim().max(64).optional(),
});

export const movementsQuerySchema = z.object({
    location_id: id.optional(),
    variant_id: id.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
});

// ---------- RFID ----------

// EPCs are hex. Normalise to upper-case so "e280..." and "E280..." are the same tag.
const epc = z.string().trim().regex(/^[0-9A-Fa-f]{8,64}$/, 'EPC must be 8-64 hex characters').toUpperCase();
const epcList = z.array(epc).min(1).max(1000)
    .refine((list) => new Set(list).size === list.length, 'Duplicate EPC in list');

export const registerTagsSchema = z.strictObject({
    epcs: epcList,
    variant_id: id,
    location_id: id.nullish(),
});

export const resolveTagsSchema = z.strictObject({ epcs: epcList });

export const epcParamSchema = z.object({ epc });

export const updateTagSchema = z.strictObject({
    status: z.enum(['in_stock', 'sold', 'missing', 'retired']),
    location_id: id.nullable(),
}).partial().refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');
