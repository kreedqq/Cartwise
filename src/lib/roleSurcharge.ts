/**
 * Admin reporting of role markups that the existing pricing engine already
 * applied. This module does not compute a markup percent and must never
 * hardcode 25% (or any other rate).
 *
 * Source of truth per line:
 *   catalog unit  = existing sell_unit_price(..., 0%) / kit catalog unit
 *                   (quantity tier first, no role markup)
 *   selling unit  = stored order_items.unit_price_usd_snapshot
 *   surcharge USD = selling line total − catalog line total
 *
 * Historical orders without a surcharge snapshot are omitted, never
 * recomputed from the customer's current role.
 */

import { calculateLineTotalUsd, convertUsdToEur, roundCurrency } from "@/lib/money";

export interface RoleSurchargeSnapshotLine {
  order_id: string;
  order_item_id: string;
  catalog_unit_price_usd: number;
  selling_unit_price_usd: number;
  quantity: number;
  base_line_usd: number;
  selling_line_usd: number;
  surcharge_usd: number;
  customer_role_name_snapshot: string | null;
}

export interface RoleSurchargeOrderRef {
  id: string;
  status: string;
  exchange_rate: number | null;
  total_usd: number;
}

export interface LineRoleSurcharge {
  catalogUnitPriceUsd: number;
  sellingUnitPriceUsd: number;
  quantity: number;
  baseLineUsd: number;
  sellingLineUsd: number;
  surchargeUsd: number;
}

export interface RoleSurchargeBucket {
  roleName: string;
  surchargeUsd: number;
  surchargeEur: number | null;
  lineCount: number;
  orderCount: number;
}

export interface RoleSurchargeReport {
  totalSurchargeUsd: number;
  totalSurchargeEur: number | null;
  eurComplete: boolean;
  byRole: RoleSurchargeBucket[];
  includedOrderCount: number;
  includedLineCount: number;
  skippedUnauditableOrderCount: number;
  skippedCancelledOrderCount: number;
}

/**
 * Derive one line's surcharge from frozen snapshots. Selling line total is
 * authoritative; catalog unit is the pre-markup unit already chosen by the
 * pricing engine (tier first). Never accepts a markup percent.
 */
export function lineRoleSurchargeFromSnapshots(input: {
  catalogUnitPriceUsd: number;
  sellingUnitPriceUsd: number;
  quantity: number;
  sellingLineUsd: number;
}): LineRoleSurcharge | null {
  const baseLineUsd = calculateLineTotalUsd(input.quantity, input.catalogUnitPriceUsd);
  if (baseLineUsd == null) return null;
  const sellingLineUsd = roundCurrency(input.sellingLineUsd);
  return {
    catalogUnitPriceUsd: input.catalogUnitPriceUsd,
    sellingUnitPriceUsd: input.sellingUnitPriceUsd,
    quantity: input.quantity,
    baseLineUsd,
    sellingLineUsd,
    surchargeUsd: roundCurrency(sellingLineUsd - baseLineUsd),
  };
}

export function orderRoleSurchargeFromSnapshots(
  lines: Array<Pick<RoleSurchargeSnapshotLine, "base_line_usd" | "surcharge_usd" | "selling_line_usd">>,
): { catalogSubtotalUsd: number; surchargeUsd: number; sellingSubtotalUsd: number } | null {
  if (lines.length === 0) return null;
  const catalogSubtotalUsd = roundCurrency(lines.reduce((sum, line) => sum + line.base_line_usd, 0));
  const surchargeUsd = roundCurrency(lines.reduce((sum, line) => sum + line.surcharge_usd, 0));
  const sellingSubtotalUsd = roundCurrency(lines.reduce((sum, line) => sum + line.selling_line_usd, 0));
  return { catalogSubtotalUsd, surchargeUsd, sellingSubtotalUsd };
}

function roleLabel(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed : "Ohne Rollen-Snapshot";
}

/**
 * Aggregate frozen surcharge snapshots. Current customer_roles /
 * user_customer_roles are intentionally not parameters.
 */
