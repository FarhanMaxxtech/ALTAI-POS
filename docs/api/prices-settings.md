# Prices & settings API

Base URL (dev): `http://localhost:3001/api`. Every route needs `Authorization: Bearer <token>`.
Money and tax rates are strings with up to 2 decimals (`"49.90"`, `"6.00"`).

## Settings

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/settings/business` | | `200 { settings }` (defaults if never saved) |
| PUT | `/settings/business` | any of `business_name, company_reg_no, sst_reg_no, sst_rate, prices_include_tax, cash_rounding, default_receipt_footer` | `200 { settings }` |
| GET | `/settings/stores/:storeId` | | `200 { settings }` (with `store_name`) |
| PUT | `/settings/stores/:storeId` | any of `address, phone, receipt_footer` | `200 { settings }` |

## Prices

| Method | Path | Body / query | Success |
|---|---|---|---|
| GET | `/prices` | `?q=<sku or name>&store_id=&limit=100&offset=0` | `200 { prices: [{ sku, product_name, default_price, store_price, effective_price, store_price_count }] }` |
| PUT | `/prices/:sku` | `{ price, store_id?, product_name?, reason? }` (no `store_id` = default price) | `200 { price }` |
| DELETE | `/prices/:sku` | `?store_id=` (none = remove the default price) | `200 { removed: true }` |
| POST | `/prices/bulk` | `{ skus: [...] (≤500), price, store_id?, reason? }` | `200 { updated }` |
| GET | `/prices/:sku/history` | | `200 { history: [{ store_id, old_price, new_price, reason, changed_by_name, created_at }] }` |
| POST | `/prices/resolve` | `{ skus: [...], store_id }` | `200 { prices: { "<sku>": { price, source: "store"\|"default"\|null, product_name } }, tax: { sst_rate, prices_include_tax, cash_rounding } }` |

`resolve` is what the till calls: the price to charge for each SKU in that store, plus the tax rules to apply.

## Errors

| Status | When |
|---|---|
| 400 | Invalid price (negative, more than 2 decimals), rate outside 0–100, SKU with spaces, duplicate SKUs in a bulk request |
| 401 | No token, an edited token, or an expired one |
| 403 | A store you don't have access to |
| 404 | Removing a price that doesn't exist |
