import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { slugifyShopAreaName } from "@/lib/shop/shopAreas";
import { applyRoleMarkup } from "@/lib/money";
import { areaThemeCssVars, parseAreaTheme } from "@/lib/shop/areaTheme";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("dynamic sales areas", () => {
  const sql = read("supabase/migrations/0069_dynamic_sales_areas.sql");

  it("drops the three-key CHECKs and creates areas via RPC", () => {
    expect(sql).toContain("drop constraint if exists shop_areas_key_check");
    expect(sql).toContain("drop constraint if exists carts_shop_area_check");
    expect(sql).toContain("drop constraint if exists orders_shop_area_check");
    expect(sql).toContain("drop constraint if exists kit_shares_shop_area_check");
    expect(sql).toContain("admin_create_shop_area");
    expect(sql).toContain("shop_area_slugify");
    expect(sql).not.toMatch(/check \(key in \('shop', 'group_buy_1', 'group_buy_2'\)\)/);
  });

  it("recalculates open carts from catalog + owner markup, never cart unit", () => {
    expect(sql).toContain("admin_refresh_open_cart_prices");
    expect(sql).toContain("refresh_cart_selling_prices_for_user");
    expect(sql).toContain("markup_percent_for(_user_id)");
    expect(sql).toContain("resolve_area_catalog_product");
    expect(sql).toContain("shop_area_sell_unit_price");
    expect(sql).toContain("status in ('draft', 'ready')");
    expect(sql).toMatch(/Never _item\.unit_price_usd_snapshot/);
    expect(sql).toContain("has_role(_uid, 'admin')");
    expect(sql).not.toContain("unit_price_usd_snapshot *");
  });

  it("slugifies accessory names without a code change", () => {
    expect(slugifyShopAreaName("Zubehör")).toBe("zubehoer");
    expect(slugifyShopAreaName("Laborbedarf")).toBe("laborbedarf");
    expect(slugifyShopAreaName("Sonderangebote")).toBe("sonderangebote");
  });

  it("applies area theme only inside ShopAreaProvider", () => {
    expect(read("src/context/ShopAreaContext.tsx")).toContain("data-shop-area={shopArea}");
    expect(read("src/context/ShopAreaContext.tsx")).toContain("areaThemeCssVars(theme)");
    expect(read("src/pages/admin/AdminDesign.tsx")).not.toContain("areaThemeCssVars");
  });

  it("routes any slug through one shop area page", () => {
    const app = read("src/App.tsx");
    expect(app).toContain('path="/shop/:slug"');
    expect(app).toContain("ShopAreaPage");
    expect(app).not.toContain("ShopRetailPage");
    expect(app).not.toContain("GroupBuyPage");
  });
});

describe("role recalculation without double markup", () => {
  it("applies the new role to the catalog base, not the previous sell price", () => {
    const base = 100;
    const customer = applyRoleMarkup(base, 25);
    expect(customer).toBe(125);
    const stammkunde = applyRoleMarkup(base, 10);
    expect(stammkunde).toBe(110);
    expect(applyRoleMarkup(customer, 10)).toBe(137.5);
    expect(stammkunde).not.toBe(applyRoleMarkup(customer, 10));
    expect(applyRoleMarkup(base, 10)).toBe(stammkunde);
  });
});

describe("area theme fallback", () => {
  it("keeps empty theme disabled so existing areas look unchanged", () => {
    expect(parseAreaTheme({}).enabled).toBe(false);
    expect(parseAreaTheme(null).tokens.primary).toBe("");
    expect(areaThemeCssVars(parseAreaTheme({}))).toEqual({});
  });

  it("maps area hex colors onto scoped shadcn variables", () => {
    const vars = areaThemeCssVars(
      parseAreaTheme({ enabled: true, tokens: { primary: "#d4af37", background: "#070b14" } }),
    ) as Record<string, string>;
    expect(vars["--area-primary"]).toBe("#d4af37");
    expect(vars["--primary"]).toMatch(/^\d+ \d+% \d+%$/);
    expect(vars["--background"]).toMatch(/^\d+ \d+% \d+%$/);
  });
});
