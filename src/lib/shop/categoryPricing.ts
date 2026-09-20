import { shopCategoryIdFor } from "@/lib/shopCategories";
import type { ShopPricingProfile } from "@/lib/shop/shopAreas";

/** Stable area category key for Zubehör (PenBuddy area). */
export const ACCESSORIES_AREA_CATEGORY_KEY = "accessories";

/** Legacy/production PenBuddy area category key (same pricing unit as accessories). */
export const ZUBEHOR_AREA_CATEGORY_KEY = "zubehoer";

export interface CategoryPricingProductRef {
  category?: string | null;
  name?: string | null;
  code?: string | null;
}

export function normalizeAreaCategoryKey(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
}

export function isAccessoriesAreaCategory(categoryKey: string | null | undefined): boolean {
  if (!categoryKey?.trim()) return false;
  const key = normalizeAreaCategoryKey(categoryKey);
  return key === ACCESSORIES_AREA_CATEGORY_KEY || key === ZUBEHOR_AREA_CATEGORY_KEY;
}

function productCategoryNormalized(product: CategoryPricingProductRef | undefined): string {
  return (product?.category ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
}

/** Product row category text (vendor/master), mirrors SQL product_uses_kit_unit_pricing. */
export function productUsesKitUnitPricingFromProduct(
  product: CategoryPricingProductRef | undefined,
): boolean {
  const cat = productCategoryNormalized(product);
  if (cat.includes("accessor") || cat.includes("zubehoer")) return false;
  if (cat.includes("oral")) return false;
  if (cat.includes("oil") || cat.includes("inject")) return false;
  const categoryId = shopCategoryIdFor(product ?? {});
  return categoryId === "peptides" || categoryId === "reconstitution-water";
}

/**
 * Kit-/10 catalog divisor applies only to peptide and reconstitution-water area categories.
 * Prefer `categoryKey` from area assignment; fall back to product category when unset.
 */
export function usesKitUnitPricingForAreaCategory(
  categoryKey: string | null | undefined,
  product?: CategoryPricingProductRef,
): boolean {
  if (categoryKey?.trim()) {
    const key = normalizeAreaCategoryKey(categoryKey);
    if (key === ACCESSORIES_AREA_CATEGORY_KEY) return false;
    if (key === "injectable-oils" || key === "orals") return false;
    if (key === "peptides" || key === "reconstitution-water") return true;
    return false;
  }
  return productUsesKitUnitPricingFromProduct(product);
}

export function adminAreaCatalogPriceBasisLabel(
  profile: ShopPricingProfile,
  categoryKey: string | null | undefined,
  product?: CategoryPricingProductRef,
): string {
  if (profile !== "retail") return "Einzelpreis";
  if (isAccessoriesAreaCategory(categoryKey)) return "Stückpreis";
  if (usesKitUnitPricingForAreaCategory(categoryKey, product)) return "Kit-/10er-Grundpreis";
  return "Einzelpreis";
}
