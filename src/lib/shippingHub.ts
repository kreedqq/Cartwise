import type { OrderStatus } from "@/types/database";

import { hasTrackingNumber } from "@/lib/tracking";

export type ShippingStatKey = "pending" | "processing" | "ready" | "shipped" | "cancelled";
export type ShippingListFilter = "all" | ShippingStatKey;
export type TrackingListFilter = "all" | "with" | "without";

export const SHIPPING_STAT_CARDS: readonly {
  key: ShippingStatKey;
  label: string;
  description: string;
}[] = [
  { key: "pending", label: "Offene Bestellungen", description: "Noch nicht in Bearbeitung" },
  { key: "processing", label: "In Bearbeitung", description: "Aktive Verarbeitung" },
  { key: "ready", label: "Versandbereit", description: "Abgesendet oder empfangen" },
  { key: "shipped", label: "Versendet", description: "Unterwegs zum Kunden" },
  { key: "cancelled", label: "Storniert", description: "Historisch erhalten" },
];

export function formatShippingListDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function isActiveShippingStatus(status: OrderStatus): boolean {
  return status !== "cancelled";
}

export function shippingStatKeyForStatus(status: OrderStatus): ShippingStatKey | null {
  switch (status) {
    case "pending":
      return "pending";
    case "processing":
      return "processing";
    case "dispatched":
    case "received":
      return "ready";
    case "shipped":
      return "shipped";
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
}

export function countShippingStats(orders: { status: OrderStatus }[]): Record<ShippingStatKey, number> {
  const counts: Record<ShippingStatKey, number> = {
    pending: 0,
    processing: 0,
    ready: 0,
    shipped: 0,
    cancelled: 0,
  };
  for (const order of orders) {
    const key = shippingStatKeyForStatus(order.status);
    if (key) counts[key] += 1;
  }
  return counts;
}

export function orderMatchesShippingStat(status: OrderStatus, filter: ShippingListFilter): boolean {
  if (filter === "all") return true;
  return shippingStatKeyForStatus(status) === filter;
}

export function orderMatchesTrackingFilter(
  order: { tracking_number?: string | null },
  filter: TrackingListFilter,
): boolean {
  if (filter === "all") return true;
  const has = hasTrackingNumber(order);
  return filter === "with" ? has : !has;
}

export function orderMatchesShippingSearch(
  order: { order_number: string; telegram_username_snapshot?: string | null },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const telegram = order.telegram_username_snapshot?.toLowerCase() ?? "";
  return order.order_number.toLowerCase().includes(needle) || telegram.includes(needle);
}

export function filterShippingHubOrders<
  T extends {
    status: OrderStatus;
    order_number: string;
    telegram_username_snapshot?: string | null;
    tracking_number?: string | null;
  },
>(
  orders: T[],
  input: {
    status: ShippingListFilter;
    tracking: TrackingListFilter;
    search: string;
  },
): T[] {
  return orders.filter(
    (order) =>
      orderMatchesShippingStat(order.status, input.status) &&
      orderMatchesTrackingFilter(order, input.tracking) &&
      orderMatchesShippingSearch(order, input.search),
  );
}
