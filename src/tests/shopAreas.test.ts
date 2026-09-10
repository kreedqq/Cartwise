import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildCustomerNavItems } from "@/lib/navigation";
import { shopAreaCatalogUnit, shopAreaSellUnitPrice } from "@/lib/shop/shopAreaPricing";
import {
  DEFAULT_SHOP_AREA,
  formatShopAreaLabel,
  saleModeForShopArea,
  shopAreaFromPath,
  type MyShopArea,
} from "@/lib/shop/shopAreas";
import { formatCatalogQuantity } from "@/lib/quantityFormat";
import { shopPriceColumnLabels } from "@/lib/shop/priceLabels";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const PEPTIDE = { price_usd: 100, bulk_price_usd: 90, bulk_price_min_quantity: 10 };
const OIL = { price_usd: 18, bulk_price_usd: 160, bulk_price_min_quantity: 10 };
const ORAL = { price_usd: 20 };

describe("shop area domain", () => {
  it("maps paths to the three areas and keeps shop as default", () => {
    expect(shopAreaFromPath("/shop")).toBe("shop");
    expect(shopAreaFromPath("/shop/retail")).toBe("shop");
    expect(shopAreaFromPath("/shop?cat=peptides")).toBe("shop");
    expect(shopAreaFromPath("/shop/group-buy-1")).toBe("group_buy_1");
    expect(shopAreaFromPath("/shop/group-buy-2")).toBe("group_buy_2");
    expect(DEFAULT_SHOP_AREA).toBe("shop");
    expect(formatShopAreaLabel(null)).toBe("Nicht angegeben");
  });

  it("uses retail quantity nouns only for the shop area snapshot", () => {
    expect(saleModeForShopArea("shop")).toBe("retail_unit");
    expect(saleModeForShopArea("group_buy_1")).toBe("catalog");
    expect(saleModeForShopArea(null)).toBe("catalog");
    expect(formatCatalogQuantity(1, "peptides", "retail_unit")).toBe("1 Vial");
    expect(formatCatalogQuantity(2, "peptides", "retail_unit")).toBe("2 Vials");
    expect(formatCatalogQuantity(1, "peptides")).toBe("1 Kit");
  });

  it("buildCustomerNavItems returns a single Shop entry and no Favoriten", () => {
    const kunde: MyShopArea[] = [
      { key: "shop", name: "Shop", pricing_profile: "retail", sort_order: 10, path: "/shop", base_price_factor_pct: 300 },
    ];
    const groupBuy: MyShopArea[] = [
      ...kunde,
      { key: "group_buy_1", name: "Group Buy 1", pricing_profile: "group_buy", sort_order: 20, path: "/shop/group-buy-1", base_price_factor_pct: 100 },
      { key: "group_buy_2", name: "Group Buy 2", pricing_profile: "group_buy", sort_order: 30, path: "/shop/group-buy-2", base_price_factor_pct: 100 },
    ];
    const kundeItems = buildCustomerNavItems(kunde);
    expect(kundeItems.map((item) => item.label)).toEqual([
      "Ankündigungen",
      "Übersicht",
      "Shop",
      "Lexikon & Rechner",
      "Meine Bestellungen",
      "Profil",
    ]);
    // No Favoriten in simplified nav
    expect(kundeItems.some((item) => item.label === "Favoriten")).toBe(false);
    // No kit-gesuche or group-buy in nav
    expect(kundeItems.some((item) => item.to === "/kit-gesuche")).toBe(false);
    expect(kundeItems.some((item) => item.to.includes("group-buy"))).toBe(false);
    // Shop points to /shop (hub)
    expect(kundeItems.find((item) => item.label === "Shop")?.to).toBe("/shop");

    // Nav is the same regardless of which areas the user has access to (single Shop entry)
    const gbItems = buildCustomerNavItems(groupBuy);
    expect(gbItems.map((item) => item.to)).toEqual([
      "/announcements",
      "/dashboard",
      "/shop",
      "/peptide",
      "/orders",
      "/profile",
    ]);
    expect(gbItems.some((item) => item.to === "/kit-gesuche")).toBe(false);
  });
});

