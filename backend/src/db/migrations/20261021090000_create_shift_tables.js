// Shifts & cash: one row per till session (shifts) and every cash movement during it (cash_movements).
// See docs/domain/shifts-cash.md for the rules in plain words.
//
// Stores and staff live in the team's API, so we keep their ids and a copy of their names
// ("snapshot") here. That way a report still shows the right name if it's renamed later.

export async function up(knex) {
    await knex.schema.createTable('shifts', (t) => {
        t.bigIncrements('id');
        t.string('merchant_id', 20).notNullable();       // which business (from the login)
        t.string('store_id', 50).notNullable();          // team API store id
        t.string('store_name', 100);                     // snapshot of the store name
        t.string('register', 20).notNullable();          // which till in the store, e.g. "T1"
        t.string('status', 10).notNullable().defaultTo('open');

        t.decimal('opening_float', 12, 2).notNullable(); // cash put in the drawer at the start
        t.string('opened_by_login', 100);                // null for badge logins
        t.string('opened_by_name', 100).notNullable();
        t.timestamp('opened_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

        // Filled in when the shift is closed:
        t.decimal('expected_cash', 12, 2);               // what should be in the drawer
        t.decimal('counted_cash', 12, 2);                // what the cashier actually counted
        t.decimal('variance', 12, 2);                    // counted − expected (negative = cash short)
        t.jsonb('count_breakdown');                      // optional: how many of each note/coin
        t.string('close_note', 255);
        t.string('closed_by_login', 100);
        t.string('closed_by_name', 100);
        t.timestamp('closed_at', { useTz: true });

        t.index(['merchant_id', 'store_id', 'opened_at']);
        t.check("?? in ('open', 'closed')", ['status'], 'shifts_status_valid');
        t.check('?? >= 0', ['opening_float'], 'shifts_opening_float_non_negative');
        t.check('?? is null or ?? >= 0', ['counted_cash', 'counted_cash'], 'shifts_counted_cash_non_negative');
        // An open shift has no closing data; a closed one must have it.
        t.check(
            "(?? = 'open' and ?? is null and ?? is null) or (?? = 'closed' and ?? is not null and ?? is not null)",
            ['status', 'closed_at', 'counted_cash', 'status', 'closed_at', 'counted_cash'],
            'shifts_close_fields_match_status',
        );
    });

    // At most ONE open shift per till. The database itself refuses a second one,
    // even if two people press "Open shift" at the same moment.
    await knex.raw(`
        CREATE UNIQUE INDEX shifts_one_open_per_register
        ON shifts (merchant_id, store_id, register)
        WHERE status = 'open'
    `);

    await knex.schema.createTable('cash_movements', (t) => {
        t.bigIncrements('id');
        t.bigInteger('shift_id').notNullable().references('id').inTable('shifts');
        // pay_in  (+) cash added, e.g. more change from the safe
        // pay_out (−) cash taken out for a small expense, e.g. cleaning supplies
        // drop    (−) cash moved from the drawer to the safe, so the drawer doesn't hold too much
        // sale (+) / refund (−) will be written by the checkout module later
        t.string('type', 10).notNullable();
        t.decimal('amount', 12, 2).notNullable();        // always positive; the type decides + or −
        t.string('reason', 255);
        t.string('reference_type', 30);                  // e.g. "sale" (later)
        t.bigInteger('reference_id');
        t.string('created_by_login', 100);
        t.string('created_by_name', 100).notNullable();
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

        t.index(['shift_id', 'created_at']);
        t.check("?? in ('pay_in', 'pay_out', 'drop', 'sale', 'refund')", ['type'], 'cash_movements_type_valid');
        t.check('?? > 0', ['amount'], 'cash_movements_amount_positive');
    });
}

export async function down(knex) {
    await knex.schema.dropTable('cash_movements');
    await knex.schema.dropTable('shifts');
}
