# 004: The team's API is the source of truth for stock, tags, stores and users

**Status:** Accepted (details pending the team's API docs)
**Date:** 2026-10-19
**Supersedes:** parts of 003 (local inventory)

## Context
The team already runs a REST API (`altairfid.com/rest`, used by the rfid_counter app). It covers login/sessions, stores, access control, tag lookup, EPC lists, SKU balance, adjustments, transfers and stock counts, each with approval flows. It has **no** prices, product list, sales, payments or receipts.

## Decision
1. Stock, RFID tags, stores and users/login live in the **team's API**. We don't keep our own copy. Two stock systems would drift apart.
2. Our Express backend is an **adapter** in front of it (`services/integrations/altai-api/`). It holds the API key (in `.env`) and translates their format into ours.
3. Our PostgreSQL keeps only what their API doesn't have: **sales, payments, prices, tax/discount settings, till sessions**.
4. Our own login system is **not built**. Login goes through their `Merchant/Login`, and we pass their session token to the tills.
5. The local inventory module (decision 003) is **paused**: kept in git, not extended, and retired once the team's endpoints are confirmed.

## Why not let the apps call their API directly?
- The API key would be inside every app (their app already has it written in its source, which anyone can extract from the APK).
- One adapter = one place to change when their API changes.
- The POS needs offline sales later; that needs a backend + queue anyway.

## Open questions for the team
1. API docs / Postman collection, and the exact `StoreList` and `TagLookup` fields.
2. A test server, and a separate API key for the POS.
3. Prices and a full SKU list: their API, or ours?
4. Which endpoint deducts stock when a sale happens (or will they add a sale endpoint)?
5. Rotate the API key that's hard-coded in the rfid_counter source.
