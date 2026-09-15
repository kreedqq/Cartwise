import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("0099 admin create order for customer", () => {
  const sql = read("supabase/migrations/0099_admin_create_order_for_user.sql");

  it("uses checkout subject GUC and existing create_order pipeline", () => {
    expect(sql).toContain("peptix_checkout_subject_user_id");
    expect(sql).toContain("peptix.checkout_subject_user_id");
    expect(sql).toContain("admin_create_order_for_customer");
    expect(sql).toContain("public.create_order(");
    expect(sql).toContain("shop_area_sell_unit_price");
    expect(sql).not.toMatch(/orders\.user_id\s*=\s*auth\.uid\(\)/);
  });

  it("logs order.admin_create for admin checkout only", () => {
    expect(sql).toContain("'order.admin_create'");
    expect(sql).toContain("peptix.admin_checkout");
  });

  it("requires admin and prices catalog via customer markup", () => {
    expect(sql).toContain("assert_admin_authenticated");
    expect(sql).toContain("admin_list_shop_products_for_customer");
    expect(sql).toContain("markup_percent_for_area(_uid, _shop_area, _p.id)");
    expect(sql).toContain("admin_preview_order_for_customer");
  });

  it("restores customer open cart after staging", () => {
    expect(sql).toContain("jsonb_agg(to_jsonb(ci)");
    expect(sql).toContain("jsonb_populate_record(null::public.cart_items, _rec)");
  });

  it("wires admin UI route and service", () => {
    expect(read("src/App.tsx")).toContain("orders/create-for-customer");
    expect(read("src/pages/admin/AdminOrders.tsx")).toContain("Bestellung für Kunden erstellen");
    expect(read("src/services/adminOrderCreate.ts")).toContain("admin_create_order_for_customer");
    expect(read("src/services/adminOrderCreate.ts")).not.toContain("unit_price");
  });

  it("ignores client price fields in create RPC args", () => {
    const service = read("src/services/adminOrderCreate.ts");
    expect(service).toContain("_lines: lines");
    expect(service).not.toMatch(/_markup|_unit_price|_role_id/);
  });
});
