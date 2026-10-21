# Intern plan

**You own:** `admin-web/` (the React back-office site) and `docs/domain/` (retail research).
**Your reviewer:** the lead. Every change goes through a pull request.
**Ask for help** after 30 minutes stuck. That's expected, not a failure.

---

## Day 1: set up

- [ ] Get access to the Git repository and clone it
- [ ] Install: Git, Node.js 22 or newer, PostgreSQL 18, VS Code
- [ ] Backend: follow `backend/README.md` → Setup
  - Create your own database role and database (step 1)
  - Copy `.env.example` to `.env`. Get the API key from the lead **privately**. Never paste it in chat, code or commits
- [ ] Run `npm test` in `backend/`. All tests should pass
- [ ] Start the backend (`npm run dev`, port 3001) and admin-web (`npm run dev`, port 5173)
- [ ] Log in at http://localhost:5173 with the test account the lead gives you
- [ ] Read, in this order:
  - `README.md`
  - `backend/README.md` and `admin-web/README.md`
  - `docs/decisions/001` to `004`
  - `docs/domain/catalog.md`
  - `docs/api/altai-adapter.md`

**Done when:** you're logged in and can see the store list on the home page.

---

## Week 1: learn how retail checkout works

Write everything into **`docs/domain/retail-pos-features.md`**, with links to your sources.

- [ ] **Watch real checkouts** at 2–3 apparel stores (e.g. Uniqlo, H&M, Padini). Write down:
  - the steps of a normal sale, a return and an exchange
  - which payment types they accept
  - what's printed on the receipt
  - Don't photograph people, or receipts that show personal data.
- [ ] **SST (Sales and Service Tax).** Find out:
  - which rate applies to clothing sold in a store
  - whether prices are shown with tax included
  - what a receipt must show for tax
  - Use official sources: `mysst.customs.gov.my`, `customs.gov.my`
- [ ] **LHDN e-invoicing (MyInvois).** Find out:
  - which phase and income threshold apply when
  - what a store selling to the public (B2C) must do, e.g. consolidated e-invoices
  - Source: `hasil.gov.my`
- [ ] **Payment methods** in Malaysian stores: cards, DuitNow QR, e-wallets (Touch 'n Go, GrabPay, Boost…). Which ones need a terminal, and which work by QR?
- [ ] **Feature checklist.** Compare public POS products (Shopify POS, Lightspeed Retail, StoreHub) and fill in this table:

  | Feature | Must / Should / Later | Notes |
  |---|---|---|

- [ ] **Learn React basics:** the "Learn" section of react.dev (components, props, state, effects), plus React Router basics.

**Done when:** the document is in a pull request and you've walked the team through it (30 min, Friday).

---

## Week 1: first code task (store settings page, read-only)

- [ ] Create a branch: `intern/store-settings-page`
- [ ] Build the page in `src/features/settings/SettingsPage.jsx`
- [ ] Switch it on: in `src/navigation.js` set the Settings item to `status: 'ready', page: 'settings'`, and add `settings: SettingsPage` to `pages` in `src/App.jsx`. The sidebar link already exists
- [ ] Show the store's name, address, tax setting and receipt footer
  - The backend endpoint doesn't exist yet. Use the example response in `docs/api/prices-tax.md` (the lead writes it) as temporary data
- [ ] Handle the three states, like `HomePage.jsx` does:
  - loading
  - error
  - empty
- [ ] Check it at phone width (about 400 px wide)

**Done when:** the pull request is approved and merged.

---

## Phase 1: prices & tax (weeks 2–3)

- [ ] **Price list page:**
  - search by style code or name
  - a table of the variants (size, colour, SKU) with their prices
  - edit one price
  - update all variants of a style at once
- [ ] **Store settings page:** make it editable (save, validation errors, success message)
- [ ] **Pricing test checklist:** `docs/testing/pricing-checklist.md`. Write what to try, and what should happen. Examples:
  - a price of 0
  - 3 decimals
  - a negative price
  - tax-inclusive vs. tax-exclusive
  - a variant without its own price

## Phase 2: checkout (weeks 4–6)

- [ ] **Sales list page:** filter by date, store and cashier
- [ ] **Sale detail page:** the lines, discounts, payments, receipt number
- [ ] **Test data:** 20 example products in sizes × colours, as a JSON file the lead reviews
- [ ] **End-to-end test script:** a written, step-by-step full sale, from scanning to the printed receipt

## Phase 3: shifts (week 7)

- [ ] Daily Z report page per store
- [ ] Cash variance view: expected vs. counted cash, per shift

## Phase 4: returns (weeks 8–9)

- [ ] Returns report page
- [ ] Test cases:
  - partial return
  - exchange of size or colour
  - refund to card
  - return without a receipt (what should happen?)

## Customers & campaigns (built by the lead; you test and research)

- [ ] **Test checklist:** `docs/testing/customers-checklist.md`. Try, and write what should happen:
  - the same phone typed 4 different ways
  - a customer who says yes to WhatsApp, then replies STOP
  - erasing a customer, then registering the same phone again
  - a campaign when nobody has agreed yet
- [ ] **Research: sending for real.** Write `docs/domain/messaging-providers.md`:
  - WhatsApp Business Platform (Meta): what's needed (business verification, phone number, message templates), and the cost per marketing message in Malaysia
  - Email: 2–3 options (company SMTP, SendGrid, Amazon SES), with costs and limits
- [ ] **Research: PDPA and marketing consent.** Is our consent wording (`admin-web/src/features/customers/consent.js`) clear and fair? What must we do when a customer asks for their data? Official source: `pdp.gov.my`

## Every week

- [ ] 15-minute stand-up each morning: what you did, what's next, what's blocking you
- [ ] Update the docs whenever something you built changes how things work

---

## Rules

1. **One branch per task, small pull requests.** Nobody pushes straight to `main`.
2. **Only change `admin-web/` and `docs/`.** For `backend/` or `pos-app/`, ask the owner first.
3. **Never commit `.env`**, and never put an API key or password in code or chat.
4. **Don't use any other company's code.** Learn from public docs, real stores and our own `docs/`.
5. **If a task has no clear "done when", ask** before starting.
