import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { getImportRows, listImportHistory } from "@/services/pdfImport";
import { formatDateTime, formatQuantity, formatUsd } from "@/lib/money";
import type { PdfImportStatus } from "@/types/database";

const STATUS_VARIANT: Record<PdfImportStatus, "secondary" | "success" | "destructive" | "warning" | "outline"> = {
  uploaded: "secondary",
  previewed: "secondary",
  applied: "success",
  failed: "destructive",
  cancelled: "outline",
};

export default function AdminImportHistoryPage() {
  const importsQuery = useQuery({ queryKey: ["admin-imports"], queryFn: listImportHistory });
  const [expanded, setExpanded] = React.useState<string | null>(null);

  if (importsQuery.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <AdminPageHeader title="Import-Verlauf" description="Alle bisherigen PDF- und CSV-Importe." />

      {!importsQuery.data || importsQuery.data.length === 0 ? (
        <EmptyState title="Noch keine Importe" description="Hier erscheinen alle bisherigen PDF- und CSV-Importe." />
      ) : (
      <AdminSection>
      <div className="overflow-x-auto">
      <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Datei</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Erstellt</TableHead>
          <TableHead className="text-right">Aktualisiert</TableHead>
          <TableHead className="text-right">Übersprungen</TableHead>
          <TableHead className="text-right">Fehlgeschlagen</TableHead>
          <TableHead>Zeitpunkt</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {importsQuery.data.map((imp) => (
          <React.Fragment key={imp.id}>
            <TableRow className="cursor-pointer" onClick={() => setExpanded(expanded === imp.id ? null : imp.id)}>
              <TableCell>
                {expanded === imp.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </TableCell>
              <TableCell className="max-w-[220px] truncate text-sm">{imp.file_name}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[imp.status]}>{imp.status}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">{imp.summary_created}</TableCell>
              <TableCell className="text-right tabular-nums text-sm">{imp.summary_updated}</TableCell>
              <TableCell className="text-right tabular-nums text-sm">{imp.summary_skipped}</TableCell>
              <TableCell className="text-right tabular-nums text-sm">{imp.summary_failed}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{formatDateTime(imp.created_at)}</TableCell>
            </TableRow>
            {expanded === imp.id && <ImportRowsDetail importId={imp.id} />}
          </React.Fragment>
        ))}
      </TableBody>
    </Table>
    </div>
    </AdminSection>
      )}
    </div>
  );
}

function ImportRowsDetail({ importId }: { importId: string }) {
  const rowsQuery = useQuery({ queryKey: ["admin-import-rows", importId], queryFn: () => getImportRows(importId) });

  return (
    <TableRow>
      <TableCell colSpan={8} className="bg-secondary/30 p-0">
        <div className="max-h-72 overflow-x-auto overflow-y-auto p-3">
          {rowsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Dosage / Vial</TableHead>
                  <TableHead className="text-right">Normalpreis</TableHead>
                  <TableHead className="text-right">Mengenpreis</TableHead>
                  <TableHead className="text-right">ab Menge</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aktion</TableHead>
                  <TableHead>Ergebnis</TableHead>
                  <TableHead>Meldung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rowsQuery.data ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground">{row.row_number}</TableCell>
                    <TableCell className="font-mono text-xs">{row.parsed_code ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row.parsed_name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row.parsed_dosage_vial ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatUsd(row.parsed_price_usd)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatUsd(row.parsed_bulk_price_usd)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {row.parsed_bulk_price_min_quantity != null
                        ? formatQuantity(row.parsed_bulk_price_min_quantity)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{row.parsed_category ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {row.parsed_is_active == null ? "—" : row.parsed_is_active ? "Aktiv" : "Inaktiv"}
                    </TableCell>
                    <TableCell className="text-xs">{row.action ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row.result ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.result_message ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
