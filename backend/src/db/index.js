import knex from 'knex';
import knexConfig from '../../knexfile.js';

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
