import type { ShopCategoryId } from "@/lib/shopCategories";

export interface ShopPriceColumnLabels {
  unitPrice: string;
  bulkPrice: string;
  bulkActive: string;
  bulkRemaining: (remaining: string) => string;
  noBulk: string;
  usesKitPricing: boolean;
}

const KIT_PRICE_LABELS: ShopPriceColumnLabels = {
  unitPrice: "Preis / 10 Vials (Kit)",
  bulkPrice: "Preis / 10 Kits",
  bulkActive: "Preis ab 10 Kits aktiv",
  bulkRemaining: (remaining) => `Noch ${remaining} bis Preis ab 10 Kits`,
  noBulk: "Kein Mengenpreis",
  usesKitPricing: true,
};

const UNIT_PRICE_LABELS: ShopPriceColumnLabels = {
  unitPrice: "Einzelpreis",
  bulkPrice: "Preis ab 10 Stück",
  bulkActive: "Preis ab 10 Stück aktiv",
  bulkRemaining: (remaining) => `Noch ${remaining} bis Preis ab 10 Stück`,
  noBulk: "Kein Mengenpreis",
  usesKitPricing: false,
};

/** Category-aware shop column labels for peptides/water vs oils/orals. */
export function shopPriceColumnLabels(categoryId: ShopCategoryId): ShopPriceColumnLabels {
  if (categoryId === "peptides" || categoryId === "reconstitution-water") {
    return KIT_PRICE_LABELS;
  }
  return UNIT_PRICE_LABELS;
}
