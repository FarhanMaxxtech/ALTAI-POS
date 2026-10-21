import knex from 'knex';
import pg from 'pg';
import knexConfig from '../../knexfile.js';

// PostgreSQL BIGINT (type id 20: our ids, count(*)) arrives as a string by default, because it can
// exceed JavaScript's safe integer range (2^53). Our ids never will, so parse them as numbers.
// NUMERIC (money) is deliberately left as a string. See product.service.js.
pg.types.setTypeParser(20, (value) => Number.parseInt(value, 10));
// DATE (type id 1082, e.g. a birthday): keep the plain "1990-05-14" text. By default it becomes a
// JavaScript Date at local midnight, which in Malaysia (UTC+8) prints as the PREVIOUS day in UTC.
pg.types.setTypeParser(1082, (value) => value);

// One shared connection pool for the whole app. Import `db` wherever you need the database.
const db = knex(knexConfig);

// Returns true if the database answers. Used by GET /health.
export async function checkDb() {
    try {
        await db.raw('select 1');
        return true;
    } catch {
        return false;
    }
}

export default db;