export function summarizeRoleSurcharges(
  lines: RoleSurchargeSnapshotLine[],
  orders: RoleSurchargeOrderRef[],
  allOrderIds: string[],
): RoleSurchargeReport {
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const linesByOrder = new Map<string, RoleSurchargeSnapshotLine[]>();
  for (const line of lines) {
    const list = linesByOrder.get(line.order_id) ?? [];
    list.push(line);
    linesByOrder.set(line.order_id, list);
  }

  const uniqueAllOrders = [...new Set(allOrderIds)];
  let skippedUnauditableOrderCount = 0;
  let skippedCancelledOrderCount = 0;

  const includedLines: Array<{ line: RoleSurchargeSnapshotLine; rate: number | null }> = [];
  const includedOrderIds = new Set<string>();

  for (const orderId of uniqueAllOrders) {
    const order = orderById.get(orderId);
    const orderLines = linesByOrder.get(orderId) ?? [];
    if (orderLines.length === 0) {
      skippedUnauditableOrderCount += 1;
      continue;
    }
    if (order?.status === "cancelled") {
      skippedCancelledOrderCount += 1;
      continue;
    }
    includedOrderIds.add(orderId);
    for (const line of orderLines) {
      includedLines.push({ line, rate: order?.exchange_rate ?? null });
    }
  }

  const byRoleMap = new Map<string, { surchargeUsd: number; surchargeEur: number; eurMissing: boolean; lineCount: number; orders: Set<string> }>();
  let totalSurchargeUsd = 0;
  let totalSurchargeEur = 0;
  let eurComplete = includedLines.length > 0;

  for (const { line, rate } of includedLines) {
    totalSurchargeUsd += line.surcharge_usd;
    const eur = convertUsdToEur(line.surcharge_usd, rate);
    if (eur == null) {
      eurComplete = false;
    } else {
      totalSurchargeEur += eur;
    }

    const name = roleLabel(line.customer_role_name_snapshot);
    const bucket = byRoleMap.get(name) ?? {
      surchargeUsd: 0,
      surchargeEur: 0,
      eurMissing: false,
      lineCount: 0,
      orders: new Set<string>(),
    };
    bucket.surchargeUsd += line.surcharge_usd;
    bucket.lineCount += 1;
    bucket.orders.add(line.order_id);
    if (eur == null) bucket.eurMissing = true;
    else bucket.surchargeEur += eur;
    byRoleMap.set(name, bucket);
  }

  const byRole: RoleSurchargeBucket[] = [...byRoleMap.entries()]
    .map(([roleName, bucket]) => ({
      roleName,
      surchargeUsd: roundCurrency(bucket.surchargeUsd),
      surchargeEur: bucket.eurMissing ? null : roundCurrency(bucket.surchargeEur),
      lineCount: bucket.lineCount,
      orderCount: bucket.orders.size,
    }))
    .sort((a, b) => a.roleName.localeCompare(b.roleName, "de"));

  return {
    totalSurchargeUsd: roundCurrency(totalSurchargeUsd),
    totalSurchargeEur: includedLines.length === 0 || !eurComplete ? null : roundCurrency(totalSurchargeEur),
    eurComplete: includedLines.length > 0 && eurComplete,
    byRole,
    includedOrderCount: includedOrderIds.size,
    includedLineCount: includedLines.length,
    skippedUnauditableOrderCount,
    skippedCancelledOrderCount,
  };
}

export function buildRoleSurchargeCsv(report: RoleSurchargeReport): string {
  const header = ["Rolle", "Aufschlag USD", "Aufschlag EUR", "Bestellungen", "Positionen"];
  const rows = report.byRole.map((bucket) =>
    [bucket.roleName, bucket.surchargeUsd, bucket.surchargeEur ?? "", bucket.orderCount, bucket.lineCount].join(";"),
  );
  rows.push(["Gesamt", report.totalSurchargeUsd, report.totalSurchargeEur ?? "", report.includedOrderCount, report.includedLineCount].join(";"));
  return [header.join(";"), ...rows].join("\n");
}
