import db from '../../db/index.js';
import HttpError from '../../lib/httpError.js';
import { listStores } from '../integrations/altai-api/index.js';

// BUSINESS & STORE SETTINGS: tax rules and what's printed on receipts.
//
// Business (one per merchant): name, registration numbers, SST rate, whether shelf prices include
// tax, cash rounding to 5 sen, and the default receipt footer.
// Store (one per store): address, phone, and its own receipt footer (or the business default).
//
// Nothing is stored until someone saves; until then, sensible defaults are returned:
// 0% SST (the real rate is a tax question: set it in Settings), prices include tax, cash rounding on.

const BUSINESS_DEFAULTS = {
    business_name: null, company_reg_no: null, sst_reg_no: null,
    sst_rate: '0.00', prices_include_tax: true, cash_rounding: true,
    default_receipt_footer: null, updated_by_name: null, updated_at: null,
};
const BUSINESS_COLUMNS = ['merchant_id', ...Object.keys(BUSINESS_DEFAULTS)];
const STORE_COLUMNS = ['store_id', 'address', 'phone', 'receipt_footer', 'updated_by_name', 'updated_at'];

// The team API decides which stores a user may use. Returns that store ({ id, name }) or refuses.
export async function assertStoreAccess(auth, storeId) {
    const store = (await listStores(auth)).find((s) => s.id === storeId);
    if (!store) throw new HttpError(403, `You don't have access to store ${storeId}`);
    return store;
}

export async function getBusinessSettings(user, trx = db) {
    const row = await trx('business_settings').select(BUSINESS_COLUMNS).where({ merchant_id: user.merchantId }).first();
    return row ?? { merchant_id: user.merchantId, ...BUSINESS_DEFAULTS };
}

export async function updateBusinessSettings(user, changes) {
    // "Upsert": create the row the first time, update it after that.
    await db('business_settings')
        .insert({ merchant_id: user.merchantId, ...changes, updated_by_name: user.name, updated_at: db.fn.now() })
        .onConflict('merchant_id')
        .merge({ ...changes, updated_by_name: user.name, updated_at: db.fn.now() });
    return getBusinessSettings(user);
}

export async function getStoreSettings(user, auth, storeId) {
    const store = await assertStoreAccess(auth, storeId);
    const row = await db('store_settings').select(STORE_COLUMNS).where({ merchant_id: user.merchantId, store_id: storeId }).first();
    return {
        store_id: storeId, store_name: store.name,
        address: null, phone: null, receipt_footer: null, updated_by_name: null, updated_at: null,
        ...row,
    };
}

export async function updateStoreSettings(user, auth, storeId, changes) {
    await assertStoreAccess(auth, storeId);
    await db('store_settings')
        .insert({ merchant_id: user.merchantId, store_id: storeId, ...changes, updated_by_name: user.name, updated_at: db.fn.now() })
        .onConflict(['merchant_id', 'store_id'])
        .merge({ ...changes, updated_by_name: user.name, updated_at: db.fn.now() });
    return getStoreSettings(user, auth, storeId);
}
