import { formatUsd, roundCurrency } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/services/orders";
import type { OrderStatus } from "@/types/database";

export const UNGROUPED_ORDER_GROUP_NAME = "Nicht gruppiert";

export interface OrderGroupStatusSummary {
  label: string;
  completed: number;
  total: number;
}

export function membershipByOrderId(
  rows: Array<{ order_id: string; group_id: string }>,
): Map<string, string> {
  return new Map(rows.map((row) => [row.order_id, row.group_id]));
}

export function orderIdsForGroup(
  rows: Array<{ order_id: string; group_id: string }>,
  groupId: string,
): string[] {
  return rows.filter((row) => row.group_id === groupId).map((row) => row.order_id);
}

export function ungroupedOrders<T extends { id: string }>(
  orders: T[],
  membership: Map<string, string>,
): T[] {
  return orders.filter((order) => !membership.has(order.id));
}

export function groupNameForOrder(
  orderId: string,
  membership: Map<string, string>,
  groups: Array<{ id: string; name: string }>,
): string {
  const groupId = membership.get(orderId);
  if (!groupId) return UNGROUPED_ORDER_GROUP_NAME;
  return groups.find((group) => group.id === groupId)?.name ?? UNGROUPED_ORDER_GROUP_NAME;
}

export function summarizeOrderGroupStatus(
  orders: Array<{ status: string }>,
): OrderGroupStatusSummary {
  const total = orders.length;
  const byStatus = new Map<string, number>();
  for (const order of orders) {
    byStatus.set(order.status, (byStatus.get(order.status) ?? 0) + 1);
  }
  const completed = (byStatus.get("completed") ?? 0) + (byStatus.get("confirmed") ?? 0);
  const parts = [...byStatus.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "de"))
    .map(([status, count]) => {
      const label = ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
      return `${count} ${label}`;
    });
  return {
    total,
    completed,
    label: total === 0 ? "Keine Bestellungen" : parts.join(" · "),
  };
}

export function summarizeOrderGroupMoney(
  orders: Array<{ total_usd: number }>,
): { totalUsd: number; grandDisplay: string } {
  const totalUsd = roundCurrency(orders.reduce((sum, order) => sum + order.total_usd, 0));
  return {
    totalUsd,
    grandDisplay: formatUsd(totalUsd),
  };
}

export function countOrderItems(
  items: Array<{ order_id: string }>,
  orderIds: ReadonlySet<string>,
): number {
  return items.filter((item) => orderIds.has(item.order_id)).length;
}
