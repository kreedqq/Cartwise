import { describe, expect, it } from "vitest";

import { applyRoleMarkup, calculateLineTotalUsd } from "@/lib/money";
import {
  adminAreaCatalogPriceBasisLabel,
  productUsesKitUnitPricingFromProduct,
  usesKitUnitPricingForAreaCategory,
} from "@/lib/shop/categoryPricing";
import { productUsesKitUnitPricing } from "@/lib/shop/kitSharePricing";
import {
  shopAreaCatalogUnit,
  shopAreaSellUnitPriceForProductRole,
} from "@/lib/shop/shopAreaPricing";
import { shopQuantityOptions } from "@/lib/shop/display";
import { shopPriceColumnLabels } from "@/lib/shop/priceLabels";

const ACCESSORY = { price_usd: 12, category: "Accessories", name: "Spritzen Pink", code: "301" };
const PEPTIDE = { price_usd: 120, category: "Peptides", name: "BPC-157", code: "BPC1" };
const WATER = { price_usd: 30, category: "Reconstitution Water", name: "BAC Water", code: "BA03" };
const OIL = { price_usd: 90, category: "Injectable Oils", name: "Test E", code: "TE1" };
const ORAL = { price_usd: 50, category: "Orals", name: "Tabs", code: "OR1" };

describe("accessories unit pricing", () => {
  it("classifies accessories as non-kit by area category and product category", () => {
    expect(usesKitUnitPricingForAreaCategory("accessories", ACCESSORY)).toBe(false);
    expect(usesKitUnitPricingForAreaCategory("zubehoer", ACCESSORY)).toBe(false);
    expect(productUsesKitUnitPricingFromProduct(ACCESSORY)).toBe(false);
    expect(productUsesKitUnitPricing(ACCESSORY)).toBe(false);
  });

  it("keeps peptide, water, oil, and oral kit/unit rules unchanged", () => {
    expect(usesKitUnitPricingForAreaCategory("peptides", PEPTIDE)).toBe(true);
    expect(usesKitUnitPricingForAreaCategory("reconstitution-water", WATER)).toBe(true);
    expect(usesKitUnitPricingForAreaCategory("injectable-oils", OIL)).toBe(false);
    expect(usesKitUnitPricingForAreaCategory("orals", ORAL)).toBe(false);
    expect(productUsesKitUnitPricing(PEPTIDE)).toBe(true);
    expect(productUsesKitUnitPricing(WATER)).toBe(true);
    expect(productUsesKitUnitPricing(OIL)).toBe(false);
    expect(productUsesKitUnitPricing(ORAL)).toBe(false);
  });

  it("retail catalog unit: 12 USD accessory stays 12 USD (qty 1, factor 100%)", () => {
    expect(shopAreaCatalogUnit(ACCESSORY, 1, "retail", false, 100)).toBe(12);
    expect(shopAreaCatalogUnit(ACCESSORY, 2, "retail", false, 100)).toBe(12);
    expect(shopAreaCatalogUnit(ACCESSORY, 10, "retail", false, 100)).toBe(12);
  });

  it("line totals scale by quantity without /10", () => {
    expect(calculateLineTotalUsd(1, shopAreaCatalogUnit(ACCESSORY, 1, "retail", false, 100))).toBe(12);
    expect(calculateLineTotalUsd(2, shopAreaCatalogUnit(ACCESSORY, 2, "retail", false, 100))).toBe(24);
    expect(calculateLineTotalUsd(10, shopAreaCatalogUnit(ACCESSORY, 10, "retail", false, 100))).toBe(120);
    expect(calculateLineTotalUsd(1, shopAreaCatalogUnit({ price_usd: 18 }, 1, "retail", false, 100))).toBe(18);
  });

  it("peptide retail still uses kit/10 divisor", () => {
    expect(shopAreaCatalogUnit(PEPTIDE, 1, "retail", true, 100)).toBe(12);
  });

  it("role markup applied once on accessory unit price", () => {
    const unit100 = shopAreaSellUnitPriceForProductRole(ACCESSORY, 1, 0, "retail", false, null, null, 100);
    expect(unit100).toBe(12);
    const unit125 = shopAreaSellUnitPriceForProductRole(ACCESSORY, 1, 25, "retail", false, null, null, 100);
    expect(unit125).toBe(applyRoleMarkup(12, 25));
    expect(unit125).toBe(15);
  });

  it("explicit area role sell factor 100% does not stack global markup (via sell factor helper contract)", () => {
    const catalog = shopAreaCatalogUnit(ACCESSORY, 1, "retail", false, 100);
    expect(applyRoleMarkup(catalog, 0)).toBe(12);
    expect(applyRoleMarkup(catalog, 25)).toBe(15);
  });

  it("admin basis label shows Stückpreis for accessories", () => {
    expect(adminAreaCatalogPriceBasisLabel("retail", "accessories", ACCESSORY)).toBe("Stückpreis");
    expect(adminAreaCatalogPriceBasisLabel("retail", "zubehoer", ACCESSORY)).toBe("Stückpreis");
    expect(adminAreaCatalogPriceBasisLabel("retail", "peptides", PEPTIDE)).toBe("Kit-/10er-Grundpreis");
  });

  it("shop quantity and labels for accessories", () => {
    expect(shopQuantityOptions(undefined, "retail_unit", "accessories")).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(shopPriceColumnLabels("peptides", "retail", "accessories").unitPrice).toBe("Preis / Stück");
  });
});
