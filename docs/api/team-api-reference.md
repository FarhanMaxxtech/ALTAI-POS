# Team API reference (Altairfid Stock API)

Summarised from the team's Postman documentation ("Altairfid Stock API", read 2026-10-21) so we don't
depend on the public page. **No keys, sessions or login details are copied here, and none should ever be.**

> ⚠️ **Security:** the public Postman page contained the production API key in plain text (in every
> example request and in the `apikey` variable), plus a demo login. Reported on 2026-10-21. The team
> should rotate the key and use a `{{APIKEY}}` variable in the docs.

## Basics

- Base URL: `https://altairfid.com/rest/…`
- Headers: `APIKEY` on every call, `SESSION` on every call except Login, `Content-Type: application/json` on POSTs.
  (Our adapter also sends `MERCHANTID`, which the rfid_counter app uses. The docs don't mention it.)
- Login: `POST /Merchant/Login` with `{ loginId, password, epc }`. Use `epc` for a staff badge, with empty loginId/password.
  The session comes back in the `session` **response header**.
- Errors often come back as **HTTP 200** with `{ "error": … }` in the body. Expired session = HTTP **440**.
- Dates: `YYYY-MM-DD`. Store ids: strings in requests (`"12"`), numbers or strings in responses.

## General

| Request | Method & path | Input | Output |
|---|---|---|---|
| Login | `POST /Merchant/Login` | `{ loginId, password, epc }` | session header; body `{ name, merchantId }` (seen in practice) |
| StoreList | `GET /Stock/StoreList` | | `{ data: [{ id, code, name, shopifyLocationId }], recordsTotal }` |
| AccessControl | `GET /Merchant/AccessControl` | | `{ data: [{ id, name }] }`, e.g. `602130 Stock Transfer`, `602100 Inventory Balance`, `450 Tags`, `101200 User Management` |

Stores carry a **`shopifyLocationId`**: the team's system is linked to Shopify locations.

## Tags

| Request | Method & path | Input | Output |
|---|---|---|---|
| TagLookup | `POST /Stock/TagLookup` | `{ epc }`: **an EPC or a barcode** | `{ epc, sku, productCode, productName, varLabel, varDetails[] }` (+ store and pending fields, seen in practice) |
| EpcList | `POST /Stock/EpcList` | `{ epc, productName, storeId, page, pageSize, epcs[] }` | `{ data: [{ epc, merchantId, productCode, productName, sku, status, storeId, storeName, varDetails, varLabel }], notFound[], recordsTotal }` |
| UpdateTag | `POST /Stock/UpdateTag` | `{ sku, epcs[] }` | `{ updated: true, count }`: assigns the tags to that SKU |
| SkuBalance | `GET /Stock/SkuBalance` | `?sku=&storeId=` | `{ balance, sku, storeId, storeName }` |

- `EpcList` with `epcs[]` filters to those tags and lists the unknown ones in `notFound`: **one call for many tags**.
- `varDetails[]`: `{ typeName, value, typeColor, valueColor }`, e.g. Brand, Colour, Gender, Size.
- Tag `status` is a code (`"1"`). **Meaning not documented.**

## Products

| Request | Method & path | Input | Output |
|---|---|---|---|
| Product List | `POST /Product/List` | all optional: `code`, `name` (contains), `active` (`Y`/`N`), `sku` (contains), `storeId` (balances at that store), `includeSkus` (`N` = products only), `page` (1), `pageSize` (20, max 100) | `{ data: [product] }` |
| Product Info | `GET /Product/Info` | `?productId=&storeId=` | `{ data: product }` |

A **product**: `{ productId, productCode, productName, description, active, images[], skuCount, skus[] }`.
A **SKU**: `{ skuId, sku, active, price, cost, balance, stockWarn, remark, images[], variationName, variations: [{ type, value }] }`.
**Prices exist here** (`price`, e.g. 849). This overlaps with ALTAI's own Prices module (see open questions).

## Checkout: a sale (stock out of a store)

| Request | Method & path | Input | Output |
|---|---|---|---|
| Checkout – Save | `POST /Stock/Checkout` | `{ storeId, trxDate, remark, epcs[] }` (+ `id` to update an existing one) | `{ trxId }` |
| CheckoutList | `GET /Stock/CheckoutList` | `?dateFrom=&dateTo=&storeId=` | `{ data: [{ id, storeId, storeName, trxDate, remark, status }], recordsTotal }` |
| CheckoutInfo | `GET /Stock/CheckoutInfo` | `?id=` | `{ id, storeId, storeName, trxDate, remark, status, lines: [{ sku, productCode, productName, varLabel, varDetails, qty }] }` |

- Checkout status seen: `"Y"`. There is **no approve or void step** for checkouts in the docs.

## Adjustment, Transfer, Stock count: the same workflow

**Save** (creates a pending transaction) → *optional* **Scan Compare** (check scanned tags against it) →
**Approve** with scan (`{ id, epcs[] }`) or without scan (`{ id, remark, internalNote }`). **Stock only changes on approval.**
**Void** (`{ id, remark, internalNote }`) cancels it, and works **only before approval**.

| | Save | Scan compare | Approve (scan) | Approve (no scan) | Void | List | Info |
|---|---|---|---|---|---|---|---|
| Adjustment | `POST /Stock/Adjustment` `{ storeId, trxType, trxDate, remark, epcs[] }` | (docs point to the Save URL) | `POST /Stock/AdjustmentApproveScan` | `POST /Stock/AdjustmentApproveNoScan` | `POST /Stock/AdjustmentVoid` | `GET /Stock/AdjustmentList?dateFrom&dateTo&storeId` | `GET /Stock/AdjustmentInfo?id` |
| Transfer | `POST /Stock/Transfer` `{ fromStoreId, toStoreId, trxDate, remark, epcs[] }` | `POST /Stock/TransferScanCompare` `{ id, epcs[] }` | `POST /Stock/TransferApproveScan` | `POST /Stock/TransferApproveNoScan` | `POST /Stock/TransferVoid` | `GET /Stock/TransferList?dateFrom&dateTo&fromStoreId` | `GET /Stock/TransferInfo?id` |
| Stock count | `POST /Stock/StockCount` `{ skus[], storeId, trxDate, remark, epcs[] }` | `POST /Stock/StockCountScanCompare` `{ id, epcs[] }` | `POST /Stock/StockCountApprove` | `POST /Stock/StockCountApproveNoScan` | `POST /Stock/StockCountVoid` | `GET /Stock/StockCountList?dateFrom&dateTo&storeId` | `GET /Stock/StockCountInfo?id` |

All Save/Approve/Void calls return `{ trxId }`.

**List rows**
- Adjustment: `{ id, trxId, trxType, storeId, storeName, trxDate, remark, status }`
- Transfer: `{ id, trxId, fromStoreId, fromStoreName, fromStoreCode, toStoreId, toStoreName, toStoreCode, trxDate, remark, status }`
- Stock count: `{ id, refno, storeId, storeName, trxDate, remark, status, statusName, totalCounted, totalExpected, totalVariance }`

**Info** = the list row plus `lines[]`, **one line per SKU** (not per tag) with `{ sku, productCode, productName, varLabel, varDetails }` and:
- Adjustment: `qtyIn`, `qtyOut`
- Transfer: `qty`, `trxType` (`TFO` = out of the source store, `TFI` = into the destination)
- Stock count / Scan compare: `counted`, `expected`, `variance` (+ `qty`)

## Codes

| Code | Meaning | Source |
|---|---|---|
| `ADI` / `ADO` | Adjustment in (stock up) / out (stock down) | examples |
| `TFO` / `TFI` | Transfer out / in (lines of one transfer) | examples |
| Stock count status `10` | Pending Review | `statusName` |
| Stock count status `30` | Approved | `statusName` |
| Scan compare status `0` | (probably: pending / not approved) | examples, **unconfirmed** |
| Adjustment / Transfer status `1` | **not documented** | |
| Checkout status `"Y"` | **not documented** (probably: done) | |
| Tag status `"1"` | **not documented** | |

## Open questions for the team

1. What do the status codes mean (adjustment/transfer `1`, scan compare `0`, checkout `"Y"`, tag `"1"`), and which other values exist?
2. **Checkout without RFID:** `epcs` only. How should we remove stock for an item that has a barcode but no tag?
3. **Returns:** checkouts can't be voided. Is a return = an `ADI` adjustment (save + approve no scan)? Or should a checkout be updated (`id`) to remove the returned tags?
4. **Prices:** `Product/List` has `price` per SKU. Is that the selling price to use at the till? Who maintains it (their system, Shopify, or ALTAI)?
5. Does `MERCHANTID` still matter, or is the merchant taken from the session?
6. Is there a **test server** we can use for checkouts and approvals, so we don't change live stock while building?
