import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { shopPriceColumnLabels } from "@/lib/shop/priceLabels";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("redundant bulk threshold badge", () => {
  it("keeps the column label Preis ab 10 Stück", () => {
    const labels = shopPriceColumnLabels("orals");
    expect(labels.bulkPrice).toBe("Preis ab 10 Stück");
    expect(labels.bulkRemaining("9")).toBe("Noch 9 bis Preis ab 10 Stück");
  });

  it("does not render a second ab X line next to the bulk price", () => {
    const desktop = readSource("src/components/shop/ShopProductsTable.tsx");
    const mobile = readSource("src/components/shop/ShopProductsMobileList.tsx");
    expect(desktop).toContain("priceLabels.bulkPrice");
    expect(desktop).toContain("priceLabels.bulkRemaining");
    expect(desktop).not.toMatch(/ab \{formatQuantity\(product\.bulk_price_min_quantity\)\}/);
    expect(mobile).toContain("priceLabels.bulkPrice");
    expect(mobile).toContain("priceLabels.bulkRemaining");
    expect(mobile).not.toMatch(/ab \{formatQuantity\(product\.bulk_price_min_quantity\)\}/);
  });
});
