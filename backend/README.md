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
| `src/services/sales/` | Cart totals, discounts, tax, payments, returns (not built yet) |
| `src/services/shifts/` | Till shifts: open, pay-in/out, drops, X/Z report, close with variance |
| `src/services/customers/` | Customers (by phone), consent history, erasure; promotional campaigns |
| `src/services/messaging/` | The only code that would send a message to a customer (preview mode for now) |
| `src/lib/` | Small shared helpers: `money.js` (all cash maths in whole cents), `phone.js` (one standard phone format), validators, errors |
| `src/services/integrations/altai-api/` | The **only** code that calls the team's API (login, stores, tags, stock balance) |
| `src/db/` | Database connection and migrations (ORM choice: see `docs/decisions/`) |
| `tests/` | Automated tests, from day one |

Rule: if two controllers need the same calculation, it belongs in `services/`, written once and tested.

## Setup

Needs Node.js 22+ and PostgreSQL 15+ (we use 18).

1. Create the database role and database once (as the `postgres` admin, in `psql -U postgres`):
   ```sql
   CREATE ROLE altai_app LOGIN PASSWORD 'choose-a-password';
   CREATE DATABASE altai_pos_dev OWNER altai_app;
   ```
2. Copy `.env.example` to `.env` and set `DB_PASSWORD`.
3. Install and migrate:
   ```
   npm install
   npm run migrate
   ```
4. Run: `npm run dev` → check `http://localhost:3001/health` says `"database": "connected"`.

| Script | Does |
|---|---|
| `npm run dev` | Start with auto-restart on save |
| `npm test` | Run all tests (uses the dev DB, cleans up after itself) |
| `npm run migrate` | Apply new migrations |
| `npm run migrate:rollback` | Undo the last batch of migrations |
| `npm run migrate:make <name>` | Create a new migration file |

API reference: `docs/api/`. Domain rules: `docs/domain/`.
