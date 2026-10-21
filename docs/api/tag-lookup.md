# Team API: what we know so far

Learned from the rfid_counter app's `api_service.dart` (2026-10-19). Still to confirm with the team's docs.

- **Base URL:** `https://altairfid.com/rest` (production). Test server: _unknown, ask_
- **Auth:** header `APIKEY` (app key) + `MERCHANTID` + `SESSION` (from `Merchant/Login`, returned as a response header). Never paste real keys here.
- **Session expired:** HTTP **440**. One active session per login.
- **Errors:** may come back as HTTP 200 with `{ "error": "…" }`.
- **Input for lookup:** one EPC per `Stock/TagLookup` call. The rfid_counter app limits itself to 5 in parallel.
- **Output:** see `altai-adapter.md`. No price is returned.
- **Source of truth:** their API for stock/tags/stores/users (decision 004). Prices and sales: _open_.

## Endpoints seen in the rfid_counter app

| Area | Endpoints | Used by our adapter |
|---|---|---|
| Auth | `Merchant/Login`, `Merchant/AccessControl` | Login ✅ |
| Stores | `Stock/StoreList` | ✅ |
| Tags | `Stock/TagLookup`, `Stock/EpcList`, `Stock/UpdateTag` | TagLookup ✅, EpcList ✅ (stock levels) |
| Balance | `Stock/SkuBalance` | ✅ |
| Adjustments | `Stock/Adjustment`, `…List`, `…Info`, `…Void`, `…ApproveScan`, `…ApproveNoScan` | List + Info ✅ (view only) |
| Transfers | `Stock/Transfer`, `…List`, `…Info`, `…Approve`, `…ApproveScan` (unconfirmed) | List + Info ✅ (view only) |
| Stock count | `Stock/StockCount`, `…List`, `…Info`, `…Approve` | List + Info ✅ (view only) |
