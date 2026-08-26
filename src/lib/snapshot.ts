import {
  calculateLineTotalUsd,
  convertUsdToEur,
  getEffectiveUnitPrice,
  roundCurrency,
  type PricedProduct,
} from "@/lib/money";
import type { PriceTier, Tables } from "@/types/database";

/** The product fields a cart line snapshot needs. */
export interface SnapshotSourceProduct extends PricedProduct {
  code: string;
  name: string;
}

/**
 * Fields captured on a cart_item at the moment a price is taken from the
 * product catalog (see docs/KONZEPT.md §5 "Preis-Snapshot-Strategie").
 *
 * The snapshot deliberately freezes the *whole* price structure, not just the
 * single number that happened to apply. That way a later quantity edit can
 * re-select the tier from the price list the user actually saw, without
 * silently pulling in a newer catalog price - which is exactly the guarantee
 * the snapshot exists for.
 */
export interface PriceSnapshot {
  productCodeSnapshot: string;
  productNameSnapshot: string;
  /** The unit price actually applied to this line. */
  unitPriceUsdSnapshot: number;
  normalPriceUsdSnapshot: number;
  bulkPriceUsdSnapshot: number | null;
  bulkPriceMinQuantitySnapshot: number | null;
  appliedPriceTier: PriceTier;
  exchangeRateSnapshot: number | null;
  eurValueSnapshot: number | null;
  priceSnapshotAt: string;
}

export function buildSnapshot(
  product: SnapshotSourceProduct,
  quantity: number,
  rate: number | null,
): PriceSnapshot {
  const effective = getEffectiveUnitPrice(product, quantity);
  const totalUsd = calculateLineTotalUsd(quantity, effective.unitPriceUsd) ?? 0;
  const eurValue = convertUsdToEur(totalUsd, rate);

  return {
    productCodeSnapshot: product.code,
    productNameSnapshot: product.name,
    unitPriceUsdSnapshot: effective.unitPriceUsd,
    normalPriceUsdSnapshot: product.price_usd,
    bulkPriceUsdSnapshot: effective.bulkPriceUsd,
    bulkPriceMinQuantitySnapshot: effective.bulkPriceMinQuantity,
    appliedPriceTier: effective.tier,
    exchangeRateSnapshot: rate,
    eurValueSnapshot: eurValue,
    priceSnapshotAt: new Date().toISOString(),
  };
}

/** The cart_items columns a snapshot maps onto, in database naming. */
export interface CartItemPriceColumns {
  unit_price_usd_snapshot: number;
  normal_price_usd_snapshot: number;
  bulk_price_usd_snapshot: number | null;
  bulk_price_min_quantity_snapshot: number | null;
  applied_price_tier: PriceTier;
  exchange_rate_snapshot: number | null;
  eur_value_snapshot: number | null;
  price_snapshot_at: string;
}

/**
 * Single place that translates a snapshot into cart_items columns, so no
 * caller has to remember the full column list (and none can forget a column).
 */
export function snapshotToColumns(snapshot: PriceSnapshot): CartItemPriceColumns {
  return {
    unit_price_usd_snapshot: snapshot.unitPriceUsdSnapshot,
    normal_price_usd_snapshot: snapshot.normalPriceUsdSnapshot,
    bulk_price_usd_snapshot: snapshot.bulkPriceUsdSnapshot,
    bulk_price_min_quantity_snapshot: snapshot.bulkPriceMinQuantitySnapshot,
    applied_price_tier: snapshot.appliedPriceTier,
    exchange_rate_snapshot: snapshot.exchangeRateSnapshot,
    eur_value_snapshot: snapshot.eurValueSnapshot,
    price_snapshot_at: snapshot.priceSnapshotAt,
  };
}

/** Every price column reset to null, for a line whose code no longer resolves. */
export const CLEARED_PRICE_COLUMNS: {
  [K in keyof CartItemPriceColumns]: null;
} = {
  unit_price_usd_snapshot: null,
  normal_price_usd_snapshot: null,
  bulk_price_usd_snapshot: null,
  bulk_price_min_quantity_snapshot: null,
  applied_price_tier: null,
  exchange_rate_snapshot: null,
  eur_value_snapshot: null,
  price_snapshot_at: null,
};

/** The frozen price structure carried by a cart line. */
export type PricedCartItem = Pick<
  Tables<"cart_items">,
  | "unit_price_usd_snapshot"
  | "normal_price_usd_snapshot"
  | "bulk_price_usd_snapshot"
  | "bulk_price_min_quantity_snapshot"
  | "exchange_rate_snapshot"
>;

export interface QuantityReprice {
  unit_price_usd_snapshot: number;
  applied_price_tier: PriceTier;
  eur_value_snapshot: number | null;
  /**
   * Only set when the effective unit price actually moved. A quantity edit
   * that stays inside the same tier must not bump the visible price date -
   * the snapshot stays untouched as long as the price it produced is
   * unchanged.
   */
  price_snapshot_at?: string;
}

