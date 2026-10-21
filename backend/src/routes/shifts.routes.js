import { Router } from 'express';
import validate from '../middleware/validate.js';
import requireSession from '../middleware/requireSession.js';
import * as c from '../controllers/shifts.controller.js';
import {
    openShiftSchema, movementSchema, closeShiftSchema,
    currentShiftQuerySchema, listShiftsQuerySchema, idParamSchema,
} from '../services/shifts/schemas.js';

// Shifts & cash. Every route needs a logged-in user. See docs/api/shifts.md.
const router = Router();
router.use('/shifts', requireSession);

router.get('/shifts', validate({ query: listShiftsQuerySchema }), c.list);
router.get('/shifts/current', validate({ query: currentShiftQuerySchema }), c.current);
router.post('/shifts', validate({ body: openShiftSchema }), c.open);
router.get('/shifts/:id', validate({ params: idParamSchema }), c.show);
router.post('/shifts/:id/movements', validate({ params: idParamSchema, body: movementSchema }), c.addMovement);
router.post('/shifts/:id/close', validate({ params: idParamSchema, body: closeShiftSchema }), c.close);

export default router;
