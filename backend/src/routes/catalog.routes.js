import { Router } from 'express';
import validate from '../middleware/validate.js';
import * as c from '../controllers/catalog.controller.js';
import {
    createCategorySchema, createProductSchema, updateProductSchema, listProductsQuerySchema,
    createVariantSchema, updateVariantSchema, idParamSchema, lookupQuerySchema,
} from '../services/catalog/schemas.js';

// TODO (auth module): protect these routes. Right now anyone who can reach the server can use them.
const router = Router();

router.get('/categories', c.listCategories);
router.post('/categories', validate({ body: createCategorySchema }), c.createCategory);

router.get('/products', validate({ query: listProductsQuerySchema }), c.listProducts);
router.post('/products', validate({ body: createProductSchema }), c.createProduct);
router.get('/products/:id', validate({ params: idParamSchema }), c.getProduct);
router.patch('/products/:id', validate({ params: idParamSchema, body: updateProductSchema }), c.updateProduct);
router.post('/products/:id/variants', validate({ params: idParamSchema, body: createVariantSchema }), c.addVariant);

router.patch('/variants/:id', validate({ params: idParamSchema, body: updateVariantSchema }), c.updateVariant);

// Till: scan a barcode or type a SKU → GET /api/lookup?code=CT-001-BLK-M
router.get('/lookup', validate({ query: lookupQuerySchema }), c.lookup);

export default router;
