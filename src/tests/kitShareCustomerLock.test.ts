import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { isKitShareStatusCustomerLocked, kitShareCustomerLockHint } from "@/lib/kitShareCustomerLock";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("0097 kit share customer lock migration", () => {
  const sql = read("supabase/migrations/0097_kit_share_customer_lock.sql");

  it("defines lock SSoT and cart guard with skip GUC for system ops", () => {
    expect(sql).toContain("kit_share_customer_lock_active");
    expect(sql).toContain("kit_share_assert_customer_may_mutate");
    expect(sql).toContain("kit.skip_customer_lock");
    expect(sql).toContain("cart_items_guard_kit_customer_lock");
    expect(sql).toContain("guard_kit_cart_item_customer_mutation");
  });

  it("guards customer kit RPCs and preserves sync/checkout/admin paths", () => {
    expect(sql).toContain("create or replace function public.leave_kit_share");
    expect(sql).toContain("create or replace function public.update_kit_share_quantity");
    expect(sql).toContain("perform set_config('kit.skip_customer_lock', 'on', true)");
    expect(sql).toContain("create or replace function public.kit_share_sync_participant_cart");
    expect(sql).toContain("create or replace function public.create_one_area_order");
    expect(sql).toContain("admin_set_kit_request_distribution");
  });

  it("exposes lock fields on get_my_kit_share", () => {
    expect(sql).toContain("'customerMutationLocked'");
    expect(sql).toContain("'customerLockReason'");
  });
});

describe("kitShareCustomerLock helpers", () => {
  it("treats full and ordered status as locked", () => {
    expect(isKitShareStatusCustomerLocked("open")).toBe(false);
    expect(isKitShareStatusCustomerLocked("full")).toBe(true);
    expect(isKitShareStatusCustomerLocked("ordered")).toBe(true);
  });

  it("returns German lock hints", () => {
    expect(kitShareCustomerLockHint(true, "full")).toContain("vollständig");
    expect(kitShareCustomerLockHint(true, "partial_order")).toContain("teilweise bestellt");
    expect(kitShareCustomerLockHint(false, null)).toBeNull();
  });
});
