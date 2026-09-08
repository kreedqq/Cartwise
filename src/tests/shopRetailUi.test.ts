import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { shopQuantityOptions } from "@/lib/shop/display";
import { shopPriceColumnLabels } from "@/lib/shop/priceLabels";
import { formatCatalogQuantity, formatPartialKitQuantity } from "@/lib/quantityFormat";

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
    const shop = read("src/pages/Shop.tsx");
    expect(shop).toContain('pricingProfile="retail"');
    expect(shop).not.toMatch(/Preis ab 10 Vials/);
    expect(shop).not.toMatch(/Preis \/ 10 Vials/);
    expect(shop).not.toMatch(/5\/10 Kit/);
    expect(shop).not.toContain("KitRequestsPage");
    expect(read("src/components/shop/ShopProductsTable.tsx")).toContain("showBulkColumn = !isRetailPricing");
    expect(read("src/components/shop/ShopProductsTable.tsx")).toContain("showKitShare = !isRetailPricing");
  });

  it("keeps 5/10 kit copy on Group Buy kit cards", () => {
    expect(formatPartialKitQuantity(5, 10, "peptides")).toBe("5/10 Kit");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toMatch("remainingVials");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toMatch("kitSizeVials");
    expect(read("src/pages/KitRequests.tsx")).toMatch("JoinKitRequestDialog");
    expect(read("src/pages/KitRequests.tsx")).toMatch("useLeaveKitRequest");
  });
});

describe("admin Verkaufsbereiche", () => {
  it("configures products, document, prices, and role prices per area", () => {
    const page = read("src/pages/admin/AdminShopAreas.tsx");
    expect(page).toContain("Verkaufsbereiche");
    expect(page).toContain('value="allgemein"');
    expect(page).toContain('value="produkte"');
    expect(page).toContain('value="dokument"');
    expect(page).toContain('value="preise"');
    expect(page).toContain('value="rollenpreise"');
    expect(page).toContain("uploadAdminShopAreaDocument");
    expect(page).toContain("upsertAdminShopAreaProductPrice");
    expect(page).toContain("upsertAdminShopAreaRoleMarkup");
    expect(page).toContain("setAdminShopAreaProductActive");
    expect(read("src/lib/adminNav.ts")).toContain("Verkaufsbereiche");
  });
});
