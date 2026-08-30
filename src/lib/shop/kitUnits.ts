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

/** Customer-facing quantity unit for kit allocation display. */
export function kitQuantityUnitLabel(
  product: { category?: string | null; name?: string | null; code?: string | null },
): "Vials" | "Stück" {
  const categoryId = shopCategoryIdFor(product);
  if (categoryId === "injectable-oils" || categoryId === "orals") {
    return "Stück";
  }
  return "Vials";
}

export function kitQuantityUnitLabelForCategory(categoryId: ShopCategoryId): "Vials" | "Stück" {
  if (categoryId === "injectable-oils" || categoryId === "orals") {
    return "Stück";
  }
  return "Vials";
}

export function formatKitQuantity(qty: number, unit: "Vials" | "Stück"): string {
  if (unit === "Stück") {
    return `${qty} Stück`;
  }
  return `${qty} Vial${qty === 1 ? "" : "s"}`;
}
