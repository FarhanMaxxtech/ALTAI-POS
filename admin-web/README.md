# admin-web: React admin website

Back-office site for owners and managers: catalog setup, inventory, reports. It never touches the database directly. It only calls the `backend/` API.

| Folder | Responsible for |
|---|---|
| `src/api/` | One API client (base URL, auth token, error handling), used by every feature |
| `src/components/` | Reusable UI pieces (buttons, tables, forms) |
| `src/features/auth/` | Login, current user |
| `src/features/catalog/` | Products, variants, SKUs, barcodes |
| `src/features/inventory/` | Stock levels, stock-in, transfers, counts |
| `src/features/reports/` | Sales and stock reports |

## Setup

_Not set up yet._ It will be created with Vite (`npm create vite@latest`, React template). Choose "Ignore files and continue" because this folder already exists.
