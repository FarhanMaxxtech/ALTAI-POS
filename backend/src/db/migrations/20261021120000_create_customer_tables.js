// Customers and promotional messages (campaigns). See docs/domain/customers-campaigns.md.
//
// Privacy (Malaysia PDPA): promotional messages may only go to customers who agreed to receive them,
// per channel, and they can withdraw at any time. So:
//   customers.email_opt_in / whatsapp_opt_in  → the CURRENT answer, for quick filtering
//   customer_consents                          → the full HISTORY of every yes/no, never edited:
//                                                who recorded it, when, and how (the proof)

export async function up(knex) {
    await knex.schema.createTable('customers', (t) => {
        t.bigIncrements('id');
        t.string('merchant_id', 20).notNullable();
        t.string('phone', 20);                         // E.164 format, e.g. +60123456789 (null once erased)
        t.string('name', 120).notNullable();
        t.string('email', 254);
        t.date('birthday');                            // optional, for birthday offers
        t.string('notes', 500);
        t.string('home_store_id', 50);                 // where they usually shop (team API store id)

        t.boolean('email_opt_in').notNullable().defaultTo(false);
        t.boolean('whatsapp_opt_in').notNullable().defaultTo(false);

        t.string('created_by_name', 100).notNullable();
        t.timestamps(true, true);
        t.timestamp('erased_at', { useTz: true });     // set when personal data was erased on request

        t.index(['merchant_id', 'name']);
    });

    // A phone number identifies one customer within a business (two businesses may share a customer).
    // Erased customers have no phone, so they don't block a new sign-up with the same number.
    await knex.raw(`
        CREATE UNIQUE INDEX customers_one_per_phone
        ON customers (merchant_id, phone)
        WHERE phone IS NOT NULL
    `);

    await knex.schema.createTable('customer_consents', (t) => {
        t.bigIncrements('id');
        t.bigInteger('customer_id').notNullable().references('id').inTable('customers');
        t.string('channel', 10).notNullable();         // email | whatsapp
        t.boolean('granted').notNullable();            // true = agreed, false = withdrew / declined
        t.string('source', 20).notNullable();          // how we got the answer, see check below
        t.string('recorded_by_name', 100).notNullable();
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

        t.index(['customer_id', 'created_at']);
        t.check("?? in ('email', 'whatsapp')", ['channel'], 'customer_consents_channel_valid');
        t.check("?? in ('in_store', 'phone_call', 'online_form', 'customer_reply', 'staff_update')", ['source'], 'customer_consents_source_valid');
    });

    await knex.schema.createTable('campaigns', (t) => {
        t.bigIncrements('id');
        t.string('merchant_id', 20).notNullable();
        t.string('name', 120).notNullable();           // internal name, e.g. "Raya sale 2026"
        t.string('channel', 10).notNullable();         // email | whatsapp
        t.string('subject', 150);                      // email only
        t.text('body').notNullable();                  // may contain {name} and {first_name}
        t.string('status', 10).notNullable().defaultTo('draft');
        t.string('created_by_name', 100).notNullable();
        t.timestamps(true, true);
        t.string('sent_by_name', 100);
        t.timestamp('sent_at', { useTz: true });
        t.integer('recipient_count');
        t.string('delivery_mode', 10);                 // preview | live: preview = recorded, not sent

        t.index(['merchant_id', 'created_at']);
        t.check("?? in ('email', 'whatsapp')", ['channel'], 'campaigns_channel_valid');
        t.check("?? in ('draft', 'sent')", ['status'], 'campaigns_status_valid');
    });

    await knex.schema.createTable('campaign_messages', (t) => {
        t.bigIncrements('id');
        t.bigInteger('campaign_id').notNullable().references('id').inTable('campaigns');
        t.bigInteger('customer_id').notNullable().references('id').inTable('customers');
        t.string('to_address', 254).notNullable();     // the phone or email it went to, at that moment
        t.text('body').notNullable();                  // the personalised text
        t.string('status', 10).notNullable();          // previewed | sent | failed
        t.string('error', 255);
        t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

        t.unique(['campaign_id', 'customer_id']);      // one message per customer per campaign
        t.check("?? in ('previewed', 'sent', 'failed')", ['status'], 'campaign_messages_status_valid');
    });
}

export async function down(knex) {
    await knex.schema.dropTable('campaign_messages');
    await knex.schema.dropTable('campaigns');
    await knex.schema.dropTable('customer_consents');
    await knex.schema.dropTable('customers');
}
