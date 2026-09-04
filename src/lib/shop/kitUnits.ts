import { formatCatalogQuantity, formatKitSizeLabel, formatProductQuantity } from "@/lib/quantityFormat";
import type { ShopCategoryId } from "@/lib/shopCategories";
import { shopCategoryIdFor } from "@/lib/shopCategories";

export const KIT_SIZE_STEP = 10;
export const KIT_SIZE_MIN = 10;
export const KIT_SIZE_MAX = 100;

/** Selectable shared kit totals: 10, 20, … 100 units. */
export const KIT_SIZE_OPTIONS = Array.from(
  { length: KIT_SIZE_MAX / KIT_SIZE_STEP },
  (_, i) => (i + 1) * KIT_SIZE_STEP,
);

export function isValidKitSize(size: number): boolean {
  return (
    Number.isInteger(size) &&
    size >= KIT_SIZE_MIN &&
    size <= KIT_SIZE_MAX &&
    size % KIT_SIZE_STEP === 0
  );
}

export function kitCategoryIdFor(
  product: { category?: string | null; name?: string | null; code?: string | null },
): ShopCategoryId {
  return shopCategoryIdFor(product);
}

/** @deprecated Use formatCatalogQuantity / formatPartialKitQuantity. Kept as a thin wrapper. */
export function kitQuantityUnitLabel(
  product: { category?: string | null; name?: string | null; code?: string | null },
): string {
  return formatCatalogQuantity(1, kitCategoryIdFor(product)).replace(/^\d+\s+/, "");
}

export function kitQuantityUnitLabelForCategory(categoryId: ShopCategoryId): string {
  return formatCatalogQuantity(1, categoryId).replace(/^\d+\s+/, "");
}

export function formatKitQuantity(qty: number, categoryId: ShopCategoryId, kitSize?: number): string {
  return formatProductQuantity({ quantity: qty, categoryId, kitSize });
}

export function formatKitSizeOption(size: number, categoryId: ShopCategoryId): string {
  return formatKitSizeLabel(size, categoryId);
}
