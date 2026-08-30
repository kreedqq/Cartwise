import { applyRoleMarkup, roundCurrency } from "@/lib/money";
import { shopCategoryIdFor } from "@/lib/shopCategories";

/** Vials (or water units) covered by one catalog `price_usd` row for peptides / water. */
export const CATALOG_UNITS_PER_KIT_PRICE = 10;

export interface KitSharePricedProduct {
  price_usd: number;
  bulk_price_usd?: number | null;
  bulk_price_min_quantity?: number | null;
  category?: string | null;
  name?: string | null;
  code?: string | null;
}

/** Peptides and reconstitution water store `price_usd` per 10-vial catalog kit. */
export function productUsesKitUnitPricing(product: KitSharePricedProduct): boolean {
  const categoryId = shopCategoryIdFor(product);
  return categoryId === "peptides" || categoryId === "reconstitution-water";
}

/** Units encoded in one catalog price row (10 vials for kit-priced products, 1 piece otherwise). */
export function catalogPackSize(product: KitSharePricedProduct): number {
  return productUsesKitUnitPricing(product) ? CATALOG_UNITS_PER_KIT_PRICE : 1;
}

/**
 * Whether bulk tier applies to a shared kit allocation.
 * Kit-priced: bulk_min counts catalog kits (e.g. 10 kits = 100 vials), not individual vials.
 * Unit-priced: bulk_min counts individual pieces in the shared kit.
 */
export function kitShareBulkApplies(
  product: KitSharePricedProduct,
  allocatedTotal: number,
): boolean {
  const bulk = product.bulk_price_usd;
  const bulkMin = product.bulk_price_min_quantity;
  if (bulk == null || bulkMin == null || bulkMin <= 0 || allocatedTotal <= 0) {
    return false;
  }

  const packSize = catalogPackSize(product);
  const catalogQuantity = allocatedTotal / packSize;
  return catalogQuantity >= bulkMin;
}

function kitShareBaseCatalogPriceUsd(
  product: KitSharePricedProduct,
  allocatedTotal: number,
): number {
  const useBulk = kitShareBulkApplies(product, allocatedTotal);
  return useBulk ? (product.bulk_price_usd as number) : product.price_usd;
}

/**
 * Total catalog USD for the full shared kit (kit_size units) before role markup.
 * Peptides: price_usd × (kit_size / 10). Oils/orals: price_usd × kit_size.
 */
export function kitShareKitCatalogTotalUsd(
  product: KitSharePricedProduct,
  kitSize: number,
  allocatedTotal: number = kitSize,
): number {
  if (kitSize <= 0) return 0;

  const basePrice = kitShareBaseCatalogPriceUsd(product, allocatedTotal);
  if (productUsesKitUnitPricing(product)) {
    return basePrice * (kitSize / catalogPackSize(product));
  }
  return basePrice * kitSize;
}

/** Per-unit catalog price: kit_catalog_total / kit_size (never the full kit price). */
export function kitShareCatalogUnitUsd(
  product: KitSharePricedProduct,
  kitSize: number,
  allocatedTotal: number = kitSize,
): number {
  if (kitSize <= 0) return 0;
  return kitShareKitCatalogTotalUsd(product, kitSize, allocatedTotal) / kitSize;
}

/** Participant share before role markup: kit_price × participant_quantity / kit_size. */
export function kitShareParticipantBaseUsd(
  product: KitSharePricedProduct,
  kitSize: number,
  allocatedTotal: number,
  participantQuantity: number,
): number {
  if (kitSize <= 0) return 0;
  return roundCurrency(
    (kitShareKitCatalogTotalUsd(product, kitSize, allocatedTotal) * participantQuantity) / kitSize,
  );
}

/** Role-aware participant total (matches kit_share_participant_price_usd). */
export function kitShareParticipantPriceUsd(
  product: KitSharePricedProduct,
  kitSize: number,
  allocatedTotal: number,
  participantQuantity: number,
  markupPercent: number,
): number {
  const baseShare = kitShareParticipantBaseUsd(
    product,
    kitSize,
    allocatedTotal,
    participantQuantity,
  );
  return roundCurrency(applyRoleMarkup(baseShare, markupPercent));
}

/** Role-aware per-unit selling price for cart lines (matches kit_share_sync_participant_cart). */
export function kitShareSellingUnitUsd(
  product: KitSharePricedProduct,
  kitSize: number,
  allocatedTotal: number,
  markupPercent: number,
): number {
  const catalogUnit = kitShareCatalogUnitUsd(product, kitSize, allocatedTotal);
  return applyRoleMarkup(catalogUnit, markupPercent);
}

/** Cart line model mirroring kit_share_sync_participant_cart snapshots. */
export function kitShareCartLineUsd(
  product: KitSharePricedProduct,
  kitSize: number,
  allocatedTotal: number,
  participantQuantity: number,
  markupPercent: number,
): {
  quantity: number;
  catalogUnitPrice: number;
  unitPriceUsd: number;
  lineTotalUsd: number;
  participantFinalPriceUsd: number;
} {
  const catalogUnitPrice = kitShareCatalogUnitUsd(product, kitSize, allocatedTotal);
  const unitPriceUsd = kitShareSellingUnitUsd(product, kitSize, allocatedTotal, markupPercent);
  const lineTotalUsd = roundCurrency(participantQuantity * unitPriceUsd);
  const participantFinalPriceUsd = kitShareParticipantPriceUsd(
    product,
    kitSize,
    allocatedTotal,
    participantQuantity,
    markupPercent,
  );
  return {
    quantity: participantQuantity,
    catalogUnitPrice,
    unitPriceUsd,
    lineTotalUsd,
    participantFinalPriceUsd,
  };
}

/** Normal-tier per-unit selling price snapshot (ignores active bulk tier). */
export function kitShareNormalSellingUnitUsd(
  product: KitSharePricedProduct,
  kitSize: number,
  markupPercent: number,
): number {
  if (kitSize <= 0) return 0;
  const packSize = catalogPackSize(product);
  const normalUnit = productUsesKitUnitPricing(product)
    ? product.price_usd / packSize
    : product.price_usd;
  return applyRoleMarkup(normalUnit, markupPercent);
}

/** Bulk-tier per-unit selling price snapshot when bulk is configured. */
export function kitShareBulkSellingUnitUsd(
  product: KitSharePricedProduct,
  kitSize: number,
  markupPercent: number,
): number | null {
  if (product.bulk_price_usd == null || kitSize <= 0) return null;
  const packSize = catalogPackSize(product);
  const bulkUnit = productUsesKitUnitPricing(product)
    ? product.bulk_price_usd / packSize
    : product.bulk_price_usd;
  return applyRoleMarkup(bulkUnit, markupPercent);
}
