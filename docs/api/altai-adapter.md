# Team API adapter (altairfid)

Our backend calls the team's API on behalf of the till and the admin site. The apps never see the API key.

```
pos-app ──Bearer <token>──► our backend ──APIKEY + MERCHANTID + SESSION──► altairfid.com/rest
```

Setup: put the key in `backend/.env` → `ALTAI_API_KEY=...` (ask the team for a key issued for the POS).
Without it, these routes answer `503`.

## Our endpoints

| Method | Path | Body / query | Calls | Success |
|---|---|---|---|---|
| POST | `/api/auth/login` | `{ login_id, password }` **or** `{ epc }` (staff badge) | `Merchant/Login` | `200 { token, user: { name, login_id, merchant_id } }` |
| GET | `/api/auth/me` | | `Merchant/AccessControl` | `200 { merchant_id, permissions: [{ id: 602130, name: "Stock Transfer" }, …] }` |
| GET | `/api/stores` | | `Stock/StoreList` | `200 { stores: [{ id, name, raw }] }` |
| POST | `/api/tags/lookup` | `{ epcs: [...] (≤200), store_id?, op_type? }` | `Stock/TagLookup` × n, max 5 in parallel | `200 { tags, unknown, failed }` |
| GET | `/api/stock/balance` | `?sku=&store_id=` | `Stock/SkuBalance` | `200 { sku, store_id, store_name, balance }` |
| GET | `/api/catalog/products` | `?q=` (name contains), `code=`, `sku=` (contains), `active=Y\|N`, `store_id=` (adds stock), `skus=0\|1`, `page=`, `page_size=` (≤100) | `Product/List` | `200 { page, page_size, total, products }`, see below |
| GET | `/api/catalog/products/:productId` | `?store_id=` | `Product/Info` | `200 { product }` · `404` unknown |

All except login need `Authorization: Bearer <token>` (the token from login).

**The token** packs the user's team-API `SESSION`, their `MERCHANTID` (from the login response), their
login id, name and an expiry time (`AUTH_TOKEN_HOURS`, default 12). It is **signed** (HMAC-SHA256 with
`AUTH_SECRET` from `.env`): any edit breaks the signature and the token is rejected with 401, before the
team API is even asked. That matters for data only we store (shifts, cash), where nobody else checks it.
The contents are readable, not secret: never put a password in it. Treat the whole token like a password.
Permissions come with their names from the team's system (`AccessControl`). ALTAI doesn't act on them yet.

A **product** (`/api/catalog/products`) is `{ product_id, product_code, product_name, description, active, images, sku_count, skus }`,
each SKU `{ sku_id, sku, active, price, cost, balance, stock_warn, variation, variations: [{ type, value }], images, remark }`.
`price` and `cost` are money strings (`"49.90"`) or null; `balance` is the stock at `store_id` (null without one).
These are the **team's** prices. Which prices the till uses (theirs or ALTAI's Prices module) is still open.

A tag in `tags` looks like:
```json
{ "epc": "E28011…", "sku": "CT-BLK-M", "product_name": "Classic Tee", "product_code": "CT",
  "variation": "Black / M", "variation_details": [{ "typeName": "Colour", "value": "Black" }],
  "store_id": "12", "store_name": "MidValley", "pending_transaction": false }
```

## Errors

| Our status | Cause |
|---|---|
| 400 | Our validation failed |
| 401 | Missing token, wrong login, or **session expired** (their 440). Then `details[0].code = "SESSION_EXPIRED"`: log in again |
| 404 | Their API answered `{ "error": … }` for a tag or SKU (not found) |
| 502 | Their API is unreachable or returned an error status |
| 503 | `ALTAI_API_KEY` is not set |
| 504 | Their API took longer than `ALTAI_API_TIMEOUT_MS` (default 8 s) |

## Things to know about their API

- **One active session per login.** Logging in again ends the previous session, so each till needs its own account.
- **A 200 response can still be an error** (`{ "error": "…" }`). The adapter checks for this.
- We **don't store passwords** to log in again automatically (the rfid_counter app does). The till asks the user again.
- The team's endpoints are summarised in [team-api-reference.md](team-api-reference.md) (from their Postman docs). TagLookup's store and pending-transaction fields are still not in those docs.

## Not yet verified against the real server

All tests run against a fake copy of the API. First real check, once the key is in `.env`:
1. `npm run dev`
2. `POST /api/auth/login` with a real (test) account → you get `token`
3. `GET /api/stores` with `Authorization: Bearer <token>` → check `raw` shows the real field names
