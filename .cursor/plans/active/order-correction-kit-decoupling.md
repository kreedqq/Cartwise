# Order correction / kit decoupling (in progress)

## Session 2026-09-14 — analysis

### Root cause (kit change vs submitted order)

- **Server (kit distribution)**: `0087` blocks `admin_set_kit_request_distribution` when any `kit_share_participants.order_id` or `ordered_at` is set, or cart lines have `submitted_order_id`. Live kit cannot be redistributed after a participant checks out (when `order_id` is stamped — `0039`/`0088`).
- **Server (participant row)**: `0039` blocks changing/removing a participant who has `ordered_at`. Quantity on `kit_share_participants` should not drift after order.
- **Gap (order identity)**: `order_items` has **no** `kit_share_id` snapshot; kit display uses live `kit_shares` + `kit_share_participants` via `resolveKitShareIdForItem` (`kitOrderSummary.ts`), including **live** `participant.quantity` for disambiguation.
- **Gap (kit size display)**: `listKitSizesForOrder` reads live `kit_shares.kit_size_vials`, not order-time size.
- **Gap (admin correction)**: No `order_revisions` / no RPC; admins cannot safely amend submitted orders.

### Target architecture

| Layer | SSoT |
|-------|------|
| Live catalog | `products`, area prices |
| Live kit | `kit_shares`, `kit_share_participants` (open carts only) |
| Order snapshot | `order_items.*_snapshot`, `order_role_surcharge_lines`, `orders` totals/shipping/payment |
| Corrections | `admin_apply_order_correction` → new `order_revisions` row; same `order_id` |

### Phases

1. **0092** — `order_items` kit snapshot columns; patch `create_one_area_order` insert; `orders.revision_number`; `order_revisions`; `admin_apply_order_correction` (quantity/remove lines, frozen unit price).
2. **Frontend** — Admin “Bestellung korrigieren” editor + diff preview; use snapshots in `kitOrderSummary` / `listKitSizesForOrder`.
3. **Tests** — Matrix from master prompt §39–43; QA scenario Selank 4/10.
4. **Production** — apply 0092 via established workflow after gates green.

### Completed this session

- Root-cause analysis documented (live kit vs order snapshot gaps).
- Migration **0092** (local): kit snapshots on checkout, `order_revisions`, `admin_apply_order_correction` RPC.
- Frontend decoupling: `resolveKitShareIdForItem` / `kitSizeForOrderItem` prefer snapshots; `listKitSizesForOrder` reads snapshots first.
- Service stub: `src/services/adminOrderCorrection.ts`.
- Tests: `src/tests/orderCorrection.test.ts`.

### Remaining

- Admin UI: Bestellung korrigieren editor, diff preview, Änderungsverlauf.
- RPC: add line / replace product (needs frozen pricing rules).
- QA integration test (Selank 4/10 scenario) against local Supabase.
- Production apply 0092 via established workflow after full gates + UI.
