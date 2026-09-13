import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { parseSiteAccessState } from "@/lib/siteAccess";
import { PAYMENT_METHOD_SETTING_KEYS, PAYMENT_METHODS } from "@/lib/shop/paymentMethod";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("payment method settings", () => {
  const sql = read("supabase/migrations/0071_payment_method_settings.sql");

  it("extends existing app_settings instead of a second settings engine", () => {
    expect(sql).toContain("payment_crypto_enabled");
    expect(sql).toContain("payment_paypal_enabled");
    expect(sql).toContain("payment_bank_transfer_enabled");
    expect(sql).toContain("create or replace function public.admin_set_app_setting");
    expect(sql).toContain("create or replace function public.get_site_access_state");
    expect(sql).toContain("payment_method_enabled");
    expect(sql).toContain("assert_order_payment_method_enabled");
    expect(sql).toContain("before insert on public.orders");
    expect(sql).not.toContain("drop table");
    expect(sql).not.toContain("update public.orders");
  });

  it("fails closed when a setting row is missing", () => {
    expect(sql).toContain("coalesce(");
    expect(sql).toContain("false");
    expect(sql).toContain("Diese Zahlungsmethode ist derzeit nicht verfügbar.");
  });

  it("keeps historical order display independent of the toggle", () => {
    expect(read("src/pages/OrderDetail.tsx")).toContain("order.payment_method");
    expect(read("src/pages/admin/AdminPaymentMethods.tsx")).not.toContain("OrderDetail");
    expect(read("src/pages/admin/AdminPaymentMethods.tsx")).toContain("Zahlungsmethoden");
    expect(read("src/pages/Checkout.tsx")).toContain("useEnabledPaymentMethods");
    expect(read("src/components/checkout/PaymentMethodSelector.tsx")).toContain("PAYMENT_METHODS_UNAVAILABLE_MESSAGE");
  });

  it("parses legacy site state without payment flags", () => {
    const parsed = parseSiteAccessState({
      maintenance_mode: false,
      quantity_discounts_enabled: true,
      caller_is_admin: false,
      site_access_allowed: true,
    });
    expect(parsed?.paymentMethodFlags).toBeNull();
    const withFlags = parseSiteAccessState({
      maintenance_mode: false,
      quantity_discounts_enabled: true,
      caller_is_admin: true,
      site_access_allowed: true,
      payment_crypto_enabled: true,
      payment_paypal_enabled: false,
      payment_bank_transfer_enabled: true,
    });
    expect(withFlags?.paymentMethodFlags).toEqual({
      crypto: true,
      paypal: false,
      bank_transfer: true,
    });
  });

  it("maps every catalog method to an app setting key", () => {
    for (const method of PAYMENT_METHODS) {
      expect(PAYMENT_METHOD_SETTING_KEYS[method]).toContain("payment_");
    }
  });
});
