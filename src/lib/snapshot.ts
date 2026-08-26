import { calculateLineTotalUsd, convertUsdToEur, roundCurrency } from "@/lib/money";
import type { Tables } from "@/types/database";

/**
 * Fields captured on a cart_item at the moment a price is taken from the
 * product catalog (see docs/KONZEPT.md §5 "Preis-Snapshot-Strategie").
 */
export interface PriceSnapshot {
  productCodeSnapshot: string;
  productNameSnapshot: string;
  unitPriceUsdSnapshot: number;
  exchangeRateSnapshot: number | null;
  eurValueSnapshot: number | null;
  priceSnapshotAt: string;
}

export function buildSnapshot(
  product: Pick<Tables<"products">, "code" | "name" | "price_usd">,
  quantity: number,
  rate: number | null,
): PriceSnapshot {
  const totalUsd = calculateLineTotalUsd(quantity, product.price_usd) ?? 0;
  const eurValue = convertUsdToEur(totalUsd, rate);
  return {
    productCodeSnapshot: product.code,
    productNameSnapshot: product.name,
    unitPriceUsdSnapshot: product.price_usd,
    exchangeRateSnapshot: rate,
    eurValueSnapshot: eurValue,
    priceSnapshotAt: new Date().toISOString(),
  };
}

export interface PriceUpdateDiff {
  itemId: string;
  productCodeSnapshot: string | null;
  oldUnitPriceUsd: number | null;
  newUnitPriceUsd: number;
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
 */
export function buildPriceUpdateDiff(
  item: Pick<
    Tables<"cart_items">,
    "id" | "quantity" | "unit_price_usd_snapshot" | "exchange_rate_snapshot" | "eur_value_snapshot" | "product_code_snapshot"
  >,
  currentPriceUsd: number,
  currentRate: number | null,
): PriceUpdateDiff {
  const oldTotalUsd = calculateLineTotalUsd(item.quantity, item.unit_price_usd_snapshot ?? NaN);
  const newTotalUsd = calculateLineTotalUsd(item.quantity, currentPriceUsd);
  const oldTotalEur = oldTotalUsd != null ? convertUsdToEur(oldTotalUsd, item.exchange_rate_snapshot) : null;
  const newTotalEur = newTotalUsd != null ? convertUsdToEur(newTotalUsd, currentRate) : null;

  const diffUsd =
    oldTotalUsd != null && newTotalUsd != null ? roundCurrency(newTotalUsd - oldTotalUsd) : null;
  const diffEur =
    oldTotalEur != null && newTotalEur != null ? roundCurrency(newTotalEur - oldTotalEur) : null;

  const changed =
    item.unit_price_usd_snapshot !== currentPriceUsd ||
    item.exchange_rate_snapshot !== currentRate;

  return {
    itemId: item.id,
    productCodeSnapshot: item.product_code_snapshot,
    oldUnitPriceUsd: item.unit_price_usd_snapshot,
    newUnitPriceUsd: currentPriceUsd,
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
