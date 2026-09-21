import * as React from "react";
import { Link } from "react-router-dom";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toast } from "@/components/ui/toaster";
import {
  useAdminCancelKitRequests,
  useAdminDeleteKitRequests,
  useAdminKitRequests,
} from "@/hooks/useAdminKitRequests";
import {
  adminKitBulkActionHint,
  adminKitSelectionCanBulkCancel,
  adminKitSelectionCanBulkDelete,
} from "@/lib/adminKitRequestBulk";
import { kitFullOrderSyncListLabel } from "@/lib/kitFullOrderSync";
import { kitRequestStatusLabel } from "@/lib/kitRequests";
import { formatVendorDosageDisplay } from "@/lib/shop/variantCoverage";
import {
  adminKitRpcErrorMessage,
  type AdminKitRequestListItem,
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
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [bulkCancelOpen, setBulkCancelOpen] = React.useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

  const listQuery = useAdminKitRequests({ status, shopArea: null, search, page });
  const cancelBulk = useAdminCancelKitRequests();
  const deleteBulk = useAdminDeleteKitRequests();
  const totalPages = Math.max(1, Math.ceil((listQuery.data?.total ?? 0) / 30));

  const visibleItems = React.useMemo(
    () => listQuery.data?.items ?? [],
    [listQuery.data?.items],
  );
  const selectedItems = React.useMemo(
    () => visibleItems.filter((item) => selectedIds.has(item.id)),
    [visibleItems, selectedIds],
  );
  const selectedCount = selectedItems.length;
  const allVisibleSelected =
    visibleItems.length > 0 && visibleItems.every((item) => selectedIds.has(item.id));
  const someVisibleSelected = visibleItems.some((item) => selectedIds.has(item.id));
  const canBulkCancel = adminKitSelectionCanBulkCancel(selectedItems);
  const canBulkDelete = adminKitSelectionCanBulkDelete(selectedItems);
  const bulkHint = adminKitBulkActionHint(selectedItems);

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    if (!checked) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const item of visibleItems) next.delete(item.id);
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const item of visibleItems) next.add(item.id);
      return next;
    });
  }

  async function confirmBulkCancel() {
    const ids = selectedItems.map((item) => item.id);
    try {
      const result = await cancelBulk.mutateAsync(ids);
      setSelectedIds(new Set());
      setBulkCancelOpen(false);
      toast.success(`${result.cancelledCount} Kit-Gesuche wurden storniert.`);
    } catch (error) {
      toast.error(
        adminKitRpcErrorMessage(
          error,
          "Die Bulk-Aktion wurde abgebrochen. Kein ausgewähltes Kit-Gesuch wurde verändert.",
        ),
      );
    }
  }

  async function confirmBulkDelete() {
    const ids = selectedItems.map((item) => item.id);
    try {
      const result = await deleteBulk.mutateAsync(ids);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      toast.success(`${result.deletedCount} Kit-Gesuche wurden gelöscht.`);
    } catch (error) {
      toast.error(
        adminKitRpcErrorMessage(
          error,
          "Die Bulk-Aktion wurde abgebrochen. Kein ausgewähltes Kit-Gesuch wurde verändert.",
        ),
      );
    }
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        section="Bestellungen"
        subsection="Kit Gesuche"
        title="Kit Gesuche verwalten"
        description="Offene Kits, Teilnehmer und Verteilungen bearbeiten. Historische Bestellungen bleiben unverändert."
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
                  clearSelection();
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
              clearSelection();
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Suche Produkt, Code, Händler oder Ersteller …"
            className="max-w-md"
          />
        </div>
      </AdminSection>

      {selectedCount > 0 ? (
        <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">
              {selectedCount} {selectedCount === 1 ? "Gesuch" : "Gesuche"} ausgewählt
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {canBulkCancel ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="h-11 min-h-11 w-full sm:w-auto"
                  disabled={cancelBulk.isPending}
                  onClick={() => setBulkCancelOpen(true)}
                >
                  Gesuche stornieren
                </Button>
              ) : null}
              {canBulkDelete && !canBulkCancel ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="h-11 min-h-11 w-full sm:w-auto"
                  disabled={deleteBulk.isPending}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  Gesuche löschen
                </Button>
              ) : null}
            </div>
          </div>
          {bulkHint ? <p className="mt-2 text-xs text-muted-foreground">{bulkHint}</p> : null}
        </div>
      ) : null}

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
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                      onCheckedChange={(value) => toggleAllVisible(value === true)}
                      aria-label="Alle auf dieser Seite auswählen"
                    />
                  </TableHead>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Belegung</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bestell-Sync</TableHead>
                  <TableHead>Ersteller</TableHead>
                  <TableHead>Bereich</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.items.map((item) => (
                  <KitRequestRow
                    key={item.id}
                    item={item}
                    selected={selectedIds.has(item.id)}
                    onToggle={(checked) => toggleRow(item.id, checked)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-11"
                disabled={page <= 1}
                onClick={() => {
                  clearSelection();
                  setPage((p) => p - 1);
                }}
              >
                Zurück
              </Button>
              <p className="text-sm text-muted-foreground">
                Seite {page} / {totalPages}
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-11"
                disabled={page >= totalPages}
                onClick={() => {
                  clearSelection();
                  setPage((p) => p + 1);
                }}
              >
                Weiter
              </Button>
            </div>
          ) : null}
        </AdminSection>
      ) : null}

      <ConfirmDialog
        open={bulkCancelOpen}
        onOpenChange={setBulkCancelOpen}
        title={`${selectedCount} Kit-Gesuche stornieren?`}
        description="Die ausgewählten Kit-Gesuche werden storniert. Anschließend können sie gelöscht werden, sofern keine Bestellungen oder andere geschützte Daten vorhanden sind."
        confirmLabel="Stornieren"
        cancelLabel="Abbrechen"
        variant="destructive"
        loading={cancelBulk.isPending}
        onConfirm={() => void confirmBulkCancel()}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`${selectedCount} Kit-Gesuche endgültig löschen?`}
        description="Die ausgewählten Kit-Gesuche werden aus der Kit-Gesuch-Verwaltung entfernt. Historische Bestellungen werden nicht verändert."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        loading={deleteBulk.isPending}
        onConfirm={() => void confirmBulkDelete()}
      />
    </div>
  );
}

function KitRequestRow({
  item,
  selected,
  onToggle,
}: {
  item: AdminKitRequestListItem;
  selected: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <TableRow className="hover:bg-secondary/40">
      <TableCell className="w-10 align-middle">
        <Checkbox
          checked={selected}
          onCheckedChange={(value) => onToggle(value === true)}
          aria-label={`Kit-Gesuch ${item.productName} auswählen`}
          onClick={(event) => event.stopPropagation()}
        />
      </TableCell>
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
          {item.allocatedTotal} / {item.kitSizeVials}
          <span className="block text-xs text-muted-foreground">
            {item.remainingVials} frei · {item.participantCount} TN
          </span>
        </Link>
      </TableCell>
      <TableCell>
        <Link to={`/admin/kit-requests/${item.id}`}>
          <Badge variant="secondary">{adminStatusLabel(item.status, item.remainingVials)}</Badge>
        </Link>
      </TableCell>
      <TableCell className="max-w-[14rem] text-xs">
        <Link to={`/admin/kit-requests/${item.id}`} className="block text-muted-foreground">
          {item.status === "full"
            ? kitFullOrderSyncListLabel(
                item.orderSyncLabel,
                item.orderSyncSyncedCount,
                item.orderSyncParticipantCount,
              )
            : "—"}
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
  );
}
