# Inventory: locations, stock, ledger, RFID

## The model

```
locations ──< stock_levels >── variants      "how many Black/M tees at KL store?" → quantity
     │              ▲
     │              │ updated together, in one transaction
     └──< stock_movements                     "why?": every +/− change, append-only
          stock_transfers                     groups the out + in movements of one transfer
          rfid_tags (EPC → variant, location)  "which exact items?": one row per tagged item
```

## Movement types

| Type | Sign | Created by |
|---|---|---|
| `receive` | + | Goods arrive (purchase order, supplier delivery) |
| `adjust` | ± | Manual correction. **Reason required** (damaged, found, theft…) |
| `count` | ± | Stock take: system sets quantity to what was counted, records the difference |
| `transfer_out` / `transfer_in` | − / + | Moving stock between locations (always a pair, same `reference_id`) |
| `sale` / `return` | − / + | Reserved for the sales module |

## Rules (and where they're enforced)

| Rule | Enforced by |
|---|---|
| **All stock changes go through `applyChanges()`** in `stock.service.js` | Code structure: nothing else writes `stock_levels` |
| No lost updates when two tills sell the same item at once | `SELECT … FOR UPDATE` row lock inside a transaction. **Proven by the concurrency test** (without the lock, 11 of 20 sales succeed against a stock of 10) |
| No deadlocks | Rows are always locked in `(location_id, variant_id)` order |
| Stock never goes negative: the operation fails with 409 `Insufficient stock` | Service check + DB `CHECK (quantity >= 0)` |
| Ledger always explains the balance: `sum(quantity_change) = quantity` | Same transaction; asserted in tests |
| Multi-line operations are all-or-nothing (one bad line rolls back the whole transfer) | DB transaction |
| Movements are never edited or deleted. Mistakes are fixed with a new `adjust` | Convention (no update/delete endpoints) |
| Archived locations can't take stock operations | `assertActiveLocations` |

## RFID / EPC

- A **barcode** is the same on every Black/M tee; an **EPC** is unique to *one* physical item.
- `POST /rfid/tags` registers ("commissions") EPCs for a variant after the tags are encoded.
- `POST /rfid/resolve` turns a batch read (hundreds of EPCs) into variants. The till uses it to fill a cart, and handhelds use it for counts.
- **Tags never change quantities.** Counting by RFID = resolve the EPCs, group by variant, then send the totals to `POST /inventory/count`.
- Not yet: linking EPCs to receive/transfer/sale movements, and the team's tag-lookup API (see `docs/api/tag-lookup.md`).

## Not yet built

- Two-step transfers (ship → in transit → receive). Transfers are currently instant.
- Reservations / holds, purchase orders, suppliers, cost price and stock valuation.
- `created_by` on movements (needs the auth module).
