# Historical Kit Sync Gap Recovery (2026-09-15)

## Problem

Before migrations `0100` / `0101`, a full kit share could fail to land in the customer cart before checkout. Checkout could succeed without the participant’s kit line on the order.

## Forensic method

Read-only reconstruction: order checkout time vs. kit `completed_at`, participant `order_id` / `ordered_at`, `order_items.kit_share_id_snapshot`, checkout cart lines, peer cart/order price snapshots. No client-side pricing.

## Results

- **Proven checkout loss (missing line with pre-checkout cart evidence):** 0 fleet-wide.
- **Historical sync gap with commercial impact:** 4 lines on 3 orders (Kerstin: two distinct KP10 kit shares — not merged).

## Recovery architecture

Migration **`0102_historical_kit_sync_recovery.sql`** + hotfix **`0103_fix_historical_kit_recovery_role_join.sql`** (**LIVE on production**):

- `kit_sync_recovery_historical_cart_template` — historical unit from peer cart/order snapshots only.
- `kit_sync_recovery_evaluate` — admin preview + eligibility (blocks `CW-2026-000063`).
- `admin_apply_historical_kit_sync_recovery` — insert frozen `order_items`, revision + audit `order.add_historical_line`, no kit/cart/payment mutation.

Admin UI: order detail → shared kit panel → **Historische Bestellposition** (preview + confirm).

## Hardening

`0100` and `0101` remain production LIVE; no rollback.

## Production recovery (2026-09-15)

Four historical kit lines applied via `admin_apply_historical_kit_sync_recovery` after RPC preview matched forensic USD references. Total added: **166.90 USD** on three orders. HeyAnna5 / `CW-2026-000063` unchanged.
