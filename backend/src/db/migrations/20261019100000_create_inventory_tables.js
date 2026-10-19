// Inventory: where stock is (locations), how much (stock_levels), every change (stock_movements),
// and individual RFID-tagged items (rfid_tags). See docs/domain/inventory.md.

export async function up(knex) {
    await knex.schema.createTable('locations', (t) => {
        t.bigIncrements('id');
        t.string('code', 20).notNullable().unique(); // e.g. "KL-PAV", "WH-MAIN"
        t.string('name', 100).notNullable();
        t.string('type', 20).notNullable().defaultTo('store');
        t.string('status', 20).notNullable().defaultTo('active');
        t.timestamps(true, true);
        t.check("?? in ('store', 'warehouse')", ['type'], 'locations_type_valid');
        t.check("?? in ('active', 'archived')", ['status'], 'locations_status_valid');
    });

    // The current balance per location × variant. This is the row we lock when stock changes.
    await knex.schema.createTable('stock_levels', (t) => {
        t.bigInteger('location_id').notNullable().references('id').inTable('locations');
        t.bigInteger('variant_id').notNullable().references('id').inTable('variants');
        t.integer('quantity').notNullable().defaultTo(0);
        t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        t.primary(['location_id', 'variant_id']);
        // Last line of defence: even buggy code can't make stock negative.
        t.check('?? >= 0', ['quantity'], 'stock_levels_quantity_non_negative');
    });

    // Append-only ledger: rows are only ever inserted, never updated or deleted.
    // For any location × variant: sum(quantity_change) = stock_levels.quantity.
    await knex.schema.createTable('stock_movements', (t) => {
        t.bigIncrements('id');
        t.bigInteger('location_id').notNullable().references('id').inTable('locations');
        t.bigInteger('variant_id').notNullable().references('id').inTable('variants');
        t.string('type', 20).notNullable();
        t.integer('quantity_change').notNullable(); // signed: +5 received, -1 sold
        t.integer('balance_after').notNullable();
        t.string('reference_type', 30); // e.g. "transfer", later "sale"
        t.bigInteger('reference_id');
        t.string('reason', 255);
        t.bigInteger('created_by'); // user id, once the auth module exists
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        t.index(['location_id', 'variant_id', 'created_at']);
        t.index(['reference_type', 'reference_id']);
        t.check('?? <> 0', ['quantity_change'], 'stock_movements_change_non_zero');
        t.check(
            "?? in ('receive', 'adjust', 'count', 'transfer_out', 'transfer_in', 'sale', 'return')",
            ['type'], 'stock_movements_type_valid',
        );
    });

    // A transfer moves stock between two locations in one transaction (out + in movements).
    await knex.schema.createTable('stock_transfers', (t) => {
        t.bigIncrements('id');
        t.bigInteger('from_location_id').notNullable().references('id').inTable('locations');
        t.bigInteger('to_location_id').notNullable().references('id').inTable('locations');
        t.string('reason', 255);
        t.bigInteger('created_by');
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        t.check('?? <> ??', ['from_location_id', 'to_location_id'], 'stock_transfers_different_locations');
    });

    // One row per physical RFID-tagged item. The EPC is the tag's unique code.
    await knex.schema.createTable('rfid_tags', (t) => {
        t.string('epc', 64).primary(); // upper-case hex, e.g. 24 chars for a 96-bit SGTIN
        t.bigInteger('variant_id').notNullable().references('id').inTable('variants');
        t.bigInteger('location_id').references('id').inTable('locations');
        t.string('status', 20).notNullable().defaultTo('in_stock');
        t.timestamp('last_seen_at', { useTz: true });
        t.timestamps(true, true);
        t.index(['location_id', 'status']);
        t.index(['variant_id']);
        t.check("?? in ('in_stock', 'sold', 'missing', 'retired')", ['status'], 'rfid_tags_status_valid');
    });
}

export async function down(knex) {
    await knex.schema.dropTable('rfid_tags');
    await knex.schema.dropTable('stock_transfers');
    await knex.schema.dropTable('stock_movements');
    await knex.schema.dropTable('stock_levels');
    await knex.schema.dropTable('locations');
}
