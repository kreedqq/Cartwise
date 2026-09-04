import { isInjectableOilCatalogName, isOralCatalogName, isReconstitutionWaterName } from "@/lib/peptide/shopCoverage/formClass";
import { shopCategoryIdFor, type ShopCategoryId } from "@/lib/shopCategories";

export type ProductQuantityKind = "kit" | "vial" | "packung";

export interface ProductQuantityInput {
  quantity: number | string | null | undefined;
  categoryId?: ShopCategoryId | null;
  category?: string | null;
  name?: string | null;
  code?: string | null;
  dosageVial?: string | null;
  /** Only when a real kit_share identity exists. Never inferred from SKU/name/qty. */
  kitSize?: number | string | null;
}

/** Postgres `numeric` often arrives as `"5.000"`. Never treat that string as kit count. */
export function asQuantity(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function resolveProductCategoryId(input: {
  categoryId?: ShopCategoryId | null;
  category?: string | null;
  name?: string | null;
  code?: string | null;
  dosageVial?: string | null;
}): ShopCategoryId {
  if (input.categoryId) return input.categoryId;
  const mapped = shopCategoryIdFor({
    category: input.category,
    name: input.name,
    code: input.code,
  });
  if (input.category?.trim()) return mapped;
  if (mapped !== "peptides") return mapped;
  const name = input.name?.trim() ?? "";
  if (name && isReconstitutionWaterName(name)) return "reconstitution-water";
  if (name && isInjectableOilCatalogName(name)) return "injectable-oils";
  if (name && isOralCatalogName(name)) return "orals";
  if (looksLikeOralPack(input.dosageVial)) return "orals";
  return mapped;
}

function looksLikeOralPack(dosage?: string | null): boolean {
  return Boolean(dosage && /\b(tablets?|capsules?|kapseln|tabletten)\b/i.test(dosage));
}

export function productQuantityKindFor(categoryId: ShopCategoryId): ProductQuantityKind {
  if (categoryId === "injectable-oils") return "vial";
  if (categoryId === "orals") return "packung";
  return "kit";
}

export function usesKitNoun(categoryId: ShopCategoryId): boolean {
  return productQuantityKindFor(categoryId) === "kit";
}

function singularUnit(kind: ProductQuantityKind): string {
  if (kind === "vial") return "Vial";
  if (kind === "packung") return "Packung";
  return "Kit";
}

function pluralUnit(kind: ProductQuantityKind): string {
  if (kind === "vial") return "Vials";
  if (kind === "packung") return "Packungen";
  return "Kits";
}

/** Menge < 2 → singular, Menge >= 2 → plural. Includes 0 Kit / 0 Vial / 0 Packung. */
export function formatUnitWord(kind: ProductQuantityKind, count: number): string {
  return asQuantity(count) < 2 ? singularUnit(kind) : pluralUnit(kind);
}

export function formatCountedQuantity(count: number, kind: ProductQuantityKind): string {
  const amount = asQuantity(count);
  return `${amount} ${formatUnitWord(kind, amount)}`;
}

/** Catalog / cart / order lines without a real kit share. */
export function formatCatalogQuantity(quantity: number, categoryId: ShopCategoryId): string {
  return formatCountedQuantity(quantity, productQuantityKindFor(categoryId));
}

/**
 * Share of a real kit. The fraction itself always uses the singular unit:
 * 5/10 Kit, 5/10 Vial, 5/10 Packung.
 */
export function formatPartialKitQuantity(filled: number, kitSize: number, categoryId: ShopCategoryId): string {
  const kind = productQuantityKindFor(categoryId);
  return `${asQuantity(filled)}/${asQuantity(kitSize)} ${singularUnit(kind)}`;
}

/**
 * Complete kits for peptide/water: 1 Kit, 2 Kits.
 * Oils/orals never say Kit — a filled 10er oil kit is 10 Vials.
 */
export function formatCompleteKitCount(
  kitCount: number,
  categoryId: ShopCategoryId,
  kitSize = 0,
): string {
  if (!usesKitNoun(categoryId)) {
    const size = asQuantity(kitSize);
    const units = size > 0 ? asQuantity(kitCount) * size : asQuantity(kitCount);
    return formatCatalogQuantity(units, categoryId);
  }
  return formatCountedQuantity(kitCount, "kit");
}

/**
 * Merchant / order-item kit math: floor(vials / size) complete units plus remainder share.
 * 25 of a 10er peptide kit → "2 Kits + 5/10 Kit".
 * Oils with a real kit stay on Vial/Vials and never say Kit.
 */
export function formatKitSplitQuantity(
  completeKits: number,
  remainderVials: number,
  kitSize: number,
  categoryId: ShopCategoryId,
): string {
  const complete = asQuantity(completeKits);
  const remainder = asQuantity(remainderVials);
  const size = asQuantity(kitSize);
  const parts: string[] = [];

  if (usesKitNoun(categoryId)) {
    if (complete > 0) parts.push(formatCompleteKitCount(complete, categoryId));
    if (remainder > 0) parts.push(formatPartialKitQuantity(remainder, size, categoryId));
  } else {
    const completeUnits = complete * (size > 0 ? size : 0);
    if (completeUnits > 0) parts.push(formatCatalogQuantity(completeUnits, categoryId));
    if (remainder > 0) parts.push(formatPartialKitQuantity(remainder, size, categoryId));
  }

  if (parts.length === 0) return formatCatalogQuantity(0, categoryId);
  return parts.join(" + ");
}

export function formatProductQuantity(input: ProductQuantityInput): string {
  const categoryId = resolveProductCategoryId(input);
  const quantity = asQuantity(input.quantity);
  const kitSize = input.kitSize == null || input.kitSize === "" ? 0 : asQuantity(input.kitSize);
  if (kitSize > 0) {
    const completeKits = Math.floor(quantity / kitSize);
    const remainderVials = quantity % kitSize;
    return formatKitSplitQuantity(completeKits, remainderVials, kitSize, categoryId);
  }
  return formatCatalogQuantity(quantity, categoryId);
}

export function formatOrderItemQuantity(
  item: {
    quantity: number | string | null | undefined;
    product_name_snapshot?: string | null;
    product_code_snapshot?: string | null;
    product_id?: string | null;
    dosage_vial_snapshot?: string | null;
  },
  kitSize?: number | null,
): string {
  return formatProductQuantity({
    quantity: item.quantity,
    name: item.product_name_snapshot,
    code: item.product_code_snapshot,
    dosageVial: item.dosage_vial_snapshot,
    kitSize,
  });
}

export function formatKitSizeLabel(kitSize: number, categoryId: ShopCategoryId): string {
  const size = asQuantity(kitSize);
  if (usesKitNoun(categoryId)) return `${size}er Kit`;
  return formatCatalogQuantity(size, categoryId);
}
