import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminKitOrderContext, useAdminOrderItems, useAdminOrders } from "@/hooks/useAdminOrders";
import { QUERY_KEYS } from "@/lib/constants";
import { formatDateTime, formatQuantity, formatUsd } from "@/lib/money";
import { downloadProcessingOrderSummaryPdf } from "@/lib/orderExport";
import { buildProcessingOrderSummary } from "@/lib/orderSummary";
import { listAllProducts } from "@/services/products";

export default function AdminOrderSummaryPage() {
  const ordersQuery = useAdminOrders();
  const itemsQuery = useAdminOrderItems();
  const kitQuery = useAdminKitOrderContext();
  const productsQuery = useQuery({
    queryKey: QUERY_KEYS.products,
    queryFn: () => listAllProducts(),
  });

  const summary = React.useMemo(
    () =>
      buildProcessingOrderSummary(
        ordersQuery.data ?? [],
        itemsQuery.data ?? [],
        productsQuery.data ?? [],
        kitQuery.data,
      ),
    [ordersQuery.data, itemsQuery.data, productsQuery.data, kitQuery.data],
  );

  const loading = ordersQuery.isLoading || itemsQuery.isLoading || kitQuery.isLoading;
  const errored = ordersQuery.isError || itemsQuery.isError || kitQuery.isError;

  function handleExport() {
    if (summary.orderCount === 0) return;
    downloadProcessingOrderSummaryPdf(summary, formatDateTime(new Date().toISOString()));
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Bestell Zusammenfassung"
        description={`Berücksichtigt: ${summary.orderCount} ${summary.orderCount === 1 ? "Bestellung" : "Bestellungen"} | ${summary.productCount} verschiedene Produkte | Gesamtmenge: ${formatQuantity(summary.totalQuantity)}`}
        actions={
          <Button variant="outline" size="sm" onClick={handleExport} disabled={summary.orderCount === 0}>
            <FileDown /> Als PDF exportieren
          </Button>
        }
      />

      <p className="text-sm text-muted-foreground">
        Nur Bestellungen mit dem Status <span className="font-medium text-foreground">In Bearbeitung</span>.
      </p>

      {loading && <Skeleton className="h-64 w-full" />}
      {errored && (
        <ErrorState
          message="Die Bestellzusammenfassung konnte nicht geladen werden."
          onRetry={() => {
            void ordersQuery.refetch();
            void itemsQuery.refetch();
            void kitQuery.refetch();
          }}
        />
      )}
      {!loading && !errored && summary.orderCount === 0 && (
        <EmptyState
          title="Keine Bestellungen in Bearbeitung"
          description="Sobald eine Bestellung auf „In Bearbeitung“ gesetzt wird, erscheint sie automatisch in dieser Liste."
        />
      )}

      {!loading && !errored && summary.orderCount > 0 && (
        <div className="space-y-4">
          {summary.groups.map((group) => (
            <AdminSection key={group.categoryId} title={group.label}>
              <div className="overflow-x-auto">
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
            </AdminSection>
          ))}

          <AdminSection padded>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{summary.productCount} Produkte</span>
              <span className="font-semibold tabular-nums">Gesamtpreis: {formatUsd(summary.totalUsd)}</span>
            </div>
          </AdminSection>
        </div>
      )}
    </div>
  );
}
