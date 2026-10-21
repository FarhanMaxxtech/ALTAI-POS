# Customers & campaigns

## In plain words

- **Customers** are your regulars, registered at the till or in the admin site. The **phone number** identifies them: the cashier asks for it, and it's also their WhatsApp address. Name is required; email, birthday and notes are optional.
- **Consent:** when registering, the cashier asks two questions and ticks only what the customer agrees to:
  - "May we send you promotions by **WhatsApp**? You can stop any time by replying STOP."
  - "May we send you promotions by **email**? You can unsubscribe any time."
- **Campaigns** are promotional messages written once and sent to everyone who said yes on that channel. `{first_name}` and `{name}` are filled in per customer, and a "how to stop" line is always added at the end.

## Rules (and where they're enforced)

| Rule | Enforced by |
|---|---|
| One customer per phone number per business; any way of typing the number counts as the same | `lib/phone.js` (standard +60… form) + unique index `customers_one_per_phone` |
| Consent is **never** assumed: it defaults to "no" and is asked per channel | Schema defaults, unticked boxes in the form |
| Every yes/no is kept forever with who recorded it, when and how | `customer_consents` (append-only) |
| Promotions only go to customers who said yes on that channel, have an address, and aren't erased | `audienceQuery` in `campaign.service.js` |
| Every message ends with how to stop (STOP / UNSUBSCRIBE) | `renderMessage` |
| Removing a customer's email ends their email promotions (recorded) | `updateCustomer` |
| A campaign is sent once, then can't be edited; pressing Send twice sends once | Row lock + status check |
| "Delete my data": name, phone, email, notes are erased, including copies in sent messages; the anonymous record stays | `eraseCustomer` |
| Each business only sees its own customers and campaigns | Every query filters by `merchant_id` |

## Preview mode (today)

`MESSAGING_MODE=preview`: "Send" records each personal message as **previewed**. **Nothing is sent.** The page says so clearly.

To send for real, `services/messaging/index.js` needs a provider:
- **Email:** an SMTP mailbox, or a service like SendGrid / Amazon SES.
- **WhatsApp:** the WhatsApp Business Platform (Cloud API) from Meta. It needs a verified business, a dedicated number, and **pre-approved message templates** for promotions, and there's a cost per message.

Before going live, also switch to an **outbox**: save messages as "queued" and let a separate worker send them (see the note in `sendCampaign`). And handle replies such as STOP automatically (today staff record them by hand with "Replied to a message").

## Not yet built

- Linking customers to sales (purchase history, "last visit"), and loyalty points: comes with the checkout.
- Audience filters (e.g. only one store, birthdays this month, haven't visited in 90 days).
- Automatic STOP / UNSUBSCRIBE handling from real providers.
