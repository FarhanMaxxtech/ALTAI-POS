// Run with: npm test
// These tests use the dev database. Every row they create starts with a unique run prefix
// and is deleted at the end, so your own data is never touched.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db/index.js';

const RUN = `T${Date.now().toString(36).toUpperCase()}`; // e.g. "TMG3K2X1"
const api = request(app);

after(async () => {
    await db('products').whereLike('style_code', `${RUN}%`).del(); // variants are deleted by CASCADE
    await db('categories').whereLike('name', `${RUN}%`).del();
    await db.destroy();
});

const tee = (overrides = {}) => ({
    style_code: `${RUN}-tee`,
    name: `${RUN} Classic Tee`,
    base_price: '49.90',
    variants: [
        { sku: `${RUN}-tee-blk-m`, barcode: `${RUN}0001`, color: 'Black', size: 'M' },
        { sku: `${RUN}-tee-blk-xl`, color: 'Black', size: 'XL', price: 54.9 },
    ],
    ...overrides,
});

test('create a product with variants', async () => {
    const res = await api.post('/api/products').send(tee()).expect(201);
    const p = res.body.product;

    assert.equal(p.style_code, `${RUN}-TEE`, 'codes are stored upper-case');
    assert.equal(p.variants.length, 2);

    const m = p.variants.find((v) => v.size === 'M');
    const xl = p.variants.find((v) => v.size === 'XL');
    assert.equal(m.effective_price, '49.90', 'no override → base price');
    assert.equal(xl.effective_price, '54.90', 'override wins');
});

test('lookup by SKU (any case) and by barcode', async () => {
    const bySku = await api.get('/api/lookup').query({ code: `${RUN}-tee-blk-m`.toLowerCase() }).expect(200);
    assert.equal(bySku.body.item.sku, `${RUN}-TEE-BLK-M`);
    assert.equal(bySku.body.item.product_name, `${RUN} Classic Tee`);

    const byBarcode = await api.get('/api/lookup').query({ code: `${RUN}0001` }).expect(200);
    assert.equal(byBarcode.body.item.sku, `${RUN}-TEE-BLK-M`);
});

test('duplicate SKU → 409 and nothing is saved (transaction rollback)', async () => {
    const res = await api.post('/api/products').send(tee({
        style_code: `${RUN}-tee2`,
        variants: [
            { sku: `${RUN}-tee2-wht-s`, color: 'White', size: 'S' },
            { sku: `${RUN}-tee-blk-m`, color: 'White', size: 'M' }, // already used above
        ],
    })).expect(409);
    assert.match(res.body.error, /variants_sku_unique/);

    const leftover = await db('products').where({ style_code: `${RUN}-TEE2` }).first();
    assert.equal(leftover, undefined, 'the product row must be rolled back too');
});

test('same colour + size twice in one product → 409', async () => {
    await api.post('/api/products').send(tee({
        style_code: `${RUN}-tee3`,
        variants: [
            { sku: `${RUN}-tee3-a`, color: 'Red', size: 'L' },
            { sku: `${RUN}-tee3-b`, color: 'Red', size: 'L' },
        ],
    })).expect(409);
});

test('validation errors → 400 with field details', async () => {
    const noVariants = await api.post('/api/products').send(tee({ style_code: `${RUN}-x`, variants: [] })).expect(400);
    assert.equal(noVariants.body.details[0].field, 'body.variants');

    const badPrice = await api.post('/api/products').send(tee({ style_code: `${RUN}-y`, base_price: '49.999' })).expect(400);
    assert.equal(badPrice.body.details[0].field, 'body.base_price');
});

test('archived variant can no longer be sold', async () => {
    const { body } = await api.get('/api/lookup').query({ code: `${RUN}-tee-blk-xl` }).expect(200);
    await api.patch(`/api/variants/${body.item.id}`).send({ status: 'archived' }).expect(200);
    await api.get('/api/lookup').query({ code: `${RUN}-tee-blk-xl` }).expect(404);
});

test('SKU cannot be changed after creation', async () => {
    const { body } = await api.get('/api/lookup').query({ code: `${RUN}-tee-blk-m` }).expect(200);
    // Sent together with a valid field, so the request isn't rejected just for being empty.
    const res = await api.patch(`/api/variants/${body.item.id}`).send({ sku: 'NEW-SKU', color: 'Navy' }).expect(400);
    assert.match(res.body.details[0].message, /sku/);

    const after = await api.get('/api/lookup').query({ code: `${RUN}-tee-blk-m` }).expect(200);
    assert.equal(after.body.item.color, 'Black', 'nothing was changed');
});

test('search products by name', async () => {
    const res = await api.get('/api/products').query({ q: `${RUN} classic` }).expect(200);
    assert.equal(res.body.products.length, 1);
    assert.equal(res.body.products[0].variant_count, 2);
});

test('unknown product → 404', async () => {
    await api.get('/api/products/999999999').expect(404);
});

test('categories: create, and duplicate name at the same level → 409', async () => {
    const top = await api.post('/api/categories').send({ name: `${RUN} Tops` }).expect(201);
    await api.post('/api/categories').send({ name: `${RUN} tops` }).expect(409);
    await api.post('/api/categories').send({ name: `${RUN} Tees`, parent_id: top.body.category.id }).expect(201);
});