/**
 * Re-selects the price tier for a new quantity using the price structure
 * already frozen on the line. Pure and offline: no catalog lookup, so a
 * quantity edit can cross a bulk threshold without ever importing a newer
 * catalog price.
 *
 * Returns null for a line that has no price at all (e.g. an unresolved code),
 * where there is nothing to reprice.
 */
export function repriceForQuantity(item: PricedCartItem, newQuantity: number): QuantityReprice | null {
  // Lines written before the bulk-price migration only have the effective
  // price; it was a normal price by definition back then.
  const normalPrice = item.normal_price_usd_snapshot ?? item.unit_price_usd_snapshot;
  if (normalPrice == null) return null;

  const effective = getEffectiveUnitPrice(
    {
      price_usd: normalPrice,
      bulk_price_usd: item.bulk_price_usd_snapshot,
      bulk_price_min_quantity: item.bulk_price_min_quantity_snapshot,
    },
    newQuantity,
  );

  const totalUsd = calculateLineTotalUsd(newQuantity, effective.unitPriceUsd);
  const eurValue = totalUsd != null ? convertUsdToEur(totalUsd, item.exchange_rate_snapshot) : null;
  const priceChanged = effective.unitPriceUsd !== item.unit_price_usd_snapshot;

  return {
    unit_price_usd_snapshot: effective.unitPriceUsd,
    applied_price_tier: effective.tier,
    eur_value_snapshot: eurValue,
    ...(priceChanged ? { price_snapshot_at: new Date().toISOString() } : {}),
  };
}

export interface PriceUpdateDiff {
  itemId: string;
  productCodeSnapshot: string | null;
  oldUnitPriceUsd: number | null;
  newUnitPriceUsd: number;
  oldPriceTier: PriceTier | null;
  newPriceTier: PriceTier;
  oldRate: number | null;
  newRate: number | null;
  oldTotalUsd: number | null;
  newTotalUsd: number | null;
  oldTotalEur: number | null;
  newTotalEur: number | null;
  diffUsd: number | null;
  diffEur: number | null;
  changed: boolean;
}

/**
 * Builds an "old value -> new value" preview row for the mandatory
 * "Preise aktualisieren" confirmation dialog. Never mutates data - pure
 * calculation only.
 *
 * The new unit price is resolved through getEffectiveUnitPrice for this
 * line's current quantity, so the preview shows the price that will really
 * be applied rather than the catalog's normal price.
 */
export function buildPriceUpdateDiff(
  item: Pick<
    Tables<"cart_items">,
    | "id"
    | "quantity"
    | "unit_price_usd_snapshot"
    | "normal_price_usd_snapshot"
    | "bulk_price_usd_snapshot"
    | "bulk_price_min_quantity_snapshot"
    | "applied_price_tier"
    | "exchange_rate_snapshot"
    | "eur_value_snapshot"
    | "product_code_snapshot"
  >,
  product: PricedProduct,
  currentRate: number | null,
): PriceUpdateDiff {
  const effective = getEffectiveUnitPrice(product, item.quantity);

  const oldTotalUsd = calculateLineTotalUsd(item.quantity, item.unit_price_usd_snapshot ?? NaN);
  const newTotalUsd = calculateLineTotalUsd(item.quantity, effective.unitPriceUsd);
  const oldTotalEur = oldTotalUsd != null ? convertUsdToEur(oldTotalUsd, item.exchange_rate_snapshot) : null;
  const newTotalEur = newTotalUsd != null ? convertUsdToEur(newTotalUsd, currentRate) : null;

  const diffUsd = oldTotalUsd != null && newTotalUsd != null ? roundCurrency(newTotalUsd - oldTotalUsd) : null;
  const diffEur = oldTotalEur != null && newTotalEur != null ? roundCurrency(newTotalEur - oldTotalEur) : null;

  // A stale *structure* counts as a change even when today's effective price
  // happens to match, because the line would otherwise reprice against an
  // outdated threshold the next time its quantity is edited.
  const changed =
    item.unit_price_usd_snapshot !== effective.unitPriceUsd ||
    item.exchange_rate_snapshot !== currentRate ||
    item.normal_price_usd_snapshot !== product.price_usd ||
    item.bulk_price_usd_snapshot !== effective.bulkPriceUsd ||
    item.bulk_price_min_quantity_snapshot !== effective.bulkPriceMinQuantity;

  return {
    itemId: item.id,
    productCodeSnapshot: item.product_code_snapshot,
    oldUnitPriceUsd: item.unit_price_usd_snapshot,
    newUnitPriceUsd: effective.unitPriceUsd,
    oldPriceTier: item.applied_price_tier,
    newPriceTier: effective.tier,
    oldRate: item.exchange_rate_snapshot,
    newRate: currentRate,
    oldTotalUsd,
    newTotalUsd,
    oldTotalEur,
    newTotalEur,
    diffUsd,
    diffEur,
    changed,
  };
}
