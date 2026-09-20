import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  adminOpenCartsDeleteConfirmBody,
  adminOpenCartsDeleteConfirmLabel,
  adminOpenCartsDeletedToast,
  adminOpenCartsSelectedLabel,
  selectAllVisibleIds,
  toggleIdSet,
} from "@/lib/admin/adminCartBulkDelete";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("migration 0118 admin_delete_carts fix", () => {
  const sql = read("supabase/migrations/0118_fix_admin_delete_carts_ordered.sql");

  it("requires admin and deletes atomically", () => {
    expect(sql).toContain("admin_delete_carts");
    expect(sql).toContain("assert_admin_authenticated");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
    expect(sql).toContain("kit.skip_customer_lock");
    expect(sql).toContain("kit.skip_cart_removal_tracking");
    expect(sql).toContain("admin.carts.bulk_delete");
    expect(sql).toContain("log_audit");
    expect(sql).not.toMatch(/delete from public\.orders/i);
    expect(sql).not.toMatch(/delete from public\.order_items/i);
    expect(sql).not.toMatch(/delete from public\.kit_shares/i);
  });

  it("allows leftover open lines on checked-out carts (no ordered status block)", () => {
    expect(sql).not.toContain("status = 'ordered'");
    expect(sql).toContain("submitted_order_id is null");
    expect(sql).toContain("deleted_at = now()");
    expect(sql).toContain("is_active_cart = false");
  });
});

describe("admin cart bulk delete UI helpers", () => {
  it("pluralizes selection and success copy", () => {
    expect(adminOpenCartsSelectedLabel(1)).toBe("1 Warenkorb ausgewählt");
    expect(adminOpenCartsSelectedLabel(5)).toBe("5 Warenkörbe ausgewählt");
    expect(adminOpenCartsDeletedToast(1)).toBe("1 Warenkorb wurde gelöscht.");
    expect(adminOpenCartsDeletedToast(4)).toBe("4 Warenkörbe wurden gelöscht.");
    expect(adminOpenCartsDeleteConfirmBody(1)).toContain("1 Warenkorb");
    expect(adminOpenCartsDeleteConfirmBody(4)).toContain("4 Warenkörbe");
    expect(adminOpenCartsDeleteConfirmLabel(3)).toBe("3 Warenkörbe löschen");
  });

  it("toggles selection and select-all visible ids", () => {
    let set = toggleIdSet(new Set(), "a", true);
    set = toggleIdSet(set, "b", true);
    expect([...set]).toEqual(["a", "b"]);
    set = toggleIdSet(set, "a", false);
    expect([...set]).toEqual(["b"]);
    expect([...selectAllVisibleIds(["x", "y"])]).toEqual(["x", "y"]);
  });
});
