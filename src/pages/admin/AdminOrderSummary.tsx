import * as React from "react";
import { FileDown } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { OrderGroupFold } from "@/components/admin/OrderGroupFold";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminKitOrderContext, useAdminOrderItems, useAdminOrders } from "@/hooks/useAdminOrders";
import { useOrderGroupMemberships, useOrderGroups } from "@/hooks/useOrderGroups";
import { QUERY_KEYS } from "@/lib/constants";
import { useQuery } from "@tanstack/react-query";
import { formatDateTime, formatQuantity, formatUsd } from "@/lib/money";
import { countOrderItems, orderIdsForGroup, ungroupedOrders, UNGROUPED_ORDER_GROUP_NAME } from "@/lib/orderGroups";
import { downloadProcessingOrderSummaryPdf } from "@/lib/orderSummaryExport";
import { buildProcessingOrderSummary, type ProcessingOrderSummary } from "@/lib/orderSummary";
import { listAllProducts } from "@/services/products";

function safePdfFilename(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*]+/g, "-").trim() || "Gruppe";
  return `Bestell-Zusammenfassung-${cleaned.slice(0, 80)}.pdf`;
}

function OrderSummaryTables({ summary }: { summary: ProcessingOrderSummary }) {
  if (summary.orderCount === 0) {
    return <p className="text-sm text-muted-foreground">Keine Bestellungen in dieser Gruppe.</p>;
  }

  return (
    <div className="min-w-0 space-y-4">
      {summary.groups.map((group) => (
        <div key={group.categoryId} className="min-w-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Code</TableHead>
                  <TableHead>Artikel</TableHead>
                  <TableHead className="text-right">Menge</TableHead>
                  <TableHead className="pr-4 text-right">Gesamtpreis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.lines.map((line) => (
                  <TableRow key={`${group.categoryId}-${line.kitShareId ?? line.code}-${line.name}-${line.quantityLabel}`}>
                    <TableCell className="pl-4 font-mono text-xs">{line.code}</TableCell>
                    <TableCell className="text-sm">{line.name}</TableCell>
                    <TableCell className="tabular-nums text-right">{line.quantityLabel}</TableCell>
                    <TableCell className="pr-4 tabular-nums text-right">{formatUsd(line.totalUsd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-2 md:hidden">
            {group.lines.map((line) => (
              <div
                key={`m-${group.categoryId}-${line.kitShareId ?? line.code}-${line.name}-${line.quantityLabel}`}
                className="rounded-lg border border-border p-3"
              >
                <p className="text-sm font-medium">{line.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {line.quantityLabel} · {line.code} · {formatUsd(line.totalUsd)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {summary.personLines.length > 0 && (
        <div className="min-w-0">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Händlerzusammenfassung</p>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Wer hat was bestellt und in welcher Menge
          </p>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead>Menge</TableHead>
                  <TableHead>Dosis</TableHead>
                  <TableHead className="pr-4">Artikel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.personLines.map((line, index) => (
                  <TableRow key={`${line.name}-${line.code}-${line.dose}-${line.kitShareId ?? index}`}>
                    <TableCell className="pl-4 text-sm font-medium">{line.name}</TableCell>
                    <TableCell className="tabular-nums">{line.quantityLabel}</TableCell>
                    <TableCell className="text-sm">{line.dose}</TableCell>
                    <TableCell className="pr-4 text-sm">{line.article}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-2 md:hidden">
            {summary.personLines.map((line, index) => (
              <div key={`m-${line.name}-${line.code}-${line.dose}-${line.kitShareId ?? index}`} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">{line.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {line.quantityLabel} · {line.dose} · {line.article}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminOrderSummaryPage() {
  const ordersQuery = useAdminOrders();
  const itemsQuery = useAdminOrderItems();
  const kitQuery = useAdminKitOrderContext();
  const groupsQuery = useOrderGroups();
  const membershipQuery = useOrderGroupMemberships();
  const productsQuery = useQuery({
    queryKey: QUERY_KEYS.products,
    queryFn: () => listAllProducts(),
  });

  const groupedSummaries = React.useMemo(() => {
    const orders = ordersQuery.data ?? [];
    const items = itemsQuery.data ?? [];
    const products = productsQuery.data ?? [];
    const kitContext = kitQuery.data;
    const groups = groupsQuery.data ?? [];
    const memberships = membershipQuery.data ?? [];
    return groups.map((group) => {
      const memberIds = orderIdsForGroup(memberships, group.id);
      const memberSet = new Set(memberIds);
      return {
        group,
        memberCount: memberIds.length,
        itemCount: countOrderItems(items, memberSet),
        summary: buildProcessingOrderSummary(orders, items, products, kitContext, memberSet),
      };
    });
  }, [groupsQuery.data, membershipQuery.data, itemsQuery.data, ordersQuery.data, productsQuery.data, kitQuery.data]);

  const ungrouped = React.useMemo(() => {
    const orders = ordersQuery.data ?? [];
    const items = itemsQuery.data ?? [];
    const products = productsQuery.data ?? [];
    const kitContext = kitQuery.data;
    const memberships = membershipQuery.data ?? [];
    const membership = new Map(memberships.map((row) => [row.order_id, row.group_id]));
    const leftover = ungroupedOrders(orders, membership);
    const leftoverIds = new Set(leftover.map((order) => order.id));
    return {
      orders: leftover,
      itemCount: countOrderItems(items, leftoverIds),
      summary: leftoverIds.size
        ? buildProcessingOrderSummary(orders, items, products, kitContext, leftoverIds)
        : null,
    };
  }, [ordersQuery.data, itemsQuery.data, productsQuery.data, kitQuery.data, membershipQuery.data]);

  const loading =
    ordersQuery.isLoading || itemsQuery.isLoading || kitQuery.isLoading || groupsQuery.isLoading || membershipQuery.isLoading;
  const errored =
    ordersQuery.isError || itemsQuery.isError || kitQuery.isError || groupsQuery.isError || membershipQuery.isError;
  const hasAny = groupedSummaries.length > 0 || ungrouped.orders.length > 0;

  function exportSummary(summary: ProcessingOrderSummary, name: string) {
    if (summary.orderCount === 0) return;
    downloadProcessingOrderSummaryPdf(summary, formatDateTime(new Date().toISOString()), safePdfFilename(name));
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <AdminPageHeader
        title="Bestell Zusammenfassung"
        description="Persistente Bestellgruppen. Mengen kommen aus allen zugeordneten Bestellungen, unabhängig vom Status."
      />

      {loading && <Skeleton className="h-64 w-full" />}
      {errored && (
        <ErrorState
          message="Die Bestellzusammenfassung konnte nicht geladen werden."
          onRetry={() => {
            void ordersQuery.refetch();
            void itemsQuery.refetch();
            void kitQuery.refetch();
            void groupsQuery.refetch();
            void membershipQuery.refetch();
          }}
        />
      )}
      {!loading && !errored && !hasAny && (
        <EmptyState
          title="Keine Bestellungen"
          description="Sobald Bestellungen eingehen, erscheinen sie hier — gruppiert oder unter Nicht gruppiert."
        />
      )}

      {!loading && !errored && hasAny && (
        <AdminSection title="Bestellgruppen">
          {groupedSummaries.map(({ group, memberCount, itemCount, summary }) => (
            <OrderGroupFold
              key={group.id}
              title={group.name}
              subtitle={
                <>
                  {memberCount} {memberCount === 1 ? "Bestellung" : "Bestellungen"}
                  {" · "}
                  {itemCount} {itemCount === 1 ? "Position" : "Positionen"}
                  {" · "}
                  Gesamtmenge {formatQuantity(summary.totalQuantity)}
                </>
              }
            >
              <div className="mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportSummary(summary, group.name)}
                  disabled={summary.orderCount === 0}
                >
                  <FileDown /> Als PDF exportieren
                </Button>
              </div>
              <OrderSummaryTables summary={summary} />
            </OrderGroupFold>
          ))}

          {ungrouped.summary && (
            <OrderGroupFold
              title={UNGROUPED_ORDER_GROUP_NAME}
              subtitle={
                <>
                  {ungrouped.orders.length} {ungrouped.orders.length === 1 ? "Bestellung" : "Bestellungen"}
                  {" · "}
                  {ungrouped.itemCount} {ungrouped.itemCount === 1 ? "Position" : "Positionen"}
                </>
              }
            >
              <div className="mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportSummary(ungrouped.summary!, UNGROUPED_ORDER_GROUP_NAME)}
                  disabled={ungrouped.summary.orderCount === 0}
                >
                  <FileDown /> Als PDF exportieren
                </Button>
              </div>
              <OrderSummaryTables summary={ungrouped.summary} />
            </OrderGroupFold>
          )}
        </AdminSection>
      )}
    </div>
  );
}
