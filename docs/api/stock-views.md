# Stock views API (read-only, from the team's system)

Base URL (dev): `http://localhost:3001/api`. Every route needs `Authorization: Bearer <token>`, and checks
that the user may see the store. Nothing here changes stock (decision 006).

| Method | Path | Query | Success |
|---|---|---|---|
| GET | `/stock/levels` | `store_id`, `q?` (SKU, product, product code), `refresh=1?` (skip the 60 s cache) | `200 { as_of, from_cache, complete, tag_count, reported_total, statuses, skus: [{ sku, product_name, product_code, variation, total, by_status }] }` |
| GET | `/stock/tags` | `store_id`, `sku` | `200 { tags: [{ epc, sku, product_name, variation, status, store_id }] }` |
| GET | `/stock/transfers` | `store_id`, `from?`, `to?` (YYYY-MM-DD, default last 30 days, max 92 days), `status?` | `200 { from, to, transactions }` |
| GET | `/stock/transfers/:id` | | `200 { transaction }` (with `lines`) |
| GET | `/stock/counts` · `/stock/counts/:id` | same as transfers | same |
| GET | `/stock/adjustments` · `/stock/adjustments/:id` | same as transfers | same |

A `transaction` is `{ id, reference, date, type, status, store_name, to_store_name, quantity, remark, created_by, raw }`.
`raw` is exactly what the team's API sent. The other fields are our best mapping of it.
A `line` is `{ epc, sku, product_name, variation, quantity, status }`.

`complete: false` means the store has more than 10,000 tags and only the first 10,000 were counted.

## Errors

| Status | When |
|---|---|
| 400 | Missing store, bad dates, "from" after "to", more than 92 days, unknown kind |
| 401 | No token, an edited token, or an expired one (also when the team-API session expired) |
| 403 | A store you don't have access to |
| 404 | Transaction not found |
| 502 / 504 | The team's API failed or was too slow |
