import type { ShopCategoryId } from "@/lib/shopCategories";
import type { ShopPricingProfile } from "@/lib/shop/shopAreas";

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

const RETAIL_VIAL_LABELS: ShopPriceColumnLabels = {
  unitPrice: "Preis / Vial",
  bulkPrice: "",
  bulkActive: "",
  bulkRemaining: () => "",
  noBulk: "",
  usesKitPricing: false,
};

const RETAIL_PACK_LABELS: ShopPriceColumnLabels = {
  unitPrice: "Preis / Packung",
  bulkPrice: "",
  bulkActive: "",
  bulkRemaining: () => "",
  noBulk: "",
  usesKitPricing: false,
};

/** Category-aware shop column labels. Default profile is group_buy (existing kit/tier copy). */
export function shopPriceColumnLabels(
  categoryId: ShopCategoryId,
  profile: ShopPricingProfile = "group_buy",
): ShopPriceColumnLabels {
  if (profile === "retail") {
    return categoryId === "orals" ? RETAIL_PACK_LABELS : RETAIL_VIAL_LABELS;
  }
  if (categoryId === "peptides" || categoryId === "reconstitution-water") {
    return KIT_PRICE_LABELS;
  }
  return UNIT_PRICE_LABELS;
}
