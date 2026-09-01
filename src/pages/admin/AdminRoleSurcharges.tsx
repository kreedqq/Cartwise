import { useQuery } from "@tanstack/react-query";
import { FileDown } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { QUERY_KEYS } from "@/lib/constants";
import { formatEur, formatUsd } from "@/lib/money";
import { buildRoleSurchargeCsv, summarizeRoleSurcharges } from "@/lib/roleSurcharge";
import { downloadCsv } from "@/services/csvProducts";
import { listAllOrders } from "@/services/orders";
import { listRoleSurchargeLines } from "@/services/roleSurcharge";

export default function AdminRoleSurchargesPage() {
  const ordersQuery = useQuery({ queryKey: QUERY_KEYS.adminOrders, queryFn: listAllOrders });
  const linesQuery = useQuery({ queryKey: QUERY_KEYS.adminRoleSurcharges, queryFn: listRoleSurchargeLines });

  const isLoading = ordersQuery.isLoading || linesQuery.isLoading;
  const isError = ordersQuery.isError || linesQuery.isError;

  const report = isLoading || isError
    ? null
    : summarizeRoleSurcharges(linesQuery.data ?? [], ordersQuery.data ?? [], (ordersQuery.data ?? []).map((order) => order.id));

  function handleExport() {
    if (!report) return;
    downloadCsv("rollenaufschlaege.csv", buildRoleSurchargeCsv(report));
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Rollenaufschläge"
        description="Tatsächliche Aufschläge aus Bestell-Snapshots. Keine Neuberechnung über die heutige Kundenrolle."
        actions={
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!report}>
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
          }}
        />
      ) : isLoading || !report ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-[11px] font-medium text-muted-foreground">Gesamte Rollenaufschläge USD</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{formatUsd(report.totalSurchargeUsd)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-[11px] font-medium text-muted-foreground">Gesamte Rollenaufschläge EUR</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {report.totalSurchargeEur != null ? formatEur(report.totalSurchargeEur) : "—"}
              </p>
              {!report.eurComplete && report.includedLineCount > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">EUR nur bei Bestellungen mit gespeichertem Wechselkurs.</p>
              )}
            </div>
          </div>

          <AdminSection title="Aufschlüsselung nach Rolle">
            {report.byRole.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Noch keine auswertbaren Aufschlags-Snapshots. Ältere Bestellungen ohne Snapshot werden nicht geschätzt.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Rolle</TableHead>
                    <TableHead className="text-right">Aufschlag USD</TableHead>
                    <TableHead className="text-right">Aufschlag EUR</TableHead>
                    <TableHead className="text-right">Bestellungen</TableHead>
                    <TableHead className="pr-4 text-right">Positionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.byRole.map((bucket) => (
                    <TableRow key={bucket.roleName}>
                      <TableCell className="pl-4 font-medium">{bucket.roleName}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatUsd(bucket.surchargeUsd)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {bucket.surchargeEur != null ? formatEur(bucket.surchargeEur) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{bucket.orderCount}</TableCell>
                      <TableCell className="pr-4 text-right tabular-nums">{bucket.lineCount}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="pl-4 font-semibold">Gesamt</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatUsd(report.totalSurchargeUsd)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {report.totalSurchargeEur != null ? formatEur(report.totalSurchargeEur) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{report.includedOrderCount}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{report.includedLineCount}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </AdminSection>

          {(report.skippedUnauditableOrderCount > 0 || report.skippedCancelledOrderCount > 0) && (
            <p className="text-xs text-muted-foreground">
              {report.skippedUnauditableOrderCount > 0
                ? `${report.skippedUnauditableOrderCount} Bestellung(en) ohne Aufschlags-Snapshot (nicht geschätzt). `
                : ""}
              {report.skippedCancelledOrderCount > 0
                ? `${report.skippedCancelledOrderCount} stornierte Bestellung(en) ausgenommen.`
                : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}
