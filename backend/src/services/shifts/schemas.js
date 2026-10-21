import { z } from 'zod';
import { code, id, money, idParamSchema } from '../../lib/validators.js';
import { toCents } from '../../lib/money.js';

export { idParamSchema };

// What a valid request looks like. Anything else is answered with 400 and a list of what's wrong,
// before it ever reaches the shift rules.

const storeId = z.string().trim().min(1).max(50);
const register = code(20); // till name, e.g. "T1" (stored upper-case)
// Zod runs these extra checks even when the basic money format check already failed
// (e.g. "1.005"), so they must never crash on a bad value: treat it as "not valid" instead.
const centsOrNull = (v) => { try { return toCents(v); } catch { return null; } };
const positiveMoney = money.refine((v) => centsOrNull(v) > 0, 'Must be more than 0');
const maxFloat = money.refine((v) => (centsOrNull(v) ?? 0) <= 10_000_00, 'Opening float looks too high (max RM 10,000)');

// Malaysian ringgit notes and coins, for the optional "count by denomination" at closing.
export const DENOMINATIONS = ['100', '50', '20', '10', '5', '1', '0.50', '0.20', '0.10', '0.05'];

export const openShiftSchema = z.strictObject({
    store_id: storeId,
    register,
    opening_float: maxFloat,
});

export const movementSchema = z.strictObject({
    type: z.enum(['pay_in', 'pay_out', 'drop']),
    amount: positiveMoney,
    reason: z.string().trim().max(255).optional(),
}).refine(
    // Cash leaving the drawer for an expense must say what it was for: that's what an audit asks first.
    (m) => m.type !== 'pay_out' || (m.reason && m.reason.length >= 3),
    { message: 'A pay-out needs a reason (at least 3 characters)', path: ['reason'] },
);

export const closeShiftSchema = z.strictObject({
    counted_cash: money,
    // partialRecord: any of the denominations may appear, none has to (a plain z.record with
    // enum keys would demand every single one).
    breakdown: z.partialRecord(z.enum(DENOMINATIONS), z.number().int().min(0).max(100_000)).optional(),
    note: z.string().trim().max(255).optional(),
});

export const currentShiftQuerySchema = z.object({
    store_id: storeId,
    register,
});

export const listShiftsQuerySchema = z.object({
    store_id: storeId.optional(),
    status: z.enum(['open', 'closed']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
    offset: z.coerce.number().int().min(0).default(0),
});
