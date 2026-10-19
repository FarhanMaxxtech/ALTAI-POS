import { Router } from 'express';
import validate from '../middleware/validate.js';
import * as c from '../controllers/inventory.controller.js';
import { idParamSchema } from '../lib/validators.js';
import {
    createLocationSchema, updateLocationSchema,
    receiveSchema, adjustSchema, transferSchema, countSchema, stockQuerySchema, movementsQuerySchema,
    registerTagsSchema, resolveTagsSchema, epcParamSchema, updateTagSchema,
} from '../services/inventory/schemas.js';

// TODO (auth module): protect these routes, and record the user in stock_movements.created_by.
const router = Router();

router.get('/locations', c.listLocations);
router.post('/locations', validate({ body: createLocationSchema }), c.createLocation);
router.patch('/locations/:id', validate({ params: idParamSchema, body: updateLocationSchema }), c.updateLocation);

router.get('/inventory/stock', validate({ query: stockQuerySchema }), c.getStock);
router.get('/inventory/movements', validate({ query: movementsQuerySchema }), c.listMovements);
router.post('/inventory/receive', validate({ body: receiveSchema }), c.receive);
router.post('/inventory/adjust', validate({ body: adjustSchema }), c.adjust);
router.post('/inventory/transfer', validate({ body: transferSchema }), c.transfer);
router.post('/inventory/count', validate({ body: countSchema }), c.count);

router.post('/rfid/tags', validate({ body: registerTagsSchema }), c.registerTags);
// POST (not GET) because a reader can send hundreds of EPCs, which is too long for a URL.
router.post('/rfid/resolve', validate({ body: resolveTagsSchema }), c.resolveTags);
router.patch('/rfid/tags/:epc', validate({ params: epcParamSchema, body: updateTagSchema }), c.updateTag);

export default router;
