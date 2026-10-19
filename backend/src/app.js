import express from 'express';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';
import { checkDb } from './db/index.js';
import apiRoutes from './routes/index.js';

const app = express();

// 1) Middleware that runs before routes
app.use(express.json());

// 2) Routes
app.get('/health', async (req, res) => {
    const dbOk = await checkDb();
    // 503 = "Service Unavailable": the server runs, but it can't do its job without the database.
    res.status(dbOk ? 200 : 503).json({
        ok: dbOk,
        service: 'altai-pos-backend',
        database: dbOk ? 'connected' : 'unreachable',
        time: new Date().toISOString(),
    });
});

app.use('/api', apiRoutes);

// 3) Safety nets: order matters, these must stay last
app.use(notFound);
app.use(errorHandler);

export default app;
