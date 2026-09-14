import { describe, expect, it } from "vitest";

import type { Tables } from "@/types/database";

/** Mirrors admin_apply_order_correction quantity × unit_price_usd_snapshot. */
function correctedLineTotal(item: Tables<"order_items">, quantity: number): number {
  return Math.round(quantity * item.unit_price_usd_snapshot * 100) / 100;
}

describe("order correction pricing safety", () => {
  const baseItem: Tables<"order_items"> = {
    id: "i1",
    order_id: "o1",
    position: 0,
    product_id: "p1",
    kit_share_id_snapshot: null,
    kit_size_vials_snapshot: null,
    kit_participant_quantity_snapshot: null,
    product_code_snapshot: "SK10",
    product_name_snapshot: "Selank",
    dosage_vial_snapshot: "10mg",
    description_snapshot: null,
    normal_price_usd_snapshot: 25,
    bulk_price_usd_snapshot: null,
    bulk_price_min_quantity_snapshot: null,
    applied_price_tier: "normal",
    unit_price_usd_snapshot: 20,
    quantity: 4,
    line_total_usd: 80,
    exchange_rate_snapshot: null,
    eur_value_snapshot: null,
    created_at: new Date().toISOString(),
  };

  it("uses frozen unit price when quantity halved (role/catalog change irrelevant)", () => {
    expect(correctedLineTotal(baseItem, 2)).toBe(40);
  });

  it("does not use a hypothetical new 0% unit price", () => {
    const wrongCurrentShopUnit = 10;
    expect(correctedLineTotal(baseItem, 2)).not.toBe(wrongCurrentShopUnit * 2);
  });
});
