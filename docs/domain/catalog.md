# Catalog: products, variants, SKUs

## The model

```
categories ──< products ──< variants
 (tree)        (a style)     (one sellable size × colour)
```

| Concept | Example | Table |
|---|---|---|
| **Category** | Tops → T-Shirts | `categories` (`parent_id` makes a tree) |
| **Product** (style) | "Classic Tee", style code `CT-001`, RM 49.90 | `products` |
| **Variant** | Black / M, SKU `CT-001-BLK-M`, barcode `9556…` | `variants` |

A T-shirt in 3 sizes × 4 colours is **1 product + 12 variants**. Reports can group by product ("how many Classic Tees did we sell?") or by variant ("which sizes sell out?").

## Rules (and where they're enforced)

| Rule | Enforced by |
|---|---|
| Style code and SKU are unique, case-insensitive (stored upper-case) | DB unique index + Zod `.toUpperCase()` |
| Barcode is unique (optional) | DB unique index |
| One variant per colour + size within a product | DB unique index `NULLS NOT DISTINCT` |
| Prices ≥ 0, max 2 decimals, never floats | DB `NUMERIC(12,2)` + CHECK, Zod regex |
| Variant price is optional: `effective_price = variant.price ?? product.base_price` | SQL `coalesce` in `product.service.js` |
| **SKU and style code can't be changed** after creation (labels and sales history refer to them) | Zod: not accepted on PATCH |
| Nothing is deleted; set `status = 'archived'` instead. Archived items can't be looked up for sale | `lookupByCode` filters `active` |
| A product and its variants are created together or not at all | DB transaction in `createProduct` |

**Money in the API is a string** (`"49.90"`), not a number, so it never goes through a float.

## Not in the catalog (on purpose)

- **RFID / EPC tags** identify one *physical item*, not a variant definition. They belong to **inventory** (`EPC → variant + location`).
- **Stock quantities**: inventory module.
- **Tax rates, promotions**: sales module.
- **The team's tag-lookup API**: still open (see `docs/api/tag-lookup.md`). If their system becomes the master for product data, this catalog becomes a synced copy.
