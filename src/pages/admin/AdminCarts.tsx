import * as React from "react";
import { Link } from "react-router-dom";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { useAdminDeleteOpenCarts, useAdminOpenCarts } from "@/hooks/useAdminCarts";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/constants";
import {
  adminOpenCartsDeleteConfirmBody,
  adminOpenCartsDeleteConfirmLabel,
  adminOpenCartsDeletedToast,
  adminOpenCartsSelectedLabel,
  selectAllVisibleIds,
  toggleIdSet,
} from "@/lib/admin/adminCartBulkDelete";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, formatUsd } from "@/lib/money";
import { formatShopAreaLabel } from "@/lib/shop/shopAreas";
import { listAdminShopAreas } from "@/services/shopAreas";

export default function AdminCartsPage() {
  const [shopArea, setShopArea] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const areasQuery = useQuery({ queryKey: QUERY_KEYS.adminShopAreas, queryFn: listAdminShopAreas });
  const cartsQuery = useAdminOpenCarts(
    shopArea === "all" ? null : shopArea,
    search.trim() || null,
  );
  const deleteMutation = useAdminDeleteOpenCarts();

  const rows = (cartsQuery.data ?? []).filter((row) => {
    if (shopArea !== "all" && !row.shop_areas.includes(shopArea)) return false;
    return true;
  });

  const visibleIds = React.useMemo(() => rows.map((row) => row.cart_id), [rows]);
  const selectedCount = selectedIds.size;
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));

  function toggleRow(cartId: string, checked: boolean) {
    setSelectedIds((prev) => toggleIdSet(prev, cartId, checked));
  }

  function toggleAllVisible(checked: boolean) {
    setSelectedIds(checked ? selectAllVisibleIds(visibleIds) : new Set());
  }

  async function confirmDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    try {
      const result = await deleteMutation.mutateAsync(ids);
      toast.success(adminOpenCartsDeletedToast(result.deletedCount));
      setSelectedIds(new Set());
      setConfirmOpen(false);
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Die Warenkörbe konnten nicht gelöscht werden."),
      );
    }
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        section="Bestellungen"
        title="Warenkörbe"
        description="Offene Kundenwarenkörbe einsehen und bearbeiten."
      />

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Kunde oder Warenkorb …"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedIds(new Set());
          }}
          className="max-w-xs"
        />
        <div className="space-y-1">
          <Label id="admin-carts-area-label" htmlFor="admin-carts-area" className="sr-only">
            Shop-Bereich
          </Label>
          <Select
            value={shopArea}
            onValueChange={(value) => {
              setShopArea(value);
              setSelectedIds(new Set());
            }}
          >
            <SelectTrigger id="admin-carts-area" className="w-[220px]" aria-labelledby="admin-carts-area-label">
              <SelectValue placeholder="Shop-Bereich" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Bereiche</SelectItem>
              {(areasQuery.data ?? []).map((area) => (
                <SelectItem key={area.key} value={area.key}>
                  {area.name || formatShopAreaLabel(area.key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <span className="text-sm font-medium">{adminOpenCartsSelectedLabel(selectedCount)}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
            Auswahl aufheben
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
            Warenkörbe löschen
          </Button>
        </div>
      ) : null}

      {cartsQuery.isLoading && <Skeleton className="h-48 w-full" />}
      {cartsQuery.isError && (
        <ErrorState message="Warenkörbe konnten nicht geladen werden." onRetry={() => cartsQuery.refetch()} />
      )}

      {!cartsQuery.isLoading && !cartsQuery.isError && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                    onCheckedChange={(value) => toggleAllVisible(value === true)}
                    aria-label="Alle sichtbaren Warenkörbe auswählen"
                    disabled={visibleIds.length === 0}
                  />
                </TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Warenkorb</TableHead>
                <TableHead>Bereiche</TableHead>
                <TableHead>Positionen</TableHead>
                <TableHead>Gesamt</TableHead>
                <TableHead>Kit</TableHead>
                <TableHead>Geändert</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground">
                    Keine offenen Warenkörbe.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.cart_id}>
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={selectedIds.has(row.cart_id)}
                        onCheckedChange={(value) => toggleRow(row.cart_id, value === true)}
                        aria-label={`Warenkorb ${row.username} auswählen`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link className="font-medium underline-offset-2 hover:underline" to={`/admin/carts/${row.cart_id}`}>
                        {row.username}
                      </Link>
                    </TableCell>
                    <TableCell>{row.cart_name}</TableCell>
                    <TableCell className="text-sm">
                      {row.shop_areas.map((a) => formatShopAreaLabel(a)).join(", ")}
                    </TableCell>
                    <TableCell>{row.item_count}</TableCell>
                    <TableCell>{formatUsd(row.total_usd)}</TableCell>
                    <TableCell>
                      {row.has_kit ? <Badge variant="secondary">Kit</Badge> : "—"}
                      {row.has_submitted_lines ? (
                        <Badge className="ml-1" variant="outline">
                          Bestellt
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(row.updated_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Warenkörbe löschen</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{adminOpenCartsDeleteConfirmBody(selectedCount)}</p>
                <p>Die ausgewählten Warenkörbe werden bei den jeweiligen Kunden entfernt.</p>
                <p>Produkte aus diesen Warenkörben werden nicht bestellt.</p>
                <p>Bereits aufgegebene Bestellungen werden nicht verändert.</p>
                <p>Kit Gesuche und Benutzerkonten bleiben unverändert.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending || selectedCount === 0}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {deleteMutation.isPending ? "Wird gelöscht …" : adminOpenCartsDeleteConfirmLabel(selectedCount)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
