import { Router } from 'express';
import catalogRoutes from './catalog.routes.js';
import inventoryRoutes from './inventory.routes.js';

// Every API route lives under /api. Add each new module's router here.
const api = Router();

api.use(catalogRoutes);
api.use(inventoryRoutes);

export default api;
