# Prices, tax & settings

## Prices

Products and SKUs live in the team's system; **prices live in ALTAI** (their API has none).

- Every SKU can have a **default price** (all stores), and a **store price** that overrides it in one store (e.g. an outlet).
- **The price the till charges** = the store price if there is one, otherwise the default.
- **A SKU with neither can't be sold** until a price is set. The Products page flags it as "no price".
- **Every change is kept** in `price_history`: old → new, who, when, why. Typing the same price differently (`49.9` vs `49.90`) is not a change.
- **Many at once:** one price for up to 500 SKUs in one go (e.g. every size and colour of a style). It's all or nothing.

## SST (tax)

Set once per business in **Settings**:

| Setting | Default | Meaning |
|---|---|---|
| SST rate | **0%** | Must be set by someone who knows the correct rate for your goods (a tax question, not a software one) |
| Prices include SST | yes | The tag price already contains the tax (normal in Malaysian retail) |
| Cash rounding | yes | Cash totals are rounded to the nearest 5 sen (Bank Negara rounding mechanism) |

How the maths works (`lib/tax.js`, whole cents, tested):

```
Prices include SST:   tax = price × rate / (100 + rate)      RM 49.90 at 6% → tax 2.82, before tax 47.08, pays 49.90
Prices exclude SST:   tax = price × rate / 100               RM 49.90 at 6% → tax 2.99, pays 52.89
Cash rounding:        x.x1 x.x2 → x.x0 · x.x3 x.x4 → x.x5 · x.x6 x.x7 → x.x5 · x.x8 x.x9 → x.(x+1)0
```

The checkout (next module) will decide whether tax is calculated per line or on the receipt total. That's a question for whoever handles your SST returns.

## Receipt details

- **Business:** name, SSM number, SST registration number, default footer.
- **Per store:** address, phone, and a footer that overrides the default (e.g. a different return policy at the outlet).
- The Settings page shows a 32-character-wide preview (58 mm thermal paper).

## Not yet built / open

- Permissions: today any logged-in user can change prices and tax. Should be managers only, once the team's permission ids are known.
- Scheduled price changes (a sale price from date X to Y): together with promotions.
- Cost prices and margins.