describe("shop area pricing is one pipeline", () => {
  it("does not double-apply role markup", () => {
    // Explicit factorPct=500 (5×) preserves the historical factor=5 test values.
    // The active production factor is configured per area (e.g. 300% for shop, 100% for GB).
    expect(shopAreaSellUnitPrice(PEPTIDE, 1, 25, "retail", true, 500)).toBe(62.5);
    // GB default factorPct=100 (1×): 100 × 1.0 × 1.25 = 125
    expect(shopAreaSellUnitPrice(PEPTIDE, 1, 25, "group_buy", true)).toBe(125);
    // Retail with factorPct=500: sell_unit_price(OIL,1)=18 × 5 = 90
    expect(shopAreaCatalogUnit(OIL, 1, "retail", false, 500)).toBe(90);
    // Retail with factorPct=500: 20 × 5 = 100
    expect(shopAreaCatalogUnit(ORAL, 1, "retail", false, 500)).toBe(100);
    // GB default: 100 × 1.0 = 100
    expect(shopAreaCatalogUnit(PEPTIDE, 1, "group_buy", true)).toBe(100);
  });

  it("keeps group-buy kit labels and uses vial/pack labels in retail", () => {
    expect(shopPriceColumnLabels("peptides").unitPrice).toBe("Preis / 10 Vials (Kit)");
    expect(shopPriceColumnLabels("peptides", "retail").unitPrice).toBe("Preis / Vial");
    expect(shopPriceColumnLabels("orals", "retail").unitPrice).toBe("Preis / Packung");
    expect(shopPriceColumnLabels("injectable-oils", "retail").unitPrice).toBe("Preis / Vial");
  });
});

