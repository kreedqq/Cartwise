import { normalizeShopDisplayName } from "@/lib/shop/display";
import { formatVialVariant, vialStrengthForProduct } from "@/lib/shop/variantCoverage";

export interface CartLineDisplayInput {
  product_name_snapshot: string | null;
  product_code_snapshot: string | null;
  quantity: number | string;
  kit_share_id?: string | null;
  note?: string | null;
}

function productMeta(item: CartLineDisplayInput) {
  return {
    code: item.product_code_snapshot ?? "",
    name: item.product_name_snapshot ?? "",
    dosage_vial: null as string | null,
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
    const strength =
      vialStrengthForProduct(meta) ??
      formatVialVariant(meta).replace(/^10x\s+/i, "").replace(/\s+Vials$/i, "");
    const qty = Number(item.quantity);
    const qtyLabel = Number.isFinite(qty) ? `${qty} Vial${qty === 1 ? "" : "s"}` : String(item.quantity);
    const kitSizeMatch = item.note?.match(/Gemeinsames\s+(\d+)-Vial-Kit/i);
    const kitSize = kitSizeMatch?.[1];
    const kitPart = kitSize ? ` · Gemeinsames ${kitSize}-Vial-Kit` : "";
    return `${strength} · ${qtyLabel} · Kit Anteil${kitPart}`;
  }

  const variant = formatVialVariant(meta);
  if (variant === "Standard") return null;
  if (/^\d/.test(variant) && variant.includes("Vials")) return variant;
  return variant;
}

export function isKitShareCartItem(item: CartLineDisplayInput): boolean {
  return Boolean(item.kit_share_id);
}
