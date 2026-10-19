# Inventory API

Base URL (dev): `http://localhost:3001/api`. Every response has `ok: true|false`. ⚠ No authentication yet.

## Locations

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/locations` | | `200 { locations }` |
| POST | `/locations` | `{ code, name, type?: "store"\|"warehouse" }` | `201 { location }` |
| PATCH | `/locations/:id` | any of `name, status` | `200 { location }` |

## Stock

| Method | Path | Body / query | Success |
|---|---|---|---|
| GET | `/inventory/stock` | `?location_id=&variant_id=&sku=` | `200 { stock: [{ location_code, sku, product_name, color, size, quantity }] }` |
| GET | `/inventory/movements` | `?location_id=&variant_id=&limit=50&offset=0` (newest first) | `200 { movements }` |
| POST | `/inventory/receive` | `{ location_id, lines: [{ variant_id, quantity }], reason? }` | `201 { movements }` |
| POST | `/inventory/adjust` | `{ location_id, variant_id, quantity_change: ±n, reason }` (reason required) | `201 { movement }` |
| POST | `/inventory/transfer` | `{ from_location_id, to_location_id, lines: [{ variant_id, quantity }], reason? }` | `201 { transfer_id, movements }` |
| POST | `/inventory/count` | `{ location_id, lines: [{ variant_id, counted_quantity }], reason? }` | `201 { variances: [{ variant_id, expected, counted, difference }] }` |

Each variant may appear only once per `lines` list.

## RFID

| Method | Path | Body | Success |
|---|---|---|---|
| POST | `/rfid/tags` | `{ epcs: ["E280…"], variant_id, location_id? }` | `201 { tags }` |
| POST | `/rfid/resolve` | `{ epcs: [...] }` (up to 1000) | `200 { tags: [{ epc, sku, product_name, effective_price, status, … }], unknown: [epc…] }` |
| PATCH | `/rfid/tags/:epc` | any of `status ("in_stock"\|"sold"\|"missing"\|"retired"), location_id` | `200 { tag }` |

EPCs are hex (8–64 chars) and are normalised to upper-case.

## Errors

| Status | When |
|---|---|
| 400 | Validation failed (`details: [{ field, message }]`), location doesn't exist |
| 404 | Tag / location not found |
| 409 | `Insufficient stock` (`details: [{ location_id, variant_id, available, requested }]`), archived location, duplicate EPC or location code |
