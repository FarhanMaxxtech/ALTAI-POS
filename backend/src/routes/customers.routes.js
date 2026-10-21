import { Router } from 'express';
import validate from '../middleware/validate.js';
import requireSession from '../middleware/requireSession.js';
import * as c from '../controllers/customers.controller.js';
import {
    createCustomerSchema, updateCustomerSchema, consentSchema, listCustomersQuerySchema,
    createCampaignSchema, updateCampaignSchema, listQuerySchema, idParamSchema,
} from '../services/customers/schemas.js';

// Customers and promotional campaigns. Every route needs a logged-in user.
// See docs/api/customers.md.
const router = Router();
router.use(['/customers', '/campaigns'], requireSession);

router.get('/customers', validate({ query: listCustomersQuerySchema }), c.list);
router.post('/customers', validate({ body: createCustomerSchema }), c.create);
router.get('/customers/:id', validate({ params: idParamSchema }), c.show);
router.patch('/customers/:id', validate({ params: idParamSchema, body: updateCustomerSchema }), c.update);
router.post('/customers/:id/consent', validate({ params: idParamSchema, body: consentSchema }), c.consent);
// "Delete my data" request: personal data is erased, the (anonymous) record stays.
router.post('/customers/:id/erase', validate({ params: idParamSchema }), c.erase);

router.get('/campaigns', validate({ query: listQuerySchema }), c.listCampaigns);
router.post('/campaigns', validate({ body: createCampaignSchema }), c.createCampaign);
router.get('/campaigns/:id', validate({ params: idParamSchema }), c.showCampaign);
router.patch('/campaigns/:id', validate({ params: idParamSchema, body: updateCampaignSchema }), c.updateCampaign);
router.get('/campaigns/:id/preview', validate({ params: idParamSchema }), c.previewCampaign);
router.post('/campaigns/:id/send', validate({ params: idParamSchema }), c.sendCampaign);
router.get('/campaigns/:id/messages', validate({ params: idParamSchema, query: listQuerySchema }), c.campaignMessages);

export default router;
