/**
 * Central money / currency logic. Every price calculation in the app goes
 * through these functions - never scatter `* rate` or `.toFixed(2)` calls
 * elsewhere (see docs/KONZEPT.md §6).
 *
 * Strategy: convert amounts to integer "minor units" (cents) before
 * rounding, using round-half-up, then format for display. This avoids the
 * classic floating point drift of repeated `toFixed()` calls and keeps
 * rounding behaviour consistent and testable in one place.
 */

import type { PriceTier } from "@/types/database";

export const MAX_QUANTITY = 100_000;
export const MIN_QUANTITY = 0.001;

/** Round-half-up to the given number of decimal places (never "round half to even"). */
export function roundHalfUp(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  // Adding a tiny epsilon guards against binary floating point representations
  // like 1.005 being stored as 1.00499999999999... which would otherwise round down.
  const epsilon = value >= 0 ? 1e-9 : -1e-9;
  return Math.round(value * factor + epsilon) / factor;
}

/** Round a USD or EUR amount to 2 decimal places using round-half-up. */
export function roundCurrency(value: number): number {
  return roundHalfUp(value, 2);
}

/**
 * Compute the USD line total for a quantity/unit price pair, rounded to
 * cents. Returns null if either input is not a finite, valid number (the
 * caller is responsible for surfacing a validation error - this function
 * never guesses).
 */
export function calculateLineTotalUsd(quantity: number, unitPriceUsd: number): number | null {
  if (!isFiniteNumber(quantity) || !isFiniteNumber(unitPriceUsd)) return null;
  if (quantity <= 0 || unitPriceUsd < 0) return null;
  return roundCurrency(quantity * unitPriceUsd);
}

/** The product fields that decide which unit price applies to a quantity. */
export interface PricedProduct {
  price_usd: number;
  bulk_price_usd?: number | null;
  bulk_price_min_quantity?: number | null;
}

export interface EffectiveUnitPrice {
  /** The price applied to *every* unit of this quantity. */
  unitPriceUsd: number;
  tier: PriceTier;
  /** The configured bulk tier, or null when the product has none. */
  bulkPriceUsd: number | null;
  bulkPriceMinQuantity: number | null;
}

/**
 * A bulk tier only counts when both halves are present and plausible. Half a
 * tier (a price without a threshold, or vice versa) is not interpretable, so
 * it is treated as "no bulk tier" rather than guessed at - the database
 * enforces the same pairing via products_bulk_price_pair_chk.
 */
export function hasBulkTier(product: PricedProduct): boolean {
  return (
    isFiniteNumber(product.bulk_price_usd) &&
    (product.bulk_price_usd as number) >= 0 &&
    isFiniteNumber(product.bulk_price_min_quantity) &&
    (product.bulk_price_min_quantity as number) > 0
  );
}

/**
 * THE single source of truth for "what does one unit cost at this quantity".
 * Every add, quantity edit, merge, price refresh and preview in the app goes
 * through this function - there must never be a second place that decides
 * between the normal and the bulk price.
 *
 *   quantity <  bulk_price_min_quantity -> price_usd      (tier "normal")
 *   quantity >= bulk_price_min_quantity -> bulk_price_usd (tier "bulk")
 *   no bulk tier configured             -> price_usd      (tier "normal")
 *
 * The bulk price replaces the normal price for the whole line, it is not a
 * graduated surcharge: 12 units at a bulk price of 55 cost 660, not
 * 9 * 60 + 3 * 55.
 */
export function getEffectiveUnitPrice(
  product: PricedProduct,
  quantity: number | null | undefined,
): EffectiveUnitPrice {
  const bulkAvailable = hasBulkTier(product);
  const bulkPriceUsd = bulkAvailable ? (product.bulk_price_usd as number) : null;
  const bulkPriceMinQuantity = bulkAvailable ? (product.bulk_price_min_quantity as number) : null;

  const useBulk =
    bulkAvailable && isFiniteNumber(quantity) && (quantity as number) >= (bulkPriceMinQuantity as number);

  return {
    unitPriceUsd: useBulk ? (bulkPriceUsd as number) : product.price_usd,
    tier: useBulk ? "bulk" : "normal",
    bulkPriceUsd,
    bulkPriceMinQuantity,
  };
}

/**
 * Apply a role markup to a catalog (or bulk) unit price. 4 decimal places,
 * matching public.apply_role_markup. The percent itself must never be sent
 * to a customer client - this helper exists so tests lock the formula that
 * the database uses.
 */
export function applyRoleMarkup(amount: number, markupPercent: number): number {
  if (!isFiniteNumber(amount) || !isFiniteNumber(markupPercent)) return amount;
  return roundHalfUp(amount * (1 + markupPercent / 100), 4);
}

