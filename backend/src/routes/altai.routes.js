import { Router } from 'express';
import validate from '../middleware/validate.js';
import requireSession from '../middleware/requireSession.js';
import * as c from '../controllers/altai.controller.js';
import * as s from '../controllers/stock.controller.js';
import * as p from '../controllers/products.controller.js';
import { loginSchema, tagLookupSchema, skuBalanceQuerySchema } from '../services/integrations/altai-api/schemas.js';
import {
    stockLevelsQuerySchema, skuTagsQuerySchema, kindParamSchema, kindIdParamSchema, transactionsQuerySchema, inspectSchema,
} from '../services/integrations/altai-api/stock.schemas.js';
import { productListQuerySchema, productParamSchema, productInfoQuerySchema } from '../services/integrations/altai-api/products.schemas.js';

// Routes backed by the team's API (altairfid). See docs/api/altai-adapter.md.
const router = Router();

router.post('/auth/login', validate({ body: loginSchema }), c.login);
router.get('/auth/me', requireSession, c.me);

router.get('/stores', requireSession, c.listStores);
router.post('/tags/lookup', requireSession, validate({ body: tagLookupSchema }), c.lookupTags);
router.get('/stock/balance', requireSession, validate({ query: skuBalanceQuerySchema }), c.skuBalance);

// Read-only inventory views (decision 006): nothing here changes stock in the team's system.
router.get('/stock/levels', requireSession, validate({ query: stockLevelsQuerySchema }), s.levels);
router.get('/stock/tags', requireSession, validate({ query: skuTagsQuerySchema }), s.storeTags);
router.post('/tags/inspect', requireSession, validate({ body: inspectSchema }), s.inspect);
router.get('/stock/:kind', requireSession, validate({ params: kindParamSchema, query: transactionsQuerySchema }), s.transactions);
router.get('/stock/:kind/:id', requireSession, validate({ params: kindIdParamSchema }), s.transaction);

// The team's product catalogue with their prices (read-only). Our own local catalog under /products is paused.
router.get('/catalog/products', requireSession, validate({ query: productListQuerySchema }), p.list);
router.get('/catalog/products/:productId', requireSession, validate({ params: productParamSchema, query: productInfoQuerySchema }), p.show);

export default router;
