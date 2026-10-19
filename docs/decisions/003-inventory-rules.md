# 003: Inventory rules

**Status:** Accepted (revisit after store trials)
**Date:** 2026-10-19

## Decisions
1. **Stock is per location × variant**, with an append-only movement ledger. The balance and the ledger row are written in one transaction.
2. **Pessimistic row locking** (`SELECT … FOR UPDATE`) in one shared function, `applyChanges()`. Rows are locked in a fixed order to avoid deadlocks.
3. **Stock may not go negative.** A sale or transfer of more than is recorded fails with 409.
4. **Transfers are instant** (out + in in one transaction) for now.
5. **RFID tags are an identity layer** and never change quantities directly.

## Why
- (1, 2) The previous system kept one global count, read it without locking, and could lose updates under concurrent sales. A test now proves the lock prevents this.
- (3) The previous system clamped stock at 0 (`max(0, …)`), which hid overselling and broke the ledger. Failing loudly keeps the numbers trustworthy.
- (4) Simplest correct version. Real stores ship goods that are "in transit" for days, so a ship/receive flow will be needed.
- (5) Not every item is tagged, and tags get lost. Quantities stay the single source of truth; tags help count and find items.

## Trade-offs to revisit
- **Negative stock at the till:** in practice the item is in the customer's hand even if the system says 0. The sales module may need a manager override that records an `adjust` with a reason instead of blocking the sale.
- **Lock contention:** fine for a few tills per store; a very busy single SKU (e.g. a shopping bag) may need a different approach later.
