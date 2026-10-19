# 002: Database: PostgreSQL + Knex

**Status:** Accepted
**Date:** 2026-10-19

## Decision
- **PostgreSQL** (v18, already installed locally) is the database.
- **Knex** (query builder + migrations) with the **pg** driver is how the backend talks to it.
- Local dev database `altai_pos_dev`, owned by a dedicated role `altai_app`. The app never connects as the `postgres` superuser.

## Why
- Retail stock and money need reliable **transactions**, **row locks** (`SELECT … FOR UPDATE`) and an exact **NUMERIC** type. PostgreSQL is strong on all three.
- Knex stays close to SQL, so we learn SQL itself, and locking is explicit (`.forUpdate()`). Prisma was the alternative: more automatic, but it hides more SQL and makes row locks awkward.
- Migrations give every machine the same schema, in order, from files in git.

## Consequences
- Schema changes happen **only** through migration files in `backend/src/db/migrations/`, never by editing tables by hand.
- Money columns use `NUMERIC(12,2)` (or integer cents). Never `float`.
