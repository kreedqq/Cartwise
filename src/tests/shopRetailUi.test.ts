import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { shopQuantityOptions } from "@/lib/shop/display";
import { shopPriceColumnLabels } from "@/lib/shop/priceLabels";
import { formatCatalogQuantity, formatPartialKitQuantity } from "@/lib/quantityFormat";
import { formatRetailVariantLabel, formatVialVariant } from "@/lib/shop/variantCoverage";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("retail shop UI", () => {
  it("shows vial/pack unit prices and 1/5/10 vial quantities", () => {
    expect(shopPriceColumnLabels("peptides", "retail").unitPrice).toBe("Preis / Vial");
    expect(shopPriceColumnLabels("injectable-oils", "retail").unitPrice).toBe("Preis / Vial");
    expect(shopPriceColumnLabels("orals", "retail").unitPrice).toBe("Preis / Packung");
    expect(shopPriceColumnLabels("peptides", "retail").bulkPrice).toBe("");
    expect(shopQuantityOptions("peptides", "retail_unit")).toEqual([1, 5, 10]);
    expect(shopQuantityOptions("injectable-oils", "retail_unit")).toEqual([1, 5, 10]);
    expect(shopQuantityOptions("orals", "retail_unit")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(formatCatalogQuantity(1, "peptides", "retail_unit")).toBe("1 Vial");
    expect(formatCatalogQuantity(5, "peptides", "retail_unit")).toBe("5 Vials");
    expect(formatCatalogQuantity(1, "orals", "retail_unit")).toBe("1 Packung");
  });

  it("does not render kit or ab-10 copy on the retail shop page", () => {
    const shop = read("src/pages/ShopRetail.tsx");
    expect(shop).toContain('pricingProfile="retail"');
    expect(shop).not.toMatch(/Preis ab 10 Vials/);
    expect(shop).not.toMatch(/Preis \/ 10 Vials/);
    expect(shop).not.toMatch(/5\/10 Kit/);
    expect(shop).not.toContain("KitRequestsPage");
    expect(read("src/components/shop/ShopProductsTable.tsx")).toContain("showBulkColumn = !isRetailPricing");
    expect(read("src/components/shop/ShopProductsTable.tsx")).toContain("showKitShare = !isRetailPricing");
  });

  it("retail variant label strips kit kit-size prefix and never returns 'Nx ...' format", () => {
    // Known CSV product code (10AD = AOD9604) has kitSizeVials=10, vialStrength="10 mg".
    // Group-buy returns "10x 10 mg Vials"; retail should return only "10 mg".
    const aodProduct = { code: "10AD", dosage_vial: null as string | null, name: "AOD9604" };
    const retailLabel = formatRetailVariantLabel(aodProduct);
    expect(retailLabel).toBe("10 mg");
    expect(retailLabel).not.toMatch(/\d+x/i); // no kit-count prefix in retail
    expect(formatVialVariant(aodProduct)).toBe("10x 10 mg Vials"); // full kit label for comparison

    // A product with simple dosage_vial (already just a strength, no kit prefix)
    const simpleProduct = { code: "SIM001", dosage_vial: "5 mg", name: "Simple Peptide" };
    expect(formatRetailVariantLabel(simpleProduct)).toBe("5 mg");
  });

  it("keeps 5/10 kit copy on Group Buy kit cards", () => {
    expect(formatPartialKitQuantity(5, 10, "peptides")).toBe("5/10 Kit");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toMatch("remainingVials");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toMatch("kitSizeVials");
    expect(read("src/pages/KitRequests.tsx")).toMatch("JoinKitRequestDialog");
    expect(read("src/pages/KitRequests.tsx")).toMatch("useLeaveKitRequest");
  });

  it("GroupBuyPage integrates catalog and kit requests", () => {
    const page = read("src/pages/GroupBuy.tsx");
    expect(page).toContain('pricingProfile="group_buy"');
    expect(page).toContain("JoinKitRequestDialog");
    expect(page).toContain("useLeaveKitRequest");
    expect(page).toContain("ShopProductsTable");
    expect(page).toContain("ShopCategoryHub");
    expect(read("src/components/shop/ShopProductsTable.tsx")).toContain("DualCurrencyPrice");
    expect(read("src/components/shop/ShopProductsMobileList.tsx")).toContain("DualCurrencyPrice");
  });
});

describe("ShopHub routing", () => {
  it("ShopHubPage redirects when only one area is accessible", () => {
    const hub = read("src/pages/ShopHub.tsx");
    expect(hub).toContain("areas.length === 1");
    expect(hub).toContain('to={SHOP_AREA_PATHS[areas[0].key]}');
    expect(hub).toContain("Navigate");
  });

  it("ShopHubPage shows area cards when multiple areas are accessible", () => {
    const hub = read("src/pages/ShopHub.tsx");
    expect(hub).toContain("ShopAreaCard");
    expect(hub).toContain("SHOP_AREA_PATHS");
  });
});

describe("admin Verkaufsbereiche", () => {
  it("is one vendor catalog per area with Händlerkatalog, Produkte, and Preise", () => {
    const page = read("src/pages/admin/AdminShopAreas.tsx");
    expect(page).toContain("Verkaufsbereiche");
    expect(page).toContain("Händlerkatalog");
    expect(page).toContain("Katalog anwenden");
    expect(page).toContain("applyVendorCatalogFromFile");
    expect(page).toContain("parseVendorCatalogFile");
    expect(page).toContain("ohne globale Produktverknüpfung");
    expect(page).toContain("vendor_name: entry.name");
    expect(page).toContain("vendor_dosage: entry.dosage_vial");
    expect(page).toContain("row.vendor_dosage ?? product?.dosage_vial");
    expect(page).not.toContain("variant: product?.dosage_vial ?? row.vendor_dosage");
    expect(page).toContain("Aktuelle Händlerdatei (angewendet)");
    expect(page).toContain('value="haendlerkatalog"');
    expect(page).toContain('value="produkte"');
    expect(page).toContain('value="preise"');
    expect(page).not.toContain('value="allgemein"');
    expect(page).not.toContain('value="dokument"');
    expect(page).not.toContain('value="rollenpreise"');
    expect(page).not.toContain("upsertAdminShopAreaRoleMarkup");
    expect(page).not.toContain("upsertAdminShopAreaProductPrice");
    expect(page).not.toContain("setAdminShopAreaProductActive");
    expect(page).toContain("setAdminShopAreaManualPrice");
    expect(page).toContain("setAdminShopAreaProductCategory");
    expect(page).toContain("Zur Importkategorie zurücksetzen");
    expect(page).toContain("Kategorien");
    expect(page).toContain("Manuelle Grundpreise für vorhandene Artikel behalten");
    expect(page).toContain("Override entfernen");
    expect(page).toContain("Bereichs-%-Grundpreis");
    expect(page).toContain("base_price_factor_pct");
    expect(page).toContain("updateAdminShopArea");
    expect(page).not.toContain("uploadAdminShopAreaDocument");
    expect(read("src/lib/adminNav.ts")).toContain("Verkaufsbereiche");
    expect(read("src/lib/adminNav.ts")).not.toContain("Globaler Produkt-Master");
    expect(read("src/lib/adminNav.ts")).not.toContain("Master-Verlauf");
    const service = read("src/services/shopAreas.ts");
    expect(service.indexOf("uploadNewFile")).toBeLessThan(service.indexOf("applyCatalog"));
    expect(service).toContain("_keep_manual_overrides");
    expect(service).toContain("set_area_vendor_manual_price");
    expect(service).toContain("set_area_vendor_category");
    expect(service).toContain("list_shop_area_storefront");
  });
});
