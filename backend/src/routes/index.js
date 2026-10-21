import { Router } from 'express';
import catalogRoutes from './catalog.routes.js';
import inventoryRoutes from './inventory.routes.js';
import altaiRoutes from './altai.routes.js';
import shiftsRoutes from './shifts.routes.js';
import customersRoutes from './customers.routes.js';
import pricingRoutes from './pricing.routes.js';

// Every API route lives under /api. Add each new module's router here.
const api = Router();

api.use(altaiRoutes); // team API: login, stores, tag lookup, SKU balance
api.use(shiftsRoutes); // shifts & cash (our database)
api.use(customersRoutes); // customers & promotional campaigns (our database)
api.use(pricingRoutes); // prices, tax & receipt settings (our database)
api.use(catalogRoutes);
api.use(inventoryRoutes); // local stock: paused, see docs/decisions/004-team-api-as-source-of-truth.md

export default api;
