import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { extractRpcErrorMessage } from "@/services/username";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("checkout order flow root cause + fix", () => {
  const migration = read("supabase/migrations/0088_checkout_skip_incomplete_kit_lines.sql");
  const checkout = read("src/pages/Checkout.tsx");
  const orders = read("src/services/orders.ts");

  it("keeps create_order → create_one_area_order as the order SSoT", () => {
    expect(orders).toContain('supabase.rpc("create_order"');
    expect(migration).toContain("create or replace function public.create_order(");
    expect(migration).toContain("create or replace function public.create_one_area_order(");
    expect(migration).toContain("_result := public.create_one_area_order(");
  });

  it("skips incomplete kit lines instead of aborting the whole area order", () => {
    expect(migration).toContain("cart_kit_share_is_checkout_ready");
    expect(migration).toContain("ks.status in ('full', 'ordered')");
    expect(migration).toMatch(/if not public\.cart_kit_share_is_checkout_ready[\s\S]*continue;/);
    expect(migration).not.toMatch(
      /if _kit\.status not in \('full', 'ordered'\) then\s*raise exception 'Ungültiger Kit-Anteil im Warenkorb\.'/,
    );
  });

  it("only iterates shop areas that still have orderable lines", () => {
    const createOrderStart = migration.indexOf("create or replace function public.create_order(");
    const createOrderBody = migration.slice(createOrderStart);
    expect(createOrderBody).toContain("cart_kit_share_is_checkout_ready");
    expect(createOrderBody).toContain("from public.shop_area_products sap");
  });

  it("surfaces PostgREST RPC errors instead of only instanceof Error", () => {
    expect(checkout).toContain("extractRpcErrorMessage");
    expect(orders).toContain("extractRpcErrorMessage");
    expect(checkout).toContain('Bestellung konnte nicht übermittelt werden.');

    const postgrest = {
      code: "P0001",
      message: "Ungültiger Kit-Anteil im Warenkorb.",
      details: null,
      hint: null,
    };
    expect(extractRpcErrorMessage(postgrest)).toContain("Ungültiger Kit-Anteil im Warenkorb.");
    expect(postgrest instanceof Error).toBe(false);
  });

  it("covers order-flow matrix surfaces in existing pricing/order engines", () => {
    const money = read("src/lib/money.ts");
    const areaPricing = read("src/lib/shop/shopAreaPricing.ts");
    expect(money).toContain("applyRoleMarkup");
    expect(areaPricing).toContain("shopAreaSellUnitPriceForProductRole");
    expect(migration).toContain("apply_role_markup");
    expect(migration).toContain("shop_area_sell_unit_price");
    expect(migration).toContain("resolve_area_catalog_product");
    expect(migration).toMatch(/payment_method.*crypto.*bank_transfer.*paypal|crypto.*bank_transfer.*paypal/);
  });

  it("aligns cart_kit_share_is_checkout_ready with numeric cart_items.quantity (0091)", () => {
    const fix = read("supabase/migrations/0091_cart_kit_share_checkout_ready_numeric.sql");
    expect(fix).toContain("_quantity numeric");
    expect(fix).toContain("drop function if exists public.cart_kit_share_is_checkout_ready(uuid, uuid, integer)");
  });
});
