import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { applyRoleMarkup } from "@/lib/money";
import { canMergeCartItems, cartItemMergeKey } from "@/lib/cart/cartItemIdentity";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const sql = read("supabase/migrations/0070_one_user_cart.sql");

describe("one open cart per user", () => {
  it("adds item shop_area, merge RPC, unique index, and get_or_create", () => {
    expect(sql).toMatch(/add column if not exists shop_area/);
    expect(sql).toMatch(/carts_one_open_per_user_idx/);
    expect(sql).toMatch(/get_or_create_user_cart_for/);
    expect(sql).toMatch(/pg_advisory_xact_lock\(8700070/);
    expect(sql).toMatch(/admin_merge_open_user_carts/);
    expect(sql).toMatch(/when unique_violation/);
    expect(sql).toMatch(/return public\.get_or_create_user_cart_for\(_uid\)/);
    expect(sql).toMatch(/Es ist nur ein aktiver Warenkorb erlaubt/);
    expect(sql).not.toMatch(/update public\.order_items set/);
    expect(sql).not.toMatch(/update public\.products set/);
    expect(sql).not.toMatch(/update public\.orders[\s\S]{0,80}where shop_area/);
  });

  it("prices merge and recalc from catalog plus owner markup", () => {
    expect(sql).toMatch(/shop_area_sell_unit_price\(_product, _item\.quantity, _markup, _area\)/);
    expect(sql).toMatch(/markup_percent_for\(_user_id\)/);
    expect(sql).not.toMatch(/unit_price_usd_snapshot\s*\*/);
    expect(sql).toMatch(/create_one_area_order/);
    expect(sql).toMatch(/submitted_order_id/);
  });

  it("keeps kit shares as their own identity", () => {
    expect(canMergeCartItems(
      { shop_area: "shop", vendor_code: "KP10", kit_share_id: "kit-1" },
      { shop_area: "shop", vendor_code: "KP10", kit_share_id: "kit-1" },
    )).toBe(false);
    expect(cartItemMergeKey({ shop_area: "shop", vendor_code: "KP10", kit_share_id: "kit-1" })).toBe("kit:kit-1");
  });

  it("merges the same area product and keeps different areas apart", () => {
    expect(canMergeCartItems(
      { shop_area: "shop", vendor_code: "KP10" },
      { shop_area: "shop", vendor_code: "KP10" },
    )).toBe(true);
    expect(canMergeCartItems(
      { shop_area: "shop", vendor_code: "KP10" },
      { shop_area: "group_buy_1", vendor_code: "KP10" },
    )).toBe(false);
  });

  it("does not apply markup twice", () => {
    const catalog = 10;
    const once = applyRoleMarkup(catalog, 25);
    const twice = applyRoleMarkup(once, 25);
    expect(once).toBe(12.5);
    expect(twice).not.toBe(once);
  });
});
