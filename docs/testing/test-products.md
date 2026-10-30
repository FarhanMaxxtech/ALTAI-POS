# Test products

`test-products.json`: 20 example products (styles) with 109 variants, for testing the catalog, prices and checkout.

**Format:** an array of request bodies for `POST /api/products` (see `docs/api/catalog.md`). Load them one by one; each product is created together with its variants.

## What it covers

| Case | Products |
|---|---|
| Normal sizes × colours | CT-001 Classic Tee (4 × 3 = 12 variants) |
| Some variants priced differently (`price` set) | PL-002 Polo XL 74.90, HD-005 Hoodie XXL 99.90 |
| **Every** variant has its own price | BK-012 Baju Kurung |
| Numeric sizes | SJ-006 Slim Jeans, CH-007 Chinos (28–36) |
| Kids sizes | KT-014 Kids Tee (4Y–10Y) |
| Shoe sizes | SN-015 Sneakers (38–43) |
| Sizes in cm | BT-018 Leather Belt (90, 100, 110 cm) |
| One size | SC-016 Socks, CP-017 Cap |
| No size and no colour (only one variant possible) | TB-019 Tote Bag, GW-020 Gift Wrap |
| Price **0.00** | GW-020 Gift Wrap |
| Colour name with a space | OX-003 Oxford Shirt (Light Blue) |
| No barcodes | SH-008 Cargo Shorts, TB-019, GW-020 |

## Conventions

- **SKU** = style code + colour code + size, e.g. `CT-001-BLK-M`. One size = `OS`; belts drop the "cm" (`BT-018-BRN-90`).
- **Colour codes:** BLK Black, WHT White, NVY Navy, LBL Light Blue, BEI Beige, GRY Grey, BLU Blue, KHK Khaki, OLV Olive, MRN Maroon, PNK Pink, EMR Emerald, YLW Yellow, BRN Brown.
- **Barcodes** are valid EAN-13 numbers (correct check digit) starting with `9556000`. They are **made up**, not real GS1 codes, so don't print them on real labels.
- Prices are strings with 2 decimals (`"49.90"`), never numbers.

## Checked

- 20 unique style codes, 109 unique SKUs (all upper-case), 104 unique barcodes
- One variant per colour + size in each product
- All prices match `^\d{1,10}(\.\d{1,2})?$`

## Questions for the lead

1. Is the SKU pattern (style-colour-size) what we want for real products?
2. Should "no size" products have `size` left out (as here), or set to something like `"One Size"`?
3. Do we need categories in the test data too? (`category_id` needs real category IDs first.)
