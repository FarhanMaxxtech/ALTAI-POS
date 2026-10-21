// Prices, tax and receipt settings. See docs/domain/prices-tax-settings.md.
//
// Products and SKUs live in the team's API; prices live HERE (their API has none).
// A SKU has a default price for all stores, and optionally a different price for one store.

export async function up(knex) {
    // One row per business: tax and general receipt details.
    await knex.schema.createTable('business_settings', (t) => {
        t.string('merchant_id', 20).primary();
        t.string('business_name', 150);
        t.string('company_reg_no', 50);                   // SSM registration number
        t.string('sst_reg_no', 50);                       // SST registration number (if registered)
        t.decimal('sst_rate', 5, 2).notNullable().defaultTo(0); // percent, e.g. 10.00
        t.boolean('prices_include_tax').notNullable().defaultTo(true); // shelf price already includes SST
        t.boolean('cash_rounding').notNullable().defaultTo(true);      // round cash totals to 5 sen
        t.string('default_receipt_footer', 500);
        t.string('updated_by_name', 100);
        t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        t.check('?? >= 0 and ?? <= 100', ['sst_rate', 'sst_rate'], 'business_settings_sst_rate_range');
    });

    // Per store: what's printed on that store's receipts.
    await knex.schema.createTable('store_settings', (t) => {
        t.string('merchant_id', 20).notNullable();
        t.string('store_id', 50).notNullable();           // team API store id
        t.string('address', 300);
        t.string('phone', 30);
        t.string('receipt_footer', 500);                  // null = use the business default
        t.string('updated_by_name', 100);
        t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        t.primary(['merchant_id', 'store_id']);
    });

    // Current prices. store_id NULL = the default price for every store.
    await knex.schema.createTable('prices', (t) => {
        t.bigIncrements('id');
        t.string('merchant_id', 20).notNullable();
        t.string('sku', 64).notNullable();
        t.string('store_id', 50);
        t.decimal('price', 12, 2).notNullable();
        t.string('product_name', 200);                    // a label for the price list (optional)
        t.string('updated_by_name', 100).notNullable();
        t.timestamps(true, true);
        t.check('?? >= 0', ['price'], 'prices_price_non_negative');
    });
    // One default price and at most one price per store, per SKU.
    // NULLS NOT DISTINCT: two "default" (NULL store) rows for the same SKU count as duplicates too.
    await knex.raw(`
        CREATE UNIQUE INDEX prices_one_per_sku_and_store
        ON prices (merchant_id, sku, store_id) NULLS NOT DISTINCT
    `);

    // Every price change, never edited: what it was, what it became, who, when, why.
    await knex.schema.createTable('price_history', (t) => {
        t.bigIncrements('id');
        t.string('merchant_id', 20).notNullable();
        t.string('sku', 64).notNullable();
        t.string('store_id', 50);
        t.decimal('old_price', 12, 2);                    // null = there was no price
        t.decimal('new_price', 12, 2);                    // null = the price was removed
        t.string('reason', 255);
        t.string('changed_by_name', 100).notNullable();
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        t.index(['merchant_id', 'sku', 'created_at']);
    });
}

export async function down(knex) {
    await knex.schema.dropTable('price_history');
    await knex.schema.dropTable('prices');
    await knex.schema.dropTable('store_settings');
    await knex.schema.dropTable('business_settings');
}
