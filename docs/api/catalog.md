# Catalog API

Base URL (dev): `http://localhost:3001/api`. Every response has `ok: true|false`.
⚠ **No authentication yet.** That's added in the auth module.

| Method | Path | Body / query | Success |
|---|---|---|---|
| GET | `/categories` | | `200 { categories: [...] }` |
| POST | `/categories` | `{ name, parent_id? }` | `201 { category }` |
| GET | `/products` | `?q=&category_id=&status=&limit=50&offset=0` | `200 { products: [... variant_count] }` |
| POST | `/products` | see below | `201 { product }` (with `variants`) |
| GET | `/products/:id` | | `200 { product }` (with `variants`) |
| PATCH | `/products/:id` | any of `name, description, brand, category_id, base_price, status` | `200 { product }` |
| POST | `/products/:id/variants` | `{ sku, barcode?, color?, size?, price? }` | `201 { variant }` |
| PATCH | `/variants/:id` | any of `barcode, color, size, price, status` | `200 { variant }` |
| GET | `/lookup` | `?code=<SKU or barcode>` | `200 { item }`: what the till calls on scan |

## Create a product

```http
POST /api/products
Content-Type: application/json

{
  "style_code": "CT-001",
  "name": "Classic Tee",
  "brand": "Altai Basics",
  "base_price": "49.90",
  "variants": [
    { "sku": "CT-001-BLK-M",  "barcode": "9556000000017", "color": "Black", "size": "M" },
    { "sku": "CT-001-BLK-XL", "color": "Black", "size": "XL", "price": "54.90" }
  ]
}
```

## Errors

| Status | When | Body |
|---|---|---|
| 400 | Invalid input or unknown field | `{ ok:false, error:"Validation failed", details:[{ field, message }] }` |
| 404 | Product / variant / code not found | `{ ok:false, error }` |
| 409 | Duplicate style code, SKU, barcode, or colour+size | `{ ok:false, error:"Already exists (<constraint>)" }` |
