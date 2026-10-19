// Thin on purpose: take the validated input, call the service, send JSON.
// No business rules here. Those live in services/catalog/.
import * as categories from '../services/catalog/category.service.js';
import * as products from '../services/catalog/product.service.js';

export async function listCategories(req, res) {
    res.json({ ok: true, categories: await categories.listCategories() });
}

export async function createCategory(req, res) {
    res.status(201).json({ ok: true, category: await categories.createCategory(req.valid.body) });
}

export async function listProducts(req, res) {
    res.json({ ok: true, products: await products.listProducts(req.valid.query) });
}

export async function getProduct(req, res) {
    res.json({ ok: true, product: await products.getProduct(req.valid.params.id) });
}

export async function createProduct(req, res) {
    res.status(201).json({ ok: true, product: await products.createProduct(req.valid.body) });
}

export async function updateProduct(req, res) {
    res.json({ ok: true, product: await products.updateProduct(req.valid.params.id, req.valid.body) });
}

export async function addVariant(req, res) {
    res.status(201).json({ ok: true, variant: await products.addVariant(req.valid.params.id, req.valid.body) });
}

export async function updateVariant(req, res) {
    res.json({ ok: true, variant: await products.updateVariant(req.valid.params.id, req.valid.body) });
}

export async function lookup(req, res) {
    res.json({ ok: true, item: await products.lookupByCode(req.valid.query.code) });
}
