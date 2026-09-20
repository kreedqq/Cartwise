import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("migration 0107 admin carts and global sync", () => {
  const sql = read("supabase/migrations/0107_admin_carts_and_global_sync.sql");

  it("exposes admin cart CRUD and checkout via create_order", () => {
    expect(sql).toContain("admin_list_open_carts");
    expect(sql).toContain("admin_get_open_cart_detail");
    expect(sql).toContain("admin_update_open_cart_item_quantity");
    expect(sql).toContain("admin_remove_open_cart_item");
    expect(sql).toContain("admin_add_open_cart_catalog_line");
    expect(sql).toContain("admin_checkout_open_cart");
    expect(sql).toContain("public.create_order(");
    expect(sql).toContain("admin.cart_checkout");
  });

  it("0117 adds bulk admin cart delete RPC", () => {
    const sql = read("supabase/migrations/0117_admin_delete_carts.sql");
    expect(sql).toContain("admin_delete_carts");
  });

  it("0118 fixes delete for checked-out carts with leftover open lines", () => {
    const sql = read("supabase/migrations/0118_fix_admin_delete_carts_ordered.sql");
    expect(sql).not.toContain("status = 'ordered'");
    expect(sql).toContain("kit.skip_cart_removal_tracking");
  });

  it("orchestrates global sync without mass delete", () => {
    expect(sql).toContain("admin_sync_orders_and_carts");
    expect(sql).toContain("admin_refresh_open_cart_prices");
    expect(sql).toContain("kit_full_order_sync_kit");
    expect(sql).not.toMatch(/delete from public\.order_items/i);
  });
});
