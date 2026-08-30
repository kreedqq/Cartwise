import { describe, expect, it } from "vitest";

import { shopPriceColumnLabels } from "@/lib/shop/priceLabels";

describe("shopPriceColumnLabels", () => {
  it("uses kit pricing labels for peptides and reconstitution water", () => {
    for (const categoryId of ["peptides", "reconstitution-water"] as const) {
      const labels = shopPriceColumnLabels(categoryId);
      expect(labels.unitPrice).toBe("Preis / 10 Vials (Kit)");
      expect(labels.bulkPrice).toBe("Preis / 10 Kits");
      expect(labels.usesKitPricing).toBe(true);
    }
  });

  it("uses unit pricing labels for oils and orals", () => {
    for (const categoryId of ["injectable-oils", "orals"] as const) {
      const labels = shopPriceColumnLabels(categoryId);
      expect(labels.unitPrice).toBe("Einzelpreis");
      expect(labels.bulkPrice).toBe("Preis ab 10 Stück");
      expect(labels.usesKitPricing).toBe(false);
    }
  });
});
