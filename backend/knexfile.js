// Used by the Knex CLI (npm run migrate, etc.) and by src/db/index.js.
import config from './src/config/index.js';

export default {
    client: 'pg',
    connection: config.db,
    pool: { min: 0, max: 10 },
    migrations: {
        directory: './src/db/migrations',
        tableName: 'knex_migrations', // Knex records which migrations have run here
        loadExtensions: ['.js'],
    },
};
