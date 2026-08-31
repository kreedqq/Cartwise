# Kit Gesuche

Open marketplace for kit shares that do not yet have invitees. Invite-based kit sharing (`create_kit_share`, `invite_kit_share_participant`, `KitShareDialog`) is unchanged.

Production: migration `0041_kit_requests.sql` applied on `cartwise-prod` (2026-09-01). Existing invite kits stay `is_open_request = false`.

## Status

Stored on `kit_shares.status`:

| DB | UI |
|---|---|
| `open` | Offen |
| `full` | Vollständig |
| `cancelled` | Storniert |
| `expired` | Abgelaufen |
| `ordered` | Bestellt (after checkout, existing kit-order lifecycle) |

`full` is required so existing `create_order` / cart sync keep working. The UI never invents a separate `completed` column.

`is_open_request` defaults to `false`. Existing invite kits stay private.

## RPCs

All `SECURITY DEFINER` with `set search_path = public`. Caller is always `auth.uid()`.

| RPC | Role |
|---|---|
| `create_kit_request` | Create open request. Creator quantity must leave ≥ 1 unit free. No cart sync. |
| `list_open_kit_requests` | Paginated public list of `status = open` requests. Viewer unit price only. |
| `get_kit_request` | Detail. Participant usernames only if the caller is already in the kit. |
| `preview_kit_request_join` | Read-only price preview for the caller. |
| `join_kit_request` | `SELECT … FOR UPDATE`, validate remaining, insert participant, if allocated = kit size then `full` + `kit_share_sync_all_participant_carts` in the same transaction. |
| `leave_kit_request` | Open kits only; not creator; not `full`. |
| `cancel_kit_request` | Creator, open only. No cart lines exist yet. |
| `sync_completed_kit_request_carts` | Idempotent retry after `full`. |
| `list_my_kit_requests` / `list_my_kit_request_participations` | Creator vs joiner views. |

## RLS

Table SELECT for invite kits remains creator-or-participant. Open listing does **not** open the table to all users. Admins gain additive SELECT (`has_role(admin)`). Writes stay RPC-only.

A trigger blocks invite-path inserts/quantity edits/foreign deletes on `is_open_request` kits unless `join_kit_request` set `peptix.allow_kit_request_join`.

## Concurrency

`join_kit_request` locks the `kit_shares` row. Remaining is recomputed inside the transaction. Two users requesting the last slots: one succeeds, the other gets `Nicht genügend Vials verfügbar.` Unique `(kit_share_id, user_id)` blocks double join.

## Cart

Cart items are created only when the request becomes `full`, via existing `kit_share_sync_participant_cart` (username cart names from `profiles.username`, lookup by `cart_id + kit_share_id + product_id`). Unique index `cart_items_one_kit_share_per_cart` prevents duplicate kit lines. Retry is safe.

## Pricing

`kit_share_catalog_unit_usd` / `kit_share_participant_price_usd` / role markup / 10-unit bulk rule. No client-side price invention. Payloads expose `myPriceUsd` and `myUnitPriceUsd` for the caller only.

## Privacy

Public cards: product, variant, quantities, creator `profiles.username`, viewer unit price, status, timestamps. No email, phone, `display_name`, role, markup, or other users' prices. Participant usernames appear only after the viewer has joined.

The open-list product dropdown is filtered by the selected shop category (`shopGroupsForCategory`). BPC / BPC157 never appear under Reconstitution Water. Select keys use unique `groupKey` so oral BPC, oral BPC157, and peptide BPC 157 stay separate.
