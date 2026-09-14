import * as React from "react";
import { Link } from "react-router-dom";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminKitRequests } from "@/hooks/useAdminKitRequests";
import { kitRequestStatusLabel } from "@/lib/kitRequests";
import { formatVendorDosageDisplay } from "@/lib/shop/variantCoverage";
import {
  adminKitRpcErrorMessage,
  type AdminKitRequestStatusFilter,
} from "@/services/adminKitRequests";

const STATUS_FILTERS: Array<{ id: AdminKitRequestStatusFilter; label: string }> = [
  { id: "all", label: "Alle" },
  { id: "open", label: "Offen" },
  { id: "almost_full", label: "Fast voll" },
  { id: "full", label: "Voll" },
  { id: "expired", label: "Abgelaufen" },
  { id: "cancelled", label: "Storniert" },
  { id: "ordered", label: "Bestellt" },
];

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

function creatorHandle(username: string): string {
  const trimmed = username.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : "Unbekannt";
}

function adminStatusLabel(status: string, remainingVials: number): string {
  if (status === "open" && remainingVials > 0 && remainingVials <= 2) return "Fast voll";
  return kitRequestStatusLabel(status);
}

export default function AdminKitRequestsPage() {
  const [status, setStatus] = React.useState<AdminKitRequestStatusFilter>("all");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const listQuery = useAdminKitRequests({ status, shopArea: null, search, page });
  const totalPages = Math.max(1, Math.ceil((listQuery.data?.total ?? 0) / 30));

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Kit Gesuche"
        description="Marketplace Kit Gesuche öffnen, Metadaten bearbeiten, Teilnehmermengen verwalten und stornieren. Historische Bestellungen bleiben unverändert."
      />

      <AdminSection title="Filter" padded>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={status === item.id ? "default" : "outline"}
                onClick={() => {
                  setStatus(item.id);
                  setPage(1);
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Suche Produkt, Code, Vendor oder Ersteller …"
            className="max-w-md"
          />
        </div>
      </AdminSection>

      {listQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : null}
      {listQuery.isError ? (
        <ErrorState
          message={adminKitRpcErrorMessage(listQuery.error, "Kit Gesuche konnten nicht geladen werden.")}
          onRetry={() => listQuery.refetch()}
        />
      ) : null}
      {listQuery.data && listQuery.data.items.length === 0 ? (
        <EmptyState title="Keine Kit Gesuche für diesen Filter." />
      ) : null}

      {listQuery.data && listQuery.data.items.length > 0 ? (
        <AdminSection title={`${listQuery.data.total} Gesuche`} padded={false}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Belegung</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ersteller</TableHead>
                  <TableHead>Bereich</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.items.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-secondary/40">
                    <TableCell className="min-w-[12rem]">
                      <Link to={`/admin/kit-requests/${item.id}`} className="block">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatVendorDosageDisplay(item.variantLabel, item.productCode ?? item.vendorCode ?? "")}
                          {item.vendorCode ? ` · ${item.vendorCode}` : null}
                        </p>
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <Link to={`/admin/kit-requests/${item.id}`} className="block">
                        {item.allocatedTotal}/{item.kitSizeVials}
                        <span className="block text-xs text-muted-foreground">
                          {item.remainingVials} frei · {item.participantCount} TN
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link to={`/admin/kit-requests/${item.id}`}>
                        <Badge variant="secondary">
                          {adminStatusLabel(item.status, item.remainingVials)}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link to={`/admin/kit-requests/${item.id}`}>{creatorHandle(item.creatorUsername)}</Link>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Link to={`/admin/kit-requests/${item.id}`}>{item.shopArea}</Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <Link to={`/admin/kit-requests/${item.id}`}>{formatDate(item.createdAt)}</Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/admin/kit-requests/${item.id}`}>Öffnen</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Zurück
              </Button>
              <p className="text-sm text-muted-foreground">
                Seite {page} / {totalPages}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Weiter
              </Button>
            </div>
          ) : null}
        </AdminSection>
      ) : null}
    </div>
  );
}
