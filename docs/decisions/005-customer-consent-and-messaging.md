# 005: Customers by phone, recorded consent, messaging in preview mode first

**Status:** Accepted
**Date:** 2026-10-21

## Decisions
1. Customers are identified by **phone number**, stored in standard E.164 form (`+60123456789`), unique per business.
2. Promotional consent is asked **per channel** (WhatsApp, email), defaults to **no**, and every answer is stored in an **append-only history** (who, when, how).
3. Customers can ask for their personal data to be **erased**. The record stays anonymous, so totals still add up.
4. Campaigns are fully built, but messaging starts in **preview mode**: messages are recorded, never sent, until real email/WhatsApp accounts are connected.

## Why
- Phone is what Malaysian shoppers give at the till, and it doubles as the WhatsApp address.
- Malaysia's PDPA expects consent for direct marketing and a way to opt out. A history of answers is the evidence if a customer complains. (This is a design choice, not legal advice. Have the consent wording checked.)
- Sending real messages needs accounts we don't have yet (an email provider; a WhatsApp Business account with approved templates). Preview mode lets the team build and check everything without contacting anyone by accident.

## Consequences
- Going live = add a provider in `services/messaging/index.js`, switch to an outbox/worker for sending, and handle STOP/UNSUBSCRIBE replies automatically.
- The consent wording in `admin-web/src/features/customers/consent.js` should be reviewed before real use.
