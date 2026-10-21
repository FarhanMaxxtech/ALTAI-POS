# Shifts & cash API

Base URL (dev): `http://localhost:3001/api`. Every route needs `Authorization: Bearer <token>`.
Money is always a string with up to 2 decimals (`"129.50"`), never a JSON number with fractions.

| Method | Path | Body / query | Success |
|---|---|---|---|
| GET | `/shifts` | `?store_id=&status=open\|closed&limit=30&offset=0` (newest first) | `200 { shifts }` |
| GET | `/shifts/current` | `?store_id=12&register=T1` | `200 { shift }` (with report + movements), or `{ shift: null }` if the till is closed |
| POST | `/shifts` | `{ store_id, register, opening_float }` | `201 { shift }` |
| GET | `/shifts/:id` | | `200 { shift }` |
| POST | `/shifts/:id/movements` | `{ type: "pay_in"\|"pay_out"\|"drop", amount, reason? }` (reason required for pay_out) | `201 { shift }` |
| POST | `/shifts/:id/close` | `{ counted_cash, breakdown?, note? }` | `200 { shift }` (the Z report) |

`breakdown` (optional): count per note/coin, e.g. `{ "100": 1, "20": 1, "5": 1 }`. Allowed keys:
`100, 50, 20, 10, 5, 1, 0.50, 0.20, 0.10, 0.05`. It must add up to `counted_cash`.

## The `report` inside every shift

```json
{ "opening_float": "200.00", "pay_ins": "50.00", "pay_outs": "20.50", "drops": "100.00",
  "cash_sales": "0.00", "cash_refunds": "0.00", "expected_cash": "129.50", "movement_count": 3 }
```

A closed shift also has `expected_cash`, `counted_cash`, `variance` (`"-4.50"` = short), `count_breakdown`, `close_note`, `closed_by_name` and `closed_at`.

## Errors

| Status | When |
|---|---|
| 400 | Invalid input, pay-out without a reason, or the breakdown doesn't add up |
| 401 | No token, an edited token, or an expired one |
| 403 | The store isn't in your account's store list |
| 404 | Shift not found (or it belongs to another business) |
| 409 | The till already has an open shift · not enough cash for a pay-out/drop · the shift is already closed |
