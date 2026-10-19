import { Router } from 'express';
import validate from '../middleware/validate.js';
import requireSession from '../middleware/requireSession.js';
import * as c from '../controllers/altai.controller.js';
import { loginSchema, tagLookupSchema, skuBalanceQuerySchema } from '../services/integrations/altai-api/schemas.js';

// Routes backed by the team's API (altairfid). See docs/api/altai-adapter.md.
const router = Router();

router.post('/auth/login', validate({ body: loginSchema }), c.login);
router.get('/auth/me', requireSession, c.me);

router.get('/stores', requireSession, c.listStores);
router.post('/tags/lookup', requireSession, validate({ body: tagLookupSchema }), c.lookupTags);
router.get('/stock/balance', requireSession, validate({ query: skuBalanceQuerySchema }), c.skuBalance);

export default router;
