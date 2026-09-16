/**
 * Domain Source of Truth matrix (binding for new code).
 * Do not duplicate these calculations in UI — consume RPCs or shared lib helpers.
 */

export const DOMAIN_SOURCE_OF_TRUTH = {
  productIdentity: {
    source: "shop_area_products",
    keys: ["shop_area_key", "vendor_code", "product_id?"] as const,
  },
  price: {
    source: "shop_area_product_prices → SQL pricing RPCs",
    effective: "list_shop_products_for_area / create_order",
  },
  role: {
    source: "user_customer_roles + customer_roles",
  },
  markup: {
    source: "markup_percent_for_area + apply_role_markup (once)",
  },
  cart: {
    source: "carts + cart_items",
    kitLineKey: "kit_share_id",
  },
  kit: {
    source: "kit_shares",
  },
  participant: {
    source: "kit_share_participants.quantity",
  },
  kitAllocation: {
    source: "sum(kit_share_participants.quantity) vs kit_size_vials",
    helper: "kit_share_allocated_total",
  },
  kitStatus: {
    source: "kit_shares.status (DB)",
    derived: "kit_share_project_state / kit_share_refresh_status_locked",
  },
  order: {
    source: "orders + order_items",
  },
  historicalKit: {
    source: "order_items kit_*_snapshot columns",
  },
  progress: {
    source: "order_progress",
  },
} as const;

export type DomainSourceOfTruth = typeof DOMAIN_SOURCE_OF_TRUTH;
