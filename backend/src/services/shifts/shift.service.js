import db from '../../db/index.js';
import HttpError from '../../lib/httpError.js';
import { formatRM, fromCents, toCents } from '../../lib/money.js';
import { listStores } from '../integrations/altai-api/index.js';

// SHIFTS & CASH: all the rules about a till's cash live here.
//
// The life of a shift:
//   1. OPEN   — a cashier starts a shift on one till with an opening float (the change in the drawer).
//   2. DURING — cash goes in and out: pay-ins, pay-outs (small expenses), drops (drawer → safe),
//               and later cash sales and refunds from the checkout.
//               At any time an X report shows the running totals.
//   3. CLOSE  — the cashier counts the drawer. We compare that with what SHOULD be there
//               (expected cash) and store the difference (variance). That's the Z report.
//
// Expected cash = opening float + pay-ins + cash sales − pay-outs − drops − cash refunds
//
// Every function takes `user` (from the signed login token) and only ever sees shifts of the
// user's own merchant. Another business's shifts don't exist as far as this code is concerned.

const IN_TYPES = ['pay_in', 'sale'];             // cash coming into the drawer
const OUT_TYPES = ['pay_out', 'drop', 'refund']; // cash leaving the drawer

const SHIFT_COLUMNS = [
    'id', 'store_id', 'store_name', 'register', 'status', 'opening_float',
    'opened_by_login', 'opened_by_name', 'opened_at',
    'expected_cash', 'counted_cash', 'variance', 'count_breakdown', 'close_note',
    'closed_by_login', 'closed_by_name', 'closed_at',
];

// ---------- helpers ----------

// Find one shift of this merchant. Optionally lock it ("FOR UPDATE") so that two requests can't
// change it at the same time, e.g. two people closing the same shift: the second one waits,
// then sees it's already closed.
async function findShift(trx, user, id, { lock = false } = {}) {
    const query = trx('shifts').select(SHIFT_COLUMNS).where({ id, merchant_id: user.merchantId }).first();
    if (lock) query.forUpdate();
    const shift = await query;
    if (!shift) throw new HttpError(404, `Shift ${id} not found`);
    return shift;
}

// The X report: running cash totals for a shift. Sums are added up by the database,
// whose NUMERIC type is exact, then turned into cents for our arithmetic.
async function buildReport(trx, shift) {
    const rows = await trx('cash_movements')
        .where({ shift_id: shift.id })
        .groupBy('type')
        .select('type', trx.raw('sum(amount)::text as total'), trx.raw('count(*)::int as count'));

    const totals = { pay_in: 0, pay_out: 0, drop: 0, sale: 0, refund: 0 };
    let movementCount = 0;
    for (const row of rows) {
        totals[row.type] = toCents(row.total);
        movementCount += row.count;
    }

    const opening = toCents(shift.opening_float);
    const cashIn = IN_TYPES.reduce((sum, type) => sum + totals[type], 0);
    const cashOut = OUT_TYPES.reduce((sum, type) => sum + totals[type], 0);
    const expected = opening + cashIn - cashOut;

    return {
        cents: { opening, ...totals, expected },
        report: {
            opening_float: fromCents(opening),
            pay_ins: fromCents(totals.pay_in),
            pay_outs: fromCents(totals.pay_out),
            drops: fromCents(totals.drop),
            cash_sales: fromCents(totals.sale),
            cash_refunds: fromCents(totals.refund),
            expected_cash: fromCents(expected),
            movement_count: movementCount,
        },
    };
}

async function shiftWithDetails(trx, shift) {
    const movements = await trx('cash_movements')
        .where({ shift_id: shift.id })
        .orderBy('id')
        .select('id', 'type', 'amount', 'reason', 'created_by_name', 'created_at');
    const { report } = await buildReport(trx, shift);
    return { ...shift, report, movements };
}

// ---------- reading ----------

export async function listShifts(user, { store_id, status, limit, offset }) {
    const query = db('shifts').select(SHIFT_COLUMNS)
        .where({ merchant_id: user.merchantId })
        .orderBy('opened_at', 'desc')
        .limit(limit)
        .offset(offset);
    if (store_id) query.where({ store_id });
    if (status) query.where({ status });
    return query;
}

