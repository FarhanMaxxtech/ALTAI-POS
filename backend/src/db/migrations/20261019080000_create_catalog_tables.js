// Catalog: categories → products (a style) → variants (one sellable size × colour, with its SKU).
// See docs/domain/catalog.md for the reasoning.

export async function up(knex) {
    await knex.schema.createTable('categories', (t) => {
        t.bigIncrements('id');
        t.bigInteger('parent_id').references('id').inTable('categories').onDelete('SET NULL');
        t.string('name', 100).notNullable();
        t.timestamps(true, true);
    });
    // Same name allowed under different parents, but not twice under one parent (or twice at top level).
    await knex.raw(`
        CREATE UNIQUE INDEX categories_parent_name_unique
        ON categories (parent_id, lower(name)) NULLS NOT DISTINCT
    `);

    await knex.schema.createTable('products', (t) => {
        t.bigIncrements('id');
        t.string('style_code', 50).notNullable().unique(); // e.g. "CT-001"
        t.string('name', 200).notNullable();
        t.text('description');
        t.string('brand', 100);
        t.bigInteger('category_id').references('id').inTable('categories').onDelete('SET NULL');
        // NUMERIC is exact. Never use float for money.
        t.decimal('base_price', 12, 2).notNullable().defaultTo(0);
        t.string('status', 20).notNullable().defaultTo('active');
        t.timestamps(true, true);
        t.check('?? >= 0', ['base_price'], 'products_base_price_non_negative');
        t.check("?? in ('active', 'archived')", ['status'], 'products_status_valid');
    });

    await knex.schema.createTable('variants', (t) => {
        t.bigIncrements('id');
        t.bigInteger('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
        t.string('sku', 64).notNullable().unique(); // e.g. "CT-001-BLK-M"
        t.string('barcode', 64).unique();          // EAN/UPC printed on the label; optional
        t.string('color', 50);
        t.string('size', 20);
        t.decimal('price', 12, 2); // NULL = use the product's base_price
        t.string('status', 20).notNullable().defaultTo('active');
        t.timestamps(true, true);
        t.index(['product_id']);
        t.check('?? is null or ?? >= 0', ['price', 'price'], 'variants_price_non_negative');
        t.check("?? in ('active', 'archived')", ['status'], 'variants_status_valid');
    });

    // One variant per colour + size within a product. NULLS NOT DISTINCT makes
    // two variants with no size (NULL) count as duplicates too (PostgreSQL 15+).
    await knex.raw(`
        CREATE UNIQUE INDEX variants_product_color_size_unique
        ON variants (product_id, color, size) NULLS NOT DISTINCT
    `);
}

export async function down(knex) {
    await knex.schema.dropTable('variants');
    await knex.schema.dropTable('products');
    await knex.schema.dropTable('categories');
}
