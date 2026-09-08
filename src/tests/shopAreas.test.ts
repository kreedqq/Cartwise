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

  it("hides unauthorized areas from nav instead of disabling them", () => {
    const kunde: MyShopArea[] = [
      { key: "shop", name: "Shop", pricing_profile: "retail", sort_order: 10, path: "/shop" },
    ];
    const groupBuy: MyShopArea[] = [
      ...kunde,
      { key: "group_buy_1", name: "Group Buy 1", pricing_profile: "group_buy", sort_order: 20, path: "/shop/group-buy-1" },
      { key: "group_buy_2", name: "Group Buy 2", pricing_profile: "group_buy", sort_order: 30, path: "/shop/group-buy-2" },
    ];
    const kundeItems = buildCustomerNavItems(kunde);
    expect(kundeItems.map((item) => item.label)).toEqual([
      "Übersicht",
      "Shop",
      "Lexikon & Rechner",
      "Meine Bestellungen",
      "Favoriten",
      "Profil",
    ]);
    expect(kundeItems.some((item) => item.to === "/kit-gesuche")).toBe(false);
    expect(kundeItems.some((item) => item.to.includes("group-buy"))).toBe(false);

    const gbItems = buildCustomerNavItems(groupBuy);
    expect(gbItems.map((item) => item.to)).toEqual([
      "/dashboard",
      "/shop",
      "/shop/group-buy-1",
      "/shop/group-buy-2",
      "/kit-gesuche",
      "/peptide",
      "/orders",
      "/favorites",
      "/profile",
    ]);
  });
});

describe("shop area pricing is one pipeline", () => {
  it("does not double-apply role markup", () => {
    expect(shopAreaSellUnitPrice(PEPTIDE, 1, 25, "retail", true)).toBe(62.5);
    expect(shopAreaSellUnitPrice(PEPTIDE, 1, 25, "group_buy", true)).toBe(125);
    expect(shopAreaCatalogUnit(OIL, 1, "retail", false)).toBe(90);
    expect(shopAreaCatalogUnit(ORAL, 1, "retail", false)).toBe(100);
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
