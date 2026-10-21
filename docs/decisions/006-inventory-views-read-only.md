# 006: Inventory in ALTAI admin is view-only (for now)

**Status:** Accepted
**Date:** 2026-10-21

## Decision
ALTAI admin shows stock levels, transfers, stock counts and adjustments from the team's API, **read-only**.
Creating, approving and voiding them stays in the team's own website and the RFID handheld app.

## Why
- The team's API is the source of truth for stock (decision 004), and their website already handles approvals. The rfid_counter code marks approve/void as "website-only".
- Those actions change real stock in a live system. There's no test server yet, and the rfid_counter code still has open questions about several of these endpoints ("TODO: confirm with backend").
- Read-only views can't damage anything, so they're useful from day one.

## How it works
- **Stock levels** = every tagged item in a store from `Stock/EpcList` (paged, 200 per page, up to 10,000 per store), counted per SKU and split by the tag's status in their system. The list is cached for 60 seconds per store; "Refresh" fetches it again.
- **RFID tags** = a read-only inspector (TagLookup per tag + one EpcList call with the whole list for status) and a search across a store's cached tag list. Assigning tags (`Stock/UpdateTag`) stays in the handheld app; their API has no way to mark tags missing/sold.
- **Transfers / counts / adjustments / checkouts** = `Stock/TransferList|StockCountList|AdjustmentList|CheckoutList` and their `…Info` endpoints, mapped to the field names in the team's Postman docs (docs/api/team-api-reference.md, added 2026-10-21). The original record (`raw`) is still returned.

## To revisit when
- The team explains their status codes (adjustment/transfer `1`, checkout `"Y"`, tag `"1"`): add the meanings to `STATUS_NAMES` in `stock.js`.
- The team provides a test server and confirms the approve/void endpoints: actions can then be added here.
- A store has more than 10,000 tags: page through on demand instead of fetching everything.
