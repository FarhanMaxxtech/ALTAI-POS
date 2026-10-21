import { Router } from 'express';
import validate from '../middleware/validate.js';
import requireSession from '../middleware/requireSession.js';
import * as c from '../controllers/pricing.controller.js';
import {
    businessSettingsSchema, storeSettingsSchema, storeParamSchema,
    setPriceSchema, removePriceQuerySchema, bulkPriceSchema, listPricesQuerySchema,
    resolvePricesSchema, skuParamSchema,
} from '../services/pricing/schemas.js';

// Prices, tax and receipt settings. Every route needs a logged-in user. See docs/api/prices-settings.md.
// TODO (permissions): only managers should change prices and tax, once the team's permission ids are known.
const router = Router();
router.use(['/settings', '/prices'], requireSession);

router.get('/settings/business', c.getBusiness);
router.put('/settings/business', validate({ body: businessSettingsSchema }), c.updateBusiness);
router.get('/settings/stores/:storeId', validate({ params: storeParamSchema }), c.getStore);
router.put('/settings/stores/:storeId', validate({ params: storeParamSchema, body: storeSettingsSchema }), c.updateStore);

router.get('/prices', validate({ query: listPricesQuerySchema }), c.list);
// Fixed paths before "/prices/:sku", so "resolve" and "bulk" aren't mistaken for SKUs.
router.post('/prices/resolve', validate({ body: resolvePricesSchema }), c.resolve);
router.post('/prices/bulk', validate({ body: bulkPriceSchema }), c.bulk);
router.get('/prices/:sku/history', validate({ params: skuParamSchema }), c.history);
router.put('/prices/:sku', validate({ params: skuParamSchema, body: setPriceSchema }), c.set);
router.delete('/prices/:sku', validate({ params: skuParamSchema, query: removePriceQuerySchema }), c.remove);

export default router;
