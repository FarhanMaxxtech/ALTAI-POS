# Customers & campaigns API

Base URL (dev): `http://localhost:3001/api`. Every route needs `Authorization: Bearer <token>`.
Phone numbers can be sent in any common form (`012-345 6789`, `+60123456789`…). They're stored and returned as `+60123456789`.

## Customers

| Method | Path | Body / query | Success |
|---|---|---|---|
| GET | `/customers` | `?q=<name, phone or email>&opted_in=whatsapp\|email&limit=50&offset=0` | `200 { customers }` |
| POST | `/customers` | `{ phone, name, email?, birthday? (YYYY-MM-DD), notes?, whatsapp_opt_in?, email_opt_in?, consent_source? }` | `201 { customer }` |
| GET | `/customers/:id` | | `200 { customer }` (with `consent_history`, newest first) |
| PATCH | `/customers/:id` | any of `phone, name, email, birthday, notes, home_store_id` | `200 { customer }` |
| POST | `/customers/:id/consent` | `{ channel: "whatsapp"\|"email", granted: true\|false, source }` | `200 { customer }` |
| POST | `/customers/:id/erase` | | `200 { customer }` (personal data removed) |

`source` (how the answer was given): `in_store`, `phone_call`, `online_form`, `customer_reply`, `staff_update`.

## Campaigns

| Method | Path | Body / query | Success |
|---|---|---|---|
| GET | `/campaigns` | `?limit=30&offset=0` | `200 { campaigns }` |
| POST | `/campaigns` | `{ name, channel, subject? (email: required), body }` | `201 { campaign }` (draft) |
| GET | `/campaigns/:id` | | `200 { campaign }` |
| PATCH | `/campaigns/:id` | any of `name, channel, subject, body` (drafts only) | `200 { campaign }` |
| GET | `/campaigns/:id/preview` | | `200 { campaign, delivery_mode, recipient_count, samples: [{ name, to_address, body }] }` |
| POST | `/campaigns/:id/send` | | `200 { campaign }` (status `sent`, `delivery_mode` `preview`\|`live`) |
| GET | `/campaigns/:id/messages` | `?limit&offset` | `200 { messages: [{ customer_name, to_address, body, status }] }` |

In the `body`, `{first_name}` and `{name}` are replaced per customer. The opt-out line is added automatically.

## Errors

| Status | When |
|---|---|
| 400 | Invalid phone/email/date, email promotions without an email, email campaign without a subject |
| 401 | No token, an edited token, or an expired one |
| 404 | Not found, or it belongs to another business |
| 409 | Phone already registered (`details[0].customer_id` = who has it) · campaign already sent · nobody opted in · customer erased |
| 503 | `MESSAGING_MODE=live` but no provider is connected |
