import { normalizeShopDisplayName } from "@/lib/shop/display";
import { formatKitQuantity, kitQuantityUnitLabel } from "@/lib/shop/kitUnits";
import { formatProductVariant, isOralCustomerLabel } from "@/lib/shop/variantCoverage";

export interface CartLineDisplayInput {
  product_name_snapshot: string | null;
  product_code_snapshot: string | null;
  quantity: number | string;
  kit_share_id?: string | null;
  note?: string | null;
  dosage_vial_snapshot?: string | null;
}

function productMeta(item: CartLineDisplayInput) {
  return {
    code: item.product_code_snapshot ?? "",
    name: item.product_name_snapshot ?? "",
    dosage_vial: item.dosage_vial_snapshot ?? null,
  };
}

/** Customer-facing product title in cart, checkout, and orders. */
export function cartItemDisplayName(item: CartLineDisplayInput): string {
  const name = item.product_name_snapshot?.trim();
  if (!name) return "—";
  return normalizeShopDisplayName(name);
}

/** Variant / kit subtitle beneath the product name. */
export function cartItemVariantSubtitle(item: CartLineDisplayInput): string | null {
  const meta = productMeta(item);
  if (!meta.code && !meta.name) return null;

  if (item.kit_share_id) {
    const variant = formatProductVariant(meta);
    const unit = isOralCustomerLabel(variant) ? "Stück" : kitQuantityUnitLabel(meta);
    const qty = Number(item.quantity);
    const qtyLabel = Number.isFinite(qty) ? formatKitQuantity(qty, unit) : String(item.quantity);
    const kitSizeMatch = item.note?.match(/Gemeinsames\s+(\d+)-(?:Vial-|Einheiten-)Kit/i);
    const kitSize = kitSizeMatch?.[1];
    const kitPart = kitSize ? ` · Gemeinsames ${kitSize}-${unit === "Stück" ? "Stück" : "Vial"}-Kit` : "";
    const strengthPart = variant !== "Standard" && !variant.startsWith(String(qty)) ? `${variant} · ` : "";
    return `${strengthPart}${qtyLabel} · Kit Anteil${kitPart}`;
  }

  const variant = formatProductVariant(meta);
  if (variant === "Standard") return null;
  return variant;
}

export function isKitShareCartItem(item: CartLineDisplayInput): boolean {
  return Boolean(item.kit_share_id);
}
