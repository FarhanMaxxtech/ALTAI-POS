import { Router } from 'express';
import catalogRoutes from './catalog.routes.js';

// Every API route lives under /api. Add each new module's router here.
const api = Router();

api.use(catalogRoutes);

export default api;
