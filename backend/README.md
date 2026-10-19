# backend: Express API (Node.js)

The API that the till app (`pos-app/`) and the admin website (`admin-web/`) both talk to.

## How a request flows

```
HTTP request
  → routes/        which URL + method goes to which controller
  → middleware/    runs first: auth check, input validation, error handling
  → controllers/   thin: read req, call a service, send JSON (no business rules here)
  → services/      business rules: pricing, tax, stock, payments
  → db/            database connection, schema/migrations, queries
```

## Folders

| Folder | Responsible for |
|---|---|
| `src/config/` | Reads environment variables (`.env`) in one place |
| `src/routes/` | URL definitions, grouped by feature |
| `src/middleware/` | Auth, validation, error handler |
| `src/controllers/` | Translate HTTP ↔ service calls |
| `src/services/catalog/` | Products, variants (size × colour), SKUs, barcodes |
| `src/services/inventory/` | Stock per location, movement ledger, transfers, counts |
| `src/services/sales/` | Cart totals, discounts, tax, payments, returns |
| `src/services/integrations/tag-lookup/` | The **only** code that calls the team's tag-lookup API |
| `src/db/` | Database connection and migrations (ORM choice: see `docs/decisions/`) |
| `tests/` | Automated tests, from day one |

Rule: if two controllers need the same calculation, it belongs in `services/`, written once and tested.

## Setup

_Not set up yet._ `npm init` and Express come next.
