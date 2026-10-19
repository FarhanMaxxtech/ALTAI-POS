import 'dotenv/config';

const config = {
    // process.env values are always strings, so convert the port to a number.
    // ?? only falls back when the value is missing (unlike ||, which also replaces 0 or "").
    port: Number(process.env.PORT ?? 3001),
    env: process.env.NODE_ENV ?? 'development',
    db: {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        database: process.env.DB_NAME ?? 'altai_pos_dev',
        user: process.env.DB_USER ?? 'altai_app',
        // No default on purpose: a missing password should fail loudly, not silently.
        password: process.env.DB_PASSWORD,
    },
};

export default config;