describe("shop area SQL", () => {
  const sql = read("supabase/migrations/0051_shop_areas.sql");

  it("seeds three areas, role access, and a Group Buy role without assigning users", () => {
    expect(sql).toContain("('shop', 'Shop', true, 'retail'");
    expect(sql).toContain("('group_buy_1', 'Group Buy 1', true, 'group_buy'");
    expect(sql).toContain("('group_buy_2', 'Group Buy 2', true, 'group_buy'");
    expect(sql).toMatch(/select 'Group Buy', 0, true, false/);
    expect(sql).not.toMatch(/insert into public\.user_customer_roles/);
  });

  it("enforces area access on listing, cart, and checkout", () => {
    expect(sql).toMatch(/user_can_access_shop_area/);
    expect(sql).toMatch(/Kein Zugriff auf diesen Shop-Bereich/);
    expect(sql).toMatch(/list_shop_products_for_area/);
    expect(sql).toMatch(/ensure_shop_area_cart/);
    expect(sql).toMatch(/current_user_can_access_shop_area\(shop_area\)/);
    expect(sql).toMatch(/reject_cart_shop_area_mutation/);
    expect(sql).toMatch(/NEW\.shop_area is distinct from OLD\.shop_area/);
    expect(sql).toMatch(/shop_area_sell_unit_price/);
    expect(sql).toMatch(/apply_role_markup\(/);
    expect(sql).toMatch(/insert into public\.orders \([\s\S]*shop_area/);
    expect(sql).toMatch(/Kits sind in diesem Shop-Bereich nicht verfügbar/);
    expect(sql).toMatch(/kit_share_target_cart_id/);
    expect(sql).toMatch(/comment on column public\.orders\.shop_area is[\s\S]*NULL = legacy/);
  });

  it("does not rewrite historical order totals or catalog prices", () => {
    expect(sql).not.toMatch(/update public\.orders set shop_area/);
    expect(sql).not.toMatch(/update public\.order_items set/);
    expect(sql).not.toMatch(/update public\.products set price_usd/);
  });
});

describe("shop area product config SQL", () => {
  const sql = read("supabase/migrations/0052_shop_area_product_config.sql");
  const sql0051 = read("supabase/migrations/0051_shop_areas.sql");

  it("keeps kits on group-buy areas and adds per-product area config", () => {
    expect(sql).toMatch(/kit_shares\.shop_area/);
    expect(sql).toContain("group_buy_1");
    expect(sql).toContain("group_buy_2");
    expect(sql).toMatch(/create table public\.shop_area_products/);
    expect(sql).toMatch(/create table public\.shop_area_product_prices/);
    expect(sql).toMatch(/create table public\.shop_area_product_role_markups/);
    expect(sql).toMatch(/create table public\.shop_area_documents/);
    expect(sql).toMatch(/markup_percent_for_area/);
    expect(sql).toMatch(/apply_shop_area_product_overrides/);
    expect(sql).toMatch(/product_visible_in_shop_area/);
    expect(sql).toMatch(/create_kit_request\(/);
    expect(sql).toMatch(/_shop_area/);
  });

  it("applies role markup once after area overrides", () => {
    expect(sql).toMatch(/apply_role_markup\(/);
    expect(sql).toMatch(/_p\.bulk_price_usd := null/);
    expect(sql).not.toMatch(/apply_role_markup\(\s*public\.apply_role_markup/);
  });

  it("does not remove cart shop_area security from 0051", () => {
    expect(sql0051).toMatch(/carts_insert_own/);
    expect(sql0051).toMatch(/current_user_can_access_shop_area/);
    expect(sql0051).toMatch(/reject_cart_shop_area_mutation/);
    expect(sql0051).toMatch(/carts_protect_shop_area/);
    expect(sql).not.toMatch(/drop policy if exists carts_insert_own/);
    expect(sql).not.toMatch(/drop function if exists public\.current_user_can_access_shop_area/);
  });

  it("does not backfill historical orders", () => {
    expect(sql).not.toMatch(/update public\.orders set shop_area/);
  });
});

describe("global role markup SQL (migration 0053)", () => {
  const sql = read("supabase/migrations/0053_global_role_markup.sql");

  it("replaces markup_percent_for_area with a global lookup", () => {
    expect(sql).toContain("markup_percent_for_area");
    expect(sql).toContain("markup_percent_for(_user_id)");
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/revoke all on function/);
  });

  it("does not drop any tables or alter permanent data", () => {
    expect(sql).not.toMatch(/drop table/i);
    expect(sql).not.toMatch(/delete from/i);
    expect(sql).not.toMatch(/truncate/i);
    expect(sql).not.toMatch(/alter table/i);
  });
});

describe("area base price factor SQL (migration 0054)", () => {
  const sql = read("supabase/migrations/0054_area_base_price_factor.sql");

  it("adds base_price_factor_pct column and sets retail shop to 300%", () => {
    expect(sql).toMatch(/add column if not exists base_price_factor_pct/);
    expect(sql).toMatch(/base_price_factor_pct = 300 where key = 'shop'/);
  });

  it("replaces shop_area_catalog_unit and list_shop_products_for_area with new factor logic", () => {
    expect(sql).toMatch(/create or replace function public\.shop_area_catalog_unit/);
    expect(sql).toMatch(/create or replace function public\.list_shop_products_for_area/);
    expect(sql).toMatch(/base_price_factor_pct \/ 100\.0/);
  });

  it("applies factor to group_buy pricing (NEW: GB also has a factor)", () => {
    // The new catalog_unit applies factor for group_buy too.
    expect(sql).toMatch(/group_buy.*_factor|_factor.*group_buy/s);
    expect(sql).toMatch(/sell_unit_price[\s\S]*?\*\s*_factor/);
  });

  it("applies role markup exactly once (no double apply_role_markup nesting)", () => {
    expect(sql).toMatch(/apply_role_markup\(/);
    expect(sql).not.toMatch(/apply_role_markup\(\s*public\.apply_role_markup/);
  });

  it("retains retail_price_factor column (legacy, not dropped)", () => {
    expect(sql).not.toMatch(/drop column.*retail_price_factor/i);
    expect(sql).not.toMatch(/retail_price_factor.*drop/i);
  });

  it("does not drop or alter security objects from 0051", () => {
    expect(sql).not.toMatch(/drop policy if exists carts_insert_own/);
    expect(sql).not.toMatch(/drop function if exists public\.current_user_can_access_shop_area/);
    expect(sql).not.toMatch(/drop trigger if exists carts_protect_shop_area/);
    expect(sql).not.toMatch(/drop trigger if exists cart_items_reject_retail_kits/);
  });

  it("does not backfill historical orders or products", () => {
    expect(sql).not.toMatch(/update public\.orders set shop_area/);
    expect(sql).not.toMatch(/update public\.order_items set/);
    expect(sql).not.toMatch(/update public\.products set price_usd/);
  });

  it("includes SECURITY DEFINER and correct grants", () => {
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/revoke all on function/);
    expect(sql).toMatch(/grant execute on function public\.list_shop_products_for_area/);
    expect(sql).toMatch(/grant execute on function public\.list_my_shop_areas/);
  });

  it("updates list_my_shop_areas to return base_price_factor_pct", () => {
    expect(sql).toMatch(/create or replace function public\.list_my_shop_areas/);
    expect(sql).toMatch(/base_price_factor_pct.*numeric|numeric.*base_price_factor_pct/s);
  });
});