/**
 * Catalog bulk-then-markup selling unit price. Server-side create_order
 * uses the SQL twin sell_unit_price; tests use this to lock the contract.
 */
export function sellingUnitPrice(product: PricedProduct, quantity: number, markupPercent: number): number {
  return applyRoleMarkup(getEffectiveUnitPrice(product, quantity).unitPriceUsd, markupPercent);
}

/** Split a money amount across n buckets. Remainder cents go to the last share. */
export function splitAmountEvenly(total: number, count: number): number[] {
  if (!Number.isInteger(count) || count < 1) return [];
  const cents = Math.round(roundCurrency(total) * 100);
  const base = Math.floor(cents / count);
  const rem = cents - base * count;
  return Array.from({ length: count }, (_, i) => roundCurrency((base + (i === count - 1 ? rem : 0)) / 100));
}

/**
 * Convert a USD amount to EUR using the given rate, rounded to cents.
 * Returns null (never a guessed value) if the rate is missing/invalid.
 */
export function convertUsdToEur(amountUsd: number, rate: number | null | undefined): number | null {
  if (!isFiniteNumber(amountUsd)) return null;
  if (!isFiniteNumber(rate) || (rate as number) <= 0) return null;
  return roundCurrency(amountUsd * (rate as number));
}

/** Inverse of convertUsdToEur using the stored USD→EUR rate. Never invents a rate. */
export function convertEurToUsd(amountEur: number, usdToEurRate: number | null | undefined): number | null {
  if (!isFiniteNumber(amountEur)) return null;
  if (!isFiniteNumber(usdToEurRate) || (usdToEurRate as number) <= 0) return null;
  return roundCurrency(amountEur / (usdToEurRate as number));
}

export type ChargeCurrency = "USD" | "EUR";

export const SHIPPING_LABEL_CHINA = "Versand aus China";
export const SHIPPING_LABEL_GERMANY = "Versand aus Deutschland";
export const GRAND_TOTAL_LABEL = "Gesamt Endpreis inkl. Versand";

export function formatMoney(amount: number, currency: string): string {
  return currency === "EUR" ? formatEur(amount) : formatUsd(amount);
}

export interface OrderChargesInput {
  productUsd: number;
  productEur: number | null;
  chinaAmount?: number | null;
  chinaCurrency?: string | null;
  deAmount?: number | null;
  deCurrency?: string | null;
  usdToEurRate?: number | null;
}

export interface ShippingCharge {
  amount: number;
  currency: ChargeCurrency;
}

export interface OrderCharges {
  productUsd: number;
  productEur: number | null;
  china: ShippingCharge | null;
  germany: ShippingCharge | null;
  grandUsd: number;
  grandEur: number | null;
  leftoverEur: number;
  grandDisplay: string;
}

function asChargeCurrency(value: string | null | undefined): ChargeCurrency | null {
  return value === "USD" || value === "EUR" ? value : null;
}

/**
 * Product subtotal plus the two shipping kinds. USD and EUR are never added
 * together; conversion uses only the order's stored USD→EUR rate.
 */
export function summarizeOrderCharges(input: OrderChargesInput): OrderCharges {
  let usd = roundCurrency(input.productUsd);
  let eur =
    input.productEur != null && isFiniteNumber(input.productEur) ? roundCurrency(input.productEur) : null;
  let leftoverEur = 0;
  const rate = input.usdToEurRate ?? null;

  function addSlice(amount: number | null | undefined, currencyRaw: string | null | undefined): ShippingCharge | null {
    if (!isFiniteNumber(amount) || amount < 0) return null;
    const currency = asChargeCurrency(currencyRaw);
    if (!currency) return null;
    if (amount === 0) return { amount, currency };

    if (currency === "USD") {
      usd = roundCurrency(usd + amount);
      const asEur = convertUsdToEur(amount, rate);
      if (asEur != null && eur != null) eur = roundCurrency(eur + asEur);
    } else {
      const asUsd = convertEurToUsd(amount, rate);
      if (asUsd != null) usd = roundCurrency(usd + asUsd);
      else leftoverEur = roundCurrency(leftoverEur + amount);
      if (eur != null) eur = roundCurrency(eur + amount);
    }
    return { amount, currency };
  }

  const china = addSlice(input.chinaAmount, input.chinaCurrency);
  const germany = addSlice(input.deAmount, input.deCurrency);

  let grandDisplay: string;
  if (leftoverEur > 0) {
    grandDisplay = `${formatUsd(usd)} + ${formatEur(leftoverEur)}`;
  } else if (eur != null) {
    grandDisplay = `${formatUsd(usd)} · ${formatEur(eur)}`;
  } else {
    grandDisplay = formatUsd(usd);
  }

  return {
    productUsd: roundCurrency(input.productUsd),
    productEur: input.productEur != null && isFiniteNumber(input.productEur) ? roundCurrency(input.productEur) : null,
    china,
    germany,
    grandUsd: usd,
    grandEur: eur,
    leftoverEur,
    grandDisplay,
  };
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Validates a user-entered quantity per the rules in docs/DATA_MODEL.md. */
export function isValidQuantity(value: unknown): value is number {
  return (
    isFiniteNumber(value) &&
    value >= MIN_QUANTITY &&
    value <= MAX_QUANTITY &&
    // Reject more than 3 decimal places (matches numeric(12,3) column).
    Math.round(value * 1000) === value * 1000
  );
}

const usdFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "code",
});

const eurFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const quantityFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

export function formatUsd(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return "—";
  return usdFormatter.format(value);
}

export function formatEur(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return "—";
  return eurFormatter.format(value);
}

export function formatQuantity(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return "—";
  return quantityFormatter.format(value);
}

export function formatRate(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return "—";
  return value.toFixed(6);
}

/**
 * Short label for a product's bulk tier ("ab 10: USD 55,00"), or null when
 * the product has no bulk tier. Used in the admin table and the cart to make
 * the applied price explainable without a second calculation.
 */
export function formatBulkTier(product: PricedProduct): string | null {
  if (!hasBulkTier(product)) return null;
  return `ab ${formatQuantity(product.bulk_price_min_quantity as number)}: ${formatUsd(
    product.bulk_price_usd as number,
  )}`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

/**
 * A fully computed line: total USD, total EUR (or null if no rate was
 * available), and a flag for the UI to explain why EUR is missing.
 */
export interface ComputedLine {
  totalUsd: number | null;
  totalEur: number | null;
  eurUnavailableReason: "no-rate" | "invalid-price" | null;
}

export function computeLine(
  quantity: number | null,
  unitPriceUsd: number | null,
  rate: number | null,
): ComputedLine {
  if (quantity == null || unitPriceUsd == null) {
    return { totalUsd: null, totalEur: null, eurUnavailableReason: "invalid-price" };
  }
  const totalUsd = calculateLineTotalUsd(quantity, unitPriceUsd);
  if (totalUsd == null) {
    return { totalUsd: null, totalEur: null, eurUnavailableReason: "invalid-price" };
  }
  const totalEur = convertUsdToEur(totalUsd, rate);
  return {
    totalUsd,
    totalEur,
    eurUnavailableReason: totalEur == null ? "no-rate" : null,
  };
}

export interface CartTotals {
  totalUsd: number;
  totalEur: number | null;
  itemCount: number;
  totalQuantity: number;
  unresolvedCount: number;
  missingPriceCount: number;
  hasAnyEurValue: boolean;
}

export interface CartTotalsInputLine {
  quantity: number | null;
  totalUsd: number | null;
  totalEur: number | null;
  resolutionStatus: "resolved" | "not_found" | "inactive" | "pending";
}

/**
 * Sum a cart's lines into the numbers shown in the always-visible summary
 * bar. USD total only ever includes lines with a valid computed total; EUR
 * total is null (not zero, not a guess) unless every included line has a
 * EUR value.
 */
export function calculateCartTotals(lines: CartTotalsInputLine[]): CartTotals {
  let totalUsd = 0;
  let totalEurAccumulator = 0;
  let totalQuantity = 0;
  let unresolvedCount = 0;
  let missingPriceCount = 0;
  let eurLineCount = 0;
  let usdLineCount = 0;

  for (const line of lines) {
    if (line.resolutionStatus === "not_found") unresolvedCount += 1;
    if (line.quantity != null) totalQuantity += line.quantity;

    if (line.totalUsd == null) {
      missingPriceCount += 1;
      continue;
    }
    totalUsd += line.totalUsd;
    usdLineCount += 1;

    if (line.totalEur != null) {
      totalEurAccumulator += line.totalEur;
      eurLineCount += 1;
    }
  }

  const hasAnyEurValue = eurLineCount > 0 && eurLineCount === usdLineCount;

  return {
    totalUsd: roundCurrency(totalUsd),
    totalEur: hasAnyEurValue ? roundCurrency(totalEurAccumulator) : null,
    itemCount: lines.length,
    totalQuantity: roundHalfUp(totalQuantity, 3),
    unresolvedCount,
    missingPriceCount,
    hasAnyEurValue,
  };
}

/** Normalize a product code exactly the way the database trigger does. */
export function normalizeProductCode(code: string): string {
  return code.trim().toUpperCase();
}
