# 001: Tech stack

**Status:** Draft. Rewrite the "Why" section in your own words.
**Date:** 2026-10-19

## Decision
- Backend: Node.js + Express.js (JavaScript) for the REST API and business rules.
- Admin website: React.js, a separate app that calls the API.
- Database: to be decided (e.g. MySQL or PostgreSQL), plus how we access it from Node (ORM or plain SQL).
- Till app: Flutter (Dart), targeting Android POS devices first.
- Product/tag lookup: use the in-house tag-lookup API from the other dev team (details in `docs/api/`).

## Why
- _TODO (you):_ Why Node/Express + React instead of PHP/Laravel? (Hint: what the team now uses, one language, JavaScript, for API and web)
- _TODO (you):_ Why Flutter for the till instead of React?
- _TODO (you):_ Why reuse the team's tag-lookup API instead of building our own?

## Consequences
- The till depends on the backend being reachable. Offline mode is a later decision.
- All original code is written fresh. Nothing is copied from any previous employer's system.
