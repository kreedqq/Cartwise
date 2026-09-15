/**
 * Pure read-only helpers for admin order vs cart reconciliation.
 * Does not mutate data or recompute prices from live catalog.
 */

export type OrderIntegrityCategory =
  | "pass"
  | "expected_remaining_cart"
  | "split_order"
  | "missing_order_item"
  | "missing_cart_line"
  | "unknown";

export type OrderIntegrityCartLine = {
  productCode: string;
  quantity: number;
  kitShareId: string | null;
  submittedOrderId: string | null;
  kitStatus: string | null;
  kitAllocated: number | null;
  kitSizeVials: number | null;
  eurValue: number | null;
};

export type OrderIntegrityOrderLine = {
  productCode: string;
  quantity: number;
  lineTotalUsd: number;
  kitShareIdSnapshot: string | null;
};

export type OrderIntegritySummary = {
  category: OrderIntegrityCategory;
  orderLineCount: number;
  cartLinesLinkedToOrder: number;
  cartLinesRemaining: number;
  remainingKitLines: number;
  remainingIncompleteKitLines: number;
  hint: string | null;
};

function isKitCheckoutReady(line: OrderIntegrityCartLine): boolean {
  if (!line.kitShareId) return true;
  if (line.kitStatus !== "full" && line.kitStatus !== "ordered") return false;
  if (line.kitAllocated == null || line.kitSizeVials == null) return false;
  return line.kitAllocated === line.kitSizeVials;
}

export function summarizeOrderIntegrity(input: {
  orderId: string;
  orderLines: OrderIntegrityOrderLine[];
  cartLines: OrderIntegrityCartLine[];
}): OrderIntegritySummary {
  const { orderId, orderLines, cartLines } = input;
  const linked = cartLines.filter((l) => l.submittedOrderId === orderId);
  const remaining = cartLines.filter((l) => !l.submittedOrderId);
  const remainingKit = remaining.filter((l) => l.kitShareId);
  const remainingIncompleteKit = remainingKit.filter((l) => !isKitCheckoutReady(l));

  if (orderLines.length === 0) {
    return {
      category: "unknown",
      orderLineCount: 0,
      cartLinesLinkedToOrder: linked.length,
      cartLinesRemaining: remaining.length,
      remainingKitLines: remainingKit.length,
      remainingIncompleteKitLines: remainingIncompleteKit.length,
      hint: "Order ohne Positionen.",
    };
  }

  if (linked.length === 0 && orderLines.length > 0) {
    return {
      category: "unknown",
      orderLineCount: orderLines.length,
      cartLinesLinkedToOrder: 0,
      cartLinesRemaining: remaining.length,
      remainingKitLines: remainingKit.length,
      remainingIncompleteKitLines: remainingIncompleteKit.length,
      hint: "Keine Cart-Zeilen mit submitted_order_id — oft VALID_LEGACY_STATE (Pre-Linking); manuell prüfen.",
    };
  }

  if (remainingIncompleteKit.length > 0 && remainingKit.length === remaining.length) {
    return {
      category: "expected_remaining_cart",
      orderLineCount: orderLines.length,
      cartLinesLinkedToOrder: linked.length,
      cartLinesRemaining: remaining.length,
      remainingKitLines: remainingKit.length,
      remainingIncompleteKitLines: remainingIncompleteKit.length,
      hint: "Unvollständige Kit-Anteile wurden beim Checkout übersprungen (0088) und liegen noch im Warenkorb.",
    };
  }

  if (remaining.length > 0) {
    return {
      category: "expected_remaining_cart",
      orderLineCount: orderLines.length,
      cartLinesLinkedToOrder: linked.length,
      cartLinesRemaining: remaining.length,
      remainingKitLines: remainingKit.length,
      remainingIncompleteKitLines: remainingIncompleteKit.length,
      hint: "Nicht bestellbare oder bewusst übrige Cart-Zeilen nach Checkout.",
    };
  }

  return {
    category: "pass",
    orderLineCount: orderLines.length,
    cartLinesLinkedToOrder: linked.length,
    cartLinesRemaining: 0,
    remainingKitLines: 0,
    remainingIncompleteKitLines: 0,
    hint: null,
  };
}
