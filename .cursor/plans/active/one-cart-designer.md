# One cart + sales-area designer + mobile nav

## Analysis (source of truth)

Carts are per `shop_area`. `cart_items` have no area column. `carts.shop_area` is immutable (0051 trigger). `ensure_shop_area_cart` and `kit_share_target_cart_id` create a new draft cart per area. Dashboard `createCart` and `duplicate_cart` add more. `name_ordinal` titles become "User – Warenkorb 2".

`create_order` prices and fail-closes the whole cart against `cart.shop_area`. Mixed-area items cannot share one order snapshot.

Preferred UX: one open cart per user. Items carry `shop_area`. Checkout splits into one order per area in one transaction. Kits never merge.

Designer today: hex inputs + small demo cards. Theme JSON on `shop_areas.theme` is the right place. No second area table.

Zubehör.xlsx was not in the workspace (`/mnt/data/…` not present). Import-on-create will be built; the file is not applied until it is provided.

Payment-scope files stay dirty.

## Session 2026-09-12

Implemented 0070 + frontend. Tests 1312 passed. Typecheck/lint/build green. Zubehör.xlsx was not in the workspace; import-on-create is ready but no catalog was invented or applied to production.

## Decisions

1. Physical one open cart (`draft`/`ready`, `deleted_at is null`) per `user_id`. Unique partial index after merge.
2. `cart_items.shop_area` backfilled from the source cart. Add-to-cart writes the current storefront area.
3. `ensure_shop_area_cart` becomes get-or-create user cart. Area is not a cart-creation key.
4. Merge RPC: oldest active open cart wins; same identity (`shop_area` + vendor_code + no kit) sums qty; kits stay separate; then catalog recalc for the cart owner.
5. `create_order` gains optional `_shop_area` + `_finalize_cart`. Wrapper `create_orders_from_cart` loops areas.
6. Designer stays on `shop_areas.theme`. Color picker + accordion + live preview. No new CSS files.
7. Mobile nav: keep all items; horizontal snap scroll; desktop unchanged.
