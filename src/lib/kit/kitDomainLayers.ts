/**
 * Kit domain responsibilities — maps to existing SQL, not a third engine.
 *
 * 1. Allocation Engine
 *    join_kit_request, leave_kit_request, admin distribution, kit_share_refresh_status_locked
 *
 * 2. Cart Projection
 *    kit_share_sync_participant_cart, kit_share_sync_all_participant_carts
 *
 * 3. Order Projection
 *    create_order snapshots, kit_full_order_sync_kit / kit_full_order_sync_apply_participant
 *
 * 4. Reconciliation
 *    kit_share_reconcile_report (read-only), admin_get_kit_request sync summary, global sync JSON
 */

export const KIT_DOMAIN_LAYERS = [
  "allocation",
  "cart_projection",
  "order_projection",
  "reconciliation",
] as const;

export type KitDomainLayer = (typeof KIT_DOMAIN_LAYERS)[number];
