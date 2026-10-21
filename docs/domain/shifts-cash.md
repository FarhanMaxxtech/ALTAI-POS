# Shifts & cash

## In plain words

A **shift** is one cashier's session on one till, from opening to closing.

1. **Open:** count the change put into the drawer (the **opening float**, e.g. RM 200) and open the shift.
2. **During the day:** cash goes in and out of the drawer:
   - **Pay-in:** cash added, e.g. more change from the safe
   - **Pay-out:** cash taken out for a small expense, e.g. cleaning supplies (**reason required**)
   - **Cash drop:** cash moved from the drawer to the safe, so the drawer doesn't hold too much
   - **Cash sale / cash refund:** added automatically by the checkout (not built yet)

   At any moment the **X report** shows the running totals and how much cash *should* be in the drawer.
3. **Close:** count the drawer, ideally note by note. The system compares it with the expected cash and saves the difference (**variance**). That final summary is the **Z report**.

```
Expected cash = opening float + pay-ins + cash sales − pay-outs − drops − cash refunds
Variance      = counted − expected        (negative = short, positive = over, 0 = balanced)
```

## Rules (and where they're enforced)

| Rule | Enforced by |
|---|---|
| One open shift per till (store + register) | Database partial unique index `shifts_one_open_per_register` |
| You can only open a shift in a store your account can access | Team API store list, checked in `openShift` |
| A pay-out needs a reason | Request validation (`schemas.js`) |
| You can't take out more cash than the drawer should hold | `addMovement` (409 "Not enough cash in the drawer") |
| No movements on a closed shift; a shift is closed only once | Row lock (`SELECT … FOR UPDATE`) + "close only if still open" update |
| If notes and coins are counted, they must add up to the counted cash | `closeShift` (400) |
| All money maths in whole cents (no rounding drift); DB uses `NUMERIC(12,2)` | `lib/money.js`, tested |
| Movements are never edited or deleted | Convention: no update/delete endpoints |
| Every shift and movement records **who** did it (from the signed login token) | `requireSession` → `req.user` |
| A business only ever sees its own shifts | Every query filters by `merchant_id` |

## Not yet built

- Cash sales and refunds from the checkout (the movement types exist; the checkout will write them).
- Manager approval for large pay-outs or a big variance (needs the team's permission ids mapped).
- Printing X/Z reports on the receipt printer (till app).
- Card / QR payment totals on the Z report (with the checkout).
