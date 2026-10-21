import db from '../../db/index.js';
import HttpError from '../../lib/httpError.js';
import { normalizePhone } from '../../lib/phone.js';

// CUSTOMERS: your regular customers, identified by phone number.
//
// Consent rules (Malaysia PDPA), applied everywhere in this file:
//   - Promotions only go to customers who said YES, per channel (email / WhatsApp).
//   - Every yes/no is recorded in customer_consents with who, when and how. Never edited.
//   - A customer can withdraw at any time, and can ask to have their personal data erased.
// Every function only sees customers of the user's own merchant.

const COLUMNS = [
    'id', 'phone', 'name', 'email', 'birthday', 'notes', 'home_store_id',
    'email_opt_in', 'whatsapp_opt_in', 'created_by_name', 'created_at', 'updated_at', 'erased_at',
];
const OPT_IN_COLUMN = { email: 'email_opt_in', whatsapp: 'whatsapp_opt_in' };

async function findCustomer(trx, user, id, { lock = false } = {}) {
    const query = trx('customers').select(COLUMNS).where({ id, merchant_id: user.merchantId }).first();
    if (lock) query.forUpdate();
    const customer = await query;
    if (!customer) throw new HttpError(404, `Customer ${id} not found`);
    return customer;
}

function assertNotErased(customer) {
    if (customer.erased_at) throw new HttpError(409, 'This customer\'s data was erased. Register them again if needed.');
}

// Add one entry to the consent history and update the customer's current answer.
async function recordConsent(trx, user, customerId, { channel, granted, source }) {
    await trx('customer_consents').insert({ customer_id: customerId, channel, granted, source, recorded_by_name: user.name });
    await trx('customers').where({ id: customerId }).update({ [OPT_IN_COLUMN[channel]]: granted, updated_at: trx.fn.now() });
}

// A friendlier answer than "duplicate key": say WHO already has that phone number.
async function duplicatePhoneError(user, phone) {
    const existing = await db('customers').where({ merchant_id: user.merchantId, phone }).first('id', 'name');
    return new HttpError(409, `${phone} is already registered to ${existing?.name ?? 'another customer'}`, [{ code: 'DUPLICATE_PHONE', customer_id: existing?.id ?? null }]);
}

// ---------- reading ----------

// q can be part of a name, an email, or a phone number typed any way ("012-345", "0123456789").
export async function listCustomers(user, { q, opted_in, limit, offset }) {
    const query = db('customers').select(COLUMNS)
        .where({ merchant_id: user.merchantId })
        .whereNull('erased_at')
        .orderBy('name')
        .limit(limit)
        .offset(offset);

    if (opted_in) query.where({ [OPT_IN_COLUMN[opted_in]]: true });
    if (q) {
        const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
        const digits = q.replace(/\D/g, '');
        const fullPhone = normalizePhone(q);
        query.where((w) => {
            w.whereILike('name', pattern).orWhereILike('email', pattern);
            if (fullPhone) w.orWhere('phone', fullPhone);
            // Part of a number: "3456789" should find +60123456789. Drop a leading 0 (local format).
            else if (digits.length >= 4) w.orWhereLike('phone', `%${digits.replace(/^0/, '')}%`);
        });
    }
    return query;
}

export async function getCustomer(user, id) {
    const customer = await findCustomer(db, user, id);
    customer.consent_history = await db('customer_consents')
        .where({ customer_id: id })
        .orderBy('id', 'desc')
        .select('channel', 'granted', 'source', 'recorded_by_name', 'created_at');
    return customer;
}

// ---------- changing ----------

export async function createCustomer(user, data) {
    const { email_opt_in, whatsapp_opt_in, consent_source, ...fields } = data;
    try {
        const id = await db.transaction(async (trx) => {
            const [{ id: newId }] = await trx('customers')
                .insert({ ...fields, merchant_id: user.merchantId, created_by_name: user.name })
                .returning('id');
            // The answers given at sign-up go into the history too, including "no".
            await recordConsent(trx, user, newId, { channel: 'email', granted: email_opt_in, source: consent_source });
            await recordConsent(trx, user, newId, { channel: 'whatsapp', granted: whatsapp_opt_in, source: consent_source });
            return newId;
        });
        return getCustomer(user, id);
    } catch (err) {
        if (err.code === '23505' && err.constraint === 'customers_one_per_phone') throw await duplicatePhoneError(user, fields.phone);
        throw err;
    }
}

export async function updateCustomer(user, id, changes) {
    try {
        await db.transaction(async (trx) => {
            const customer = await findCustomer(trx, user, id, { lock: true });
            assertNotErased(customer);
            await trx('customers').where({ id }).update({ ...changes, updated_at: trx.fn.now() });
            // Removing the email address also ends email promotions: there's nowhere to send them.
            if ('email' in changes && !changes.email && customer.email_opt_in) {
                await recordConsent(trx, user, id, { channel: 'email', granted: false, source: 'staff_update' });
            }
        });
    } catch (err) {
        if (err.code === '23505' && err.constraint === 'customers_one_per_phone') throw await duplicatePhoneError(user, changes.phone);
        throw err;
    }
    return getCustomer(user, id);
}

export async function setConsent(user, id, { channel, granted, source }) {
    await db.transaction(async (trx) => {
        const customer = await findCustomer(trx, user, id, { lock: true });
        assertNotErased(customer);
        if (granted && channel === 'email' && !customer.email) {
            throw new HttpError(400, 'Add an email address before turning on email promotions');
        }
        await recordConsent(trx, user, id, { channel, granted, source });
    });
    return getCustomer(user, id);
}

// "Please delete my data" (PDPA). The row stays, so past sales and the consent history still add up,
// but everything that identifies the person is removed, including copies inside sent messages.
export async function eraseCustomer(user, id) {
    await db.transaction(async (trx) => {
        const customer = await findCustomer(trx, user, id, { lock: true });
        if (customer.erased_at) return; // already erased: nothing to do
        // Promotions end with the erasure; the history shows that, like any other change.
        for (const channel of ['email', 'whatsapp']) {
            if (customer[OPT_IN_COLUMN[channel]]) await recordConsent(trx, user, id, { channel, granted: false, source: 'customer_reply' });
        }
        await trx('customers').where({ id }).update({
            name: 'Erased customer', phone: null, email: null, birthday: null, notes: null, home_store_id: null,
            email_opt_in: false, whatsapp_opt_in: false, erased_at: trx.fn.now(), updated_at: trx.fn.now(),
        });
        await trx('campaign_messages').where({ customer_id: id }).update({ to_address: 'erased', body: '[erased]' });
    });
    return getCustomer(user, id);
}
