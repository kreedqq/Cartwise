import { formatProductQuantity, formatKitSizeLabel, resolveProductCategoryId } from "@/lib/quantityFormat";
import { normalizeShopDisplayName } from "@/lib/shop/display";
import { formatProductVariant } from "@/lib/shop/variantCoverage";

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

function kitSizeFromNote(note: string | null | undefined): number | null {
  const match = note?.match(/Gemeinsames\s+(\d+)-(?:Vial-|Einheiten-)Kit/i);
  const size = match?.[1] ? Number(match[1]) : NaN;
  return Number.isFinite(size) && size > 0 ? size : null;
}

/** Customer-facing product title in cart, checkout, and orders. */
export function cartItemDisplayName(item: CartLineDisplayInput): string {
  const name = item.product_name_snapshot?.trim();
  if (!name) return "—";
  return normalizeShopDisplayName(name);
}

export function cartItemQuantityLabel(item: CartLineDisplayInput, kitSize?: number | null): string {
  const categoryId = resolveProductCategoryId({
    name: item.product_name_snapshot,
    code: item.product_code_snapshot,
    dosageVial: item.dosage_vial_snapshot,
  });
  const resolvedKitSize = item.kit_share_id ? (kitSize ?? kitSizeFromNote(item.note)) : null;
  return formatProductQuantity({
    quantity: item.quantity,
    categoryId,
    kitSize: resolvedKitSize,
  });
}

/** Variant / kit subtitle beneath the product name. */
export function cartItemVariantSubtitle(item: CartLineDisplayInput): string | null {
  const meta = productMeta(item);
  if (!meta.code && !meta.name) return null;

  if (item.kit_share_id) {
    const variant = formatProductVariant(meta);
    const categoryId = resolveProductCategoryId({
      name: meta.name,
      code: meta.code,
      dosageVial: item.dosage_vial_snapshot,
    });
    const qty = Number(item.quantity);
    const kitSize = kitSizeFromNote(item.note);
    const qtyLabel = Number.isFinite(qty)
      ? formatProductQuantity({ quantity: qty, categoryId, kitSize })
      : String(item.quantity);
    const kitPart = kitSize ? ` · Gemeinsames ${formatKitSizeLabel(kitSize, categoryId)}` : "";
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
