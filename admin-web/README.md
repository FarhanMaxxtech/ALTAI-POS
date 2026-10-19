# admin-web: React admin website

Back-office site for owners and managers: catalog setup, inventory, reports. It never touches the database directly. It only calls the `backend/` API.

| Folder | Responsible for |
|---|---|
| `src/api/` | One API client (base URL, auth token, error handling), used by every feature |
| `src/components/` | Reusable UI pieces. `AppShell` = top bar around signed-in pages |
| `src/features/auth/` | Login page (ID + password, or staff badge), `AuthContext` (who is logged in), `RequireAuth` (route guard) |
| `src/features/home/` | First page after login: welcome + store list |
| `src/features/catalog/` | Products, variants, SKUs, barcodes (not built yet) |
| `src/features/inventory/` | Stock levels, transfers, counts (not built yet) |
| `src/features/reports/` | Sales and stock reports (not built yet) |

Built with **Vite + React 19 + React Router**. Plain CSS in `src/index.css` (colour variables at the top, light and dark mode).

## Run it

1. Start the backend first (`cd ../backend && npm run dev`). It must listen on **port 3001**.
2. Then:
   ```
   npm install
   npm run dev
   ```
3. Open `http://localhost:5173`.

In development, Vite forwards every `/api/...` request to `http://localhost:3001` (see `vite.config.js`).

## How login works

```
LoginPage ──POST /api/auth/login──► backend ──Merchant/Login──► team API
    │◄──── { token, user } ────────────┘
    ├─ token  → sessionStorage "altai.token"  (cleared when the browser closes)
    └─ user   → sessionStorage "altai.user"   (name, for display only)

Every later call: Authorization: Bearer <token>   (added by src/api/client.js)
Page reload:      GET /api/auth/me checks the saved token still works
Any 401:          token cleared → back to /login with "Your session has expired"
```

- **Staff badge:** a keyboard-style RFID reader types the EPC and presses Enter, which submits the form. The field is focused automatically and masked, because the EPC is a credential.
- The team's API allows **one session per account**, so logging in elsewhere with the same account signs this browser out.
- In development React runs effects twice on purpose (`StrictMode`), so you'll see each API call twice in the network tab. That doesn't happen in production builds.
