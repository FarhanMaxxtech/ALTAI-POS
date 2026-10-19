# ALTAI-POS

A point-of-sale system for apparel and retail stores: products with size/colour variants, SKU and barcode/RFID (EPC) lookup, multi-location inventory, and a cashier till app.

## Apps in this repository

| Folder | What it is | Tech |
|---|---|---|
| `backend/` | REST API + business rules + database | Node.js, Express.js |
| `admin-web/` | Admin / back-office website | React.js |
| `pos-app/` | Cashier till app | Flutter (Dart) |
| `docs/` | Decisions, API contracts, retail domain notes | Markdown |

```
pos-app (Flutter) ──┐
                    ├──► backend (Express API) ──► database
admin-web (React) ──┘          │
                               └──► team's tag-lookup API
```

## How to run

1. **backend**: see `backend/README.md` (PostgreSQL, `.env`, `npm run dev` on port 3001)
2. **admin-web**: see `admin-web/README.md` (`npm run dev`, then open http://localhost:5173)
3. **pos-app**: not started yet

## Rules

- Never commit `.env` files. Commit `.env.example` with placeholder values only.
- Business rules (pricing, tax, stock) live in `backend/src/services/`, not in routes or controllers.
- Every code change that touches money or stock gets a test.
