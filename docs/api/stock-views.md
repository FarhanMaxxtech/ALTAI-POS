# Stock views API (read-only, from the team's system)

Base URL (dev): `http://localhost:3001/api`. Every route needs `Authorization: Bearer <token>`, and checks
that the user may see the store. Nothing here changes stock (decision 006).

| Method | Path | Query | Success |
|---|---|---|---|
| GET | `/stock/levels` | `store_id`, `q?` (SKU, product, product code), `refresh=1?` (skip the 60 s cache) | `200 { as_of, from_cache, complete, tag_count, reported_total, statuses, skus: [{ sku, product_name, product_code, variation, total, by_status }] }` |
| GET | `/stock/tags` | `store_id` and either `sku` (that SKU's tags) or `q` (≥2 chars: part of EPC, SKU or product name) | `sku`: `200 { tags }` · `q`: `200 { total, tags }` (max 500 shown) |
| POST | `/tags/inspect` | body `{ epcs: [...] }` (≤50) | `200 { tags: [...] }` in the order sent, see below |
| GET | `/stock/transfers` | `store_id`, `from?`, `to?` (YYYY-MM-DD, default last 30 days, max 92 days), `status?` | `200 { from, to, transactions }` |
| GET | `/stock/transfers/:id` | | `200 { transaction }` (with `lines`) |
| GET | `/stock/counts` · `/stock/counts/:id` | same as transfers | same |
| GET | `/stock/adjustments` · `/stock/adjustments/:id` | same as transfers | same |
| GET | `/stock/checkouts` · `/stock/checkouts/:id` | same as transfers | same |

Field names follow the team's docs ([team-api-reference.md](team-api-reference.md)). A `transaction` is
`{ id, trx_id, reference, date, status, status_label, type, type_label, store_id, store_name, store_code, to_store_name, to_store_code, remark, totals, raw }`:
- `id` opens the detail. `reference` is what staff recognise: the stock count's `refno` (e.g. `FS4-SCA000006`), else `trxId`, else the id.
- `status` is the team's code; `status_label` is their `statusName`, or a known meaning (count `10` Pending Review, `30` Approved), or `"Status <code>"`.
- `type` / `type_label`: adjustments only, `ADI` Stock in / `ADO` Stock out.
- Transfers: `store_*` is the source store, `to_store_*` the destination. `totals` = `{ counted, expected, variance }` for stock counts, else null.
- `status` filter: the team's lists can't filter by status, so our backend does it (matches the code, or part of the label).
- `raw` is exactly what the team's API sent.

A detail adds `item_count` and `lines`, **one per SKU** (not per tag): `{ sku, product_code, product_name, variation, qty, qty_in, qty_out, counted, expected, variance, line_type }`.
Which quantities are filled depends on the kind: transfers and checkouts `qty`; adjustments `qty_in`/`qty_out`; counts `counted`/`expected`/`variance`.
A transfer lists each SKU twice, `line_type` `TFO` (out of the source) and `TFI` (into the destination); `item_count` counts it once.

**Tag inspector** (`/tags/inspect`): each tag is one of
- `{ epc, found: true, sku, product_name, product_code, variation, store_id, store_name, status, pending_transaction, pending_transaction_id }`.
  `status` comes from **one** `EpcList` call for the whole list (`epcs[]`), and `pending_transaction_id` is the unfinished transfer/count/adjustment holding it (from TagLookup; field name unconfirmed).
- `{ epc, found: false }`: not registered to any product.
- `{ epc, found: null, error }`: the lookup itself failed (e.g. the team API was too slow).

The team's API can only **assign** tags to a SKU (`Stock/UpdateTag`, done in their handheld app). There's no endpoint to mark a tag missing, sold or retired.

`complete: false` means the store has more than 10,000 tags and only the first 10,000 were counted.

## Errors

| Status | When |
|---|---|
| 400 | Missing store, bad dates, "from" after "to", more than 92 days, unknown kind |
| 401 | No token, an edited token, or an expired one (also when the team-API session expired) |
| 403 | A store you don't have access to |
| 404 | Transaction not found |
| 502 / 504 | The team's API failed or was too slow |
