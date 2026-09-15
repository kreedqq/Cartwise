import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { formatHistoricalOrderItemQuantity } from "@/lib/orderKitDisplay";
import { buildOrderCsv, toOrderExportDoc } from "@/lib/orderExport";
import { EMPTY_ORDER_TRACKING } from "@/lib/tracking";
import type { Tables } from "@/types/database";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function orderItem(overrides: Partial<Tables<"order_items">> = {}): Tables<"order_items"> {
  return {
    id: "oi-1",
    order_id: "o-1",
    position: 0,
    product_id: "p-1",
    kit_share_id_snapshot: null,
    kit_size_vials_snapshot: null,
    kit_participant_quantity_snapshot: null,
    product_code_snapshot: "BA3",
    product_name_snapshot: "BAC Water",
    dosage_vial_snapshot: null,
    description_snapshot: null,
    normal_price_usd_snapshot: 6.25,
    bulk_price_usd_snapshot: null,
    bulk_price_min_quantity_snapshot: null,
    applied_price_tier: "normal",
    unit_price_usd_snapshot: 6.25,
    quantity: 2,
    line_total_usd: 12.5,
    exchange_rate_snapshot: null,
    eur_value_snapshot: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeOrder(): Tables<"orders"> {
  const now = new Date().toISOString();
  return {
    id: "o-1",
    order_number: "CW-2026-000063",
    user_id: "u-1",
    cart_id: "c-1",
    status: "pending",
    note: null,
    payment_method: "crypto",
    telegram_username_snapshot: "HeyAnna5",
    shipping_delivery_method: "home",
    shipping_first_name: null,
    shipping_last_name: null,
    shipping_street: null,
    shipping_house_number: null,
    shipping_address_extra: null,
    shipping_packstation_number: null,
    shipping_post_number: null,
    shipping_postal_code: null,
    shipping_city: null,
    shipping_country: null,
    total_usd: 37.32,
    total_eur: null,
    exchange_rate: null,
    revision_number: 0,
    submitted_at: now,
    created_at: now,
    updated_at: now,
    shop_area: "group_buy_1",
    china_shipping_amount: null,
    china_shipping_currency: null,
    de_shipping_amount: null,
    de_shipping_currency: null,
    ...EMPTY_ORDER_TRACKING,
  };
}

describe("admin order submission display", () => {
  it("uses order_items only for historical quantity labels", () => {
    expect(
      formatHistoricalOrderItemQuantity(
        orderItem({ product_code_snapshot: "BA3", product_name_snapshot: "BAC Water", quantity: 2 }),
      ),
    ).toBe("2 Vials");
    expect(
      formatHistoricalOrderItemQuantity(
        orderItem({
          product_code_snapshot: "CGL5",
          product_name_snapshot: "Cagrilintide",
          quantity: 2,
          kit_share_id_snapshot: "kit-cgl",
          kit_size_vials_snapshot: 10,
          kit_participant_quantity_snapshot: 2,
        }),
      ),
    ).toBe("2/10 Kit");
  });

  it("keeps PDF and CSV on historical order_items only", () => {
    const items = [
      orderItem(),
      orderItem({
        id: "oi-2",
        position: 1,
        product_code_snapshot: "CGL5",
        product_name_snapshot: "Cagrilintide",
        quantity: 2,
        unit_price_usd_snapshot: 12.41,
        line_total_usd: 24.82,
        kit_share_id_snapshot: "kit-cgl",
        kit_size_vials_snapshot: 10,
        kit_participant_quantity_snapshot: 2,
      }),
    ];
    const doc = toOrderExportDoc(makeOrder(), items, undefined, null, { audience: "admin" });
    expect(doc.items).toHaveLength(2);
    expect(doc.total_usd).toBe(37.32);
    expect(doc.items.map((i) => i.quantityLabel)).toEqual(["2 Vials", "2/10 Kit"]);
    const csv = buildOrderCsv(doc);
    expect(csv).toContain("2 Vials");
    expect(csv).toContain("2/10 Kit");
    expect(csv).not.toContain("KP10");
    expect(csv).not.toContain("5/10 Kit");
  });

  it("AdminOrderDetail separates submitted order from post-checkout cart", () => {
    const detail = read("src/pages/admin/AdminOrderDetail.tsx");
    expect(detail).toContain("Vom Kunden abgesendet");
    expect(detail).toContain("Nach dem Checkout im Warenkorb");
    expect(detail).toContain("formatHistoricalOrderItemQuantity");
    expect(detail).toContain("AdminPostCheckoutCartSection");
    expect(detail).toContain("auditOrderCartIntegrity");
    expect(detail).not.toMatch(/title="Bestellpositionen"/);
  });

  it("integrity banner refers to cart after checkout, not submitted order", () => {
    const banner = read("src/components/orders/AdminOrderIntegrityBanner.tsx");
    expect(banner).toContain("Warenkorb nach Checkout");
    expect(banner).not.toContain("Warenkorb-Abgleich: Bestellung wirkt vollständig");
  });
});