export async function getShift(user, id) {
    return shiftWithDetails(db, await findShift(db, user, id));
}

// The open shift on one till, or null if the till is closed.
export async function getCurrentShift(user, { store_id, register }) {
    const shift = await db('shifts').select(SHIFT_COLUMNS)
        .where({ merchant_id: user.merchantId, store_id, register, status: 'open' })
        .first();
    return shift ? shiftWithDetails(db, shift) : null;
}

// ---------- changing ----------

// auth is needed to ask the team API whether this user may use this store.
export async function openShift(user, auth, { store_id, register, opening_float }) {
    const store = (await listStores(auth)).find((s) => s.id === store_id);
    if (!store) throw new HttpError(403, `You don't have access to store ${store_id}`);

    try {
        const [shift] = await db('shifts').insert({
            merchant_id: user.merchantId,
            store_id,
            store_name: store.name,
            register,
            opening_float,
            opened_by_login: user.loginId,
            opened_by_name: user.name,
        }).returning(SHIFT_COLUMNS);
        return shiftWithDetails(db, shift);
    } catch (err) {
        // The "one open shift per till" rule in the database caught a second open shift.
        if (err.code === '23505' && err.constraint === 'shifts_one_open_per_register') {
            throw new HttpError(409, `Till ${register} at ${store.name} already has an open shift. Close it first.`);
        }
        throw err;
    }
}

// Pay-in, pay-out or drop. Sales and refunds will come from the checkout, not from this endpoint.
export async function addMovement(user, shiftId, { type, amount, reason }) {
    return db.transaction(async (trx) => {
        const shift = await findShift(trx, user, shiftId, { lock: true });
        if (shift.status !== 'open') throw new HttpError(409, 'This shift is closed. Open a new shift first.');

        // You can't take out more cash than the drawer should hold.
        if (OUT_TYPES.includes(type)) {
            const { cents } = await buildReport(trx, shift);
            const wanted = toCents(amount);
            if (wanted > cents.expected) {
                throw new HttpError(409, `Not enough cash in the drawer: ${formatRM(cents.expected)} available, ${formatRM(wanted)} requested`);
            }
        }

        await trx('cash_movements').insert({
            shift_id: shift.id,
            type,
            amount,
            reason: reason ?? null,
            created_by_login: user.loginId,
            created_by_name: user.name,
        });
        return shiftWithDetails(trx, shift);
    });
}

// Close the shift with the counted cash. Returns the Z report.
// breakdown (optional): how many of each note/coin, e.g. { "50": 3, "1": 12, "0.20": 5 }.
// If given, it must add up to counted_cash, which catches counting or typing mistakes.
export async function closeShift(user, shiftId, { counted_cash, breakdown, note }) {
    const counted = toCents(counted_cash);

    if (breakdown) {
        const breakdownTotal = Object.entries(breakdown)
            .reduce((sum, [denomination, quantity]) => sum + toCents(denomination) * quantity, 0);
        if (breakdownTotal !== counted) {
            throw new HttpError(400, `The notes and coins add up to ${formatRM(breakdownTotal)}, but the counted cash says ${formatRM(counted)}`);
        }
    }

    return db.transaction(async (trx) => {
        const shift = await findShift(trx, user, shiftId, { lock: true });
        if (shift.status !== 'open') throw new HttpError(409, 'This shift is already closed.');

        const { cents } = await buildReport(trx, shift);
        // Second guard, independent of timing: only close it if it's STILL open. If someone else
        // closed it in the meantime, this updates nothing and we refuse.
        const [closed] = await trx('shifts').where({ id: shift.id, status: 'open' }).update({
            status: 'closed',
            expected_cash: fromCents(cents.expected),
            counted_cash: fromCents(counted),
            variance: fromCents(counted - cents.expected),
            count_breakdown: breakdown ? JSON.stringify(breakdown) : null,
            close_note: note ?? null,
            closed_by_login: user.loginId,
            closed_by_name: user.name,
            closed_at: trx.fn.now(),
        }).returning(SHIFT_COLUMNS);
        if (!closed) throw new HttpError(409, 'This shift is already closed.');
        return shiftWithDetails(trx, closed);
    });
}
