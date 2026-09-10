import * as React from "react";
import { FileDown } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { OrderGroupFold } from "@/components/admin/OrderGroupFold";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrderGroupMemberships, useOrderGroups } from "@/hooks/useOrderGroups";
import { QUERY_KEYS } from "@/lib/constants";
import { useQuery } from "@tanstack/react-query";
import { formatEur, formatUsd } from "@/lib/money";
import { orderIdsForGroup, ungroupedOrders, UNGROUPED_ORDER_GROUP_NAME } from "@/lib/orderGroups";
import {
  buildOrderGroupSurchargeCsv,
  collectOrderGroupSurchargeCsvRows,
  listOrderRoleSurchargeDetails,
  summarizeRoleSurcharges,
  type RoleSurchargeReport,
} from "@/lib/roleSurcharge";
import { downloadCsv } from "@/services/csvProducts";
import { listAllOrders, formatOrderTelegramSnapshot } from "@/services/orders";
import { listRoleSurchargeLines } from "@/services/roleSurcharge";

function RoleSurchargeBlock({
  report,
  details,
  ordersById,
}: {
  report: RoleSurchargeReport;
  details: ReturnType<typeof listOrderRoleSurchargeDetails>;
  ordersById: Map<string, { order_number: string; telegram_username_snapshot: string | null }>;
}) {
  const detailsByRole = React.useMemo(() => {
    const map = new Map<string, typeof details>();
    for (const detail of details) {
      const list = map.get(detail.roleName) ?? [];
      list.push(detail);
      map.set(detail.roleName, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "de"));
  }, [details]);

  return (
    <div className="min-w-0 space-y-4">
      <p className="text-sm">
        Gesamter Aufschlag: <span className="font-semibold tabular-nums">{formatUsd(report.totalSurchargeUsd)}</span>
      </p>

      {report.byRole.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine auswertbaren Aufschlags-Snapshots in dieser Gruppe.</p>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Rolle</TableHead>
                  <TableHead className="pr-4 text-right">Aufschlag USD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byRole.map((bucket) => (
                  <TableRow key={bucket.roleName}>
                    <TableCell className="pl-4 font-medium">{bucket.roleName}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{formatUsd(bucket.surchargeUsd)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="pl-4 font-semibold">Gesamt</TableCell>
                  <TableCell className="pr-4 text-right font-semibold tabular-nums">
                    {formatUsd(report.totalSurchargeUsd)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="space-y-2 md:hidden">
            {report.byRole.map((bucket) => (
              <div key={bucket.roleName} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <span className="text-sm font-medium">{bucket.roleName}</span>
                <span className="tabular-nums text-sm">{formatUsd(bucket.surchargeUsd)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 px-1 text-sm font-semibold">
              <span>Gesamt</span>
              <span className="tabular-nums">{formatUsd(report.totalSurchargeUsd)}</span>
            </div>
          </div>
        </>
      )}

      {detailsByRole.map(([roleName, rows]) => (
        <div key={roleName} className="min-w-0">
          <p className="mb-1 text-sm font-medium">{roleName}</p>
          <ul className="space-y-1 text-sm">
            {rows.map((row) => {
              const order = ordersById.get(row.orderId);
              return (
                <li key={`${row.orderId}-${roleName}`} className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                  <span className="min-w-0 font-mono text-xs">
                    {order?.order_number ?? row.orderId}
                    <span className="ml-2 font-sans text-muted-foreground">
                      {order ? formatOrderTelegramSnapshot(order) : ""}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatUsd(row.surchargeUsd)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function AdminRoleSurchargesPage() {
  const ordersQuery = useQuery({ queryKey: QUERY_KEYS.adminOrders, queryFn: listAllOrders });
  const linesQuery = useQuery({ queryKey: QUERY_KEYS.adminRoleSurcharges, queryFn: listRoleSurchargeLines });
  const groupsQuery = useOrderGroups();
  const membershipQuery = useOrderGroupMemberships();

  const isLoading = ordersQuery.isLoading || linesQuery.isLoading || groupsQuery.isLoading || membershipQuery.isLoading;
  const isError = ordersQuery.isError || linesQuery.isError || groupsQuery.isError || membershipQuery.isError;

  const ordersById = React.useMemo(
    () => new Map((ordersQuery.data ?? []).map((order) => [order.id, order])),
    [ordersQuery.data],
  );

  const grouped = React.useMemo(() => {
    const groups = groupsQuery.data ?? [];
    const memberships = membershipQuery.data ?? [];
    const lines = linesQuery.data ?? [];
    return groups.map((group) => {
      const memberIds = orderIdsForGroup(memberships, group.id);
      const memberOrders = memberIds
        .map((id) => ordersById.get(id))
        .filter((order): order is NonNullable<typeof order> => Boolean(order));
      return {
        group,
        report: summarizeRoleSurcharges(lines, memberOrders, memberIds),
        details: listOrderRoleSurchargeDetails(lines, memberOrders, memberIds),
      };
    });
  }, [groupsQuery.data, membershipQuery.data, linesQuery.data, ordersById]);

  const ungrouped = React.useMemo(() => {
    const orders = ordersQuery.data ?? [];
    const memberships = membershipQuery.data ?? [];
    const lines = linesQuery.data ?? [];
    const membership = new Map(memberships.map((row) => [row.order_id, row.group_id]));
    const leftover = ungroupedOrders(orders, membership);
    const leftoverIds = leftover.map((order) => order.id);
    return {
      orders: leftover,
      report: summarizeRoleSurcharges(lines, leftover, leftoverIds),
      details: listOrderRoleSurchargeDetails(lines, leftover, leftoverIds),
    };
  }, [ordersQuery.data, membershipQuery.data, linesQuery.data]);

  const globalReport = React.useMemo(() => {
    if (isLoading || isError) return null;
    const orders = ordersQuery.data ?? [];
    const lines = linesQuery.data ?? [];
    return summarizeRoleSurcharges(lines, orders, orders.map((order) => order.id));
  }, [isLoading, isError, ordersQuery.data, linesQuery.data]);

  function handleExport() {
    const csv = buildOrderGroupSurchargeCsv(
      collectOrderGroupSurchargeCsvRows({
        groups: groupsQuery.data ?? [],
        memberships: membershipQuery.data ?? [],
        orders: ordersQuery.data ?? [],
        lines: linesQuery.data ?? [],
      }),
    );
    downloadCsv("rollenaufschlaege.csv", csv);
  }

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      <AdminPageHeader
        title="Rollenaufschläge"
        description="Tatsächliche Aufschläge aus Bestell-Snapshots, gruppiert nach Bestellgruppe. Keine Neuberechnung über die heutige Kundenrolle."
        actions={
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!globalReport}>
            <FileDown className="h-3.5 w-3.5" /> CSV
          </Button>
        }
      />

      {isError ? (
        <ErrorState
          message="Aufschläge konnten nicht geladen werden."
          onRetry={() => {
            void ordersQuery.refetch();
            void linesQuery.refetch();
            void groupsQuery.refetch();
            void membershipQuery.refetch();
          }}
        />
      ) : isLoading || !globalReport ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-[11px] font-medium text-muted-foreground">Gesamte Rollenaufschläge USD</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{formatUsd(globalReport.totalSurchargeUsd)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-[11px] font-medium text-muted-foreground">Gesamte Rollenaufschläge EUR</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {globalReport.totalSurchargeEur != null ? formatEur(globalReport.totalSurchargeEur) : "—"}
              </p>
              {!globalReport.eurComplete && globalReport.includedLineCount > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">EUR nur bei Bestellungen mit gespeichertem Wechselkurs.</p>
              )}
            </div>
          </div>

          <AdminSection title="Bestellgruppen">
            {grouped.map(({ group, report, details }) => (
              <OrderGroupFold
                key={group.id}
                title={group.name}
                subtitle={`Gesamter Aufschlag: ${formatUsd(report.totalSurchargeUsd)}`}
              >
                <RoleSurchargeBlock report={report} details={details} ordersById={ordersById} />
              </OrderGroupFold>
            ))}
            <OrderGroupFold
              title={UNGROUPED_ORDER_GROUP_NAME}
              subtitle={`Gesamter Aufschlag: ${formatUsd(ungrouped.report.totalSurchargeUsd)}`}
            >
              <RoleSurchargeBlock report={ungrouped.report} details={ungrouped.details} ordersById={ordersById} />
            </OrderGroupFold>
          </AdminSection>

          {(globalReport.skippedUnauditableOrderCount > 0 || globalReport.skippedCancelledOrderCount > 0) && (
            <p className="text-xs text-muted-foreground">
              {globalReport.skippedUnauditableOrderCount > 0
                ? `${globalReport.skippedUnauditableOrderCount} Bestellung(en) ohne Aufschlags-Snapshot (nicht geschätzt). `
                : ""}
              {globalReport.skippedCancelledOrderCount > 0
                ? `${globalReport.skippedCancelledOrderCount} stornierte Bestellung(en) ausgenommen.`
                : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}
