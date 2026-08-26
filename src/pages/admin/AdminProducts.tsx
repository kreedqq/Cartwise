import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileDown, MoreVertical, Plus, Search, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductFormDialog } from "@/components/admin/ProductFormDialog";
import { ProductCsvImportDialog } from "@/components/admin/ProductCsvImportDialog";
import { toast } from "@/components/ui/toaster";
import {
  createProduct,
  hardDeleteProduct,
  isProductReferenced,
  listAllProducts,
  setProductActive,
  updateProduct,
  type ProductWriteInput,
} from "@/services/products";
import { buildProductCsvTemplate, downloadCsv, exportProductsToCsv } from "@/services/csvProducts";
import { formatBulkTier, formatDateTime, formatUsd } from "@/lib/money";
import type { Tables } from "@/types/database";

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const productsQuery = useQuery({ queryKey: ["admin-products", search], queryFn: () => listAllProducts({ search }) });

  const [formOpen, setFormOpen] = React.useState(false);
  const [csvOpen, setCsvOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Tables<"products"> | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Tables<"products"> | null>(null);
  const [deleteBlocked, setDeleteBlocked] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["admin-products"] });
  }

  async function handleSubmit(input: ProductWriteInput) {
    setSaving(true);
    try {
      if (editing) {
        await updateProduct(editing.id, input);
        toast.success("Produkt aktualisiert.");
      } else {
        await createProduct(input);
        toast.success("Produkt angelegt.");
      }
      await invalidate();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(product: Tables<"products">) {
    try {
      await setProductActive(product.id, !product.is_active);
      await invalidate();
      toast.success(product.is_active ? "Produkt deaktiviert." : "Produkt aktiviert.");
    } catch {
      toast.error("Status konnte nicht geändert werden.");
    }
  }

  async function openDeleteDialog(product: Tables<"products">) {
    setDeleteTarget(product);
    const referenced = await isProductReferenced(product.id).catch(() => true);
    setDeleteBlocked(referenced);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await hardDeleteProduct(deleteTarget.id);
      toast.success("Produkt gelöscht.");
      setDeleteTarget(null);
      await invalidate();
    } catch {
      toast.error("Löschen fehlgeschlagen.");
    }
  }

  function handleExport() {
    if (!productsQuery.data) return;
    downloadCsv(`produkte-${new Date().toISOString().slice(0, 10)}.csv`, exportProductsToCsv(productsQuery.data));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche nach Code, Name oder Dosage …"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setCsvOpen(true)}>
            <Upload /> CSV-Import
          </Button>
          <Button
            variant="outline"
            onClick={() => downloadCsv("produkte-vorlage.csv", buildProductCsvTemplate())}
          >
            <FileDown /> CSV-Vorlage
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={!productsQuery.data?.length}>
            <Download /> CSV-Export
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Neues Produkt
          </Button>
        </div>
      </div>

      {productsQuery.isLoading && <Skeleton className="h-64 w-full" />}

      {productsQuery.data && productsQuery.data.length === 0 && (
        <EmptyState title="Keine Produkte gefunden" description="Lege ein neues Produkt an oder importiere eine Liste." />
      )}

      {productsQuery.data && productsQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Dosage / Vial</TableHead>
              <TableHead className="text-right">Preis USD</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Letzte Preisänderung</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productsQuery.data.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-mono text-xs">{product.code}</TableCell>
                <TableCell className="text-sm">{product.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{product.dosage_vial ?? "—"}</TableCell>
                {/* Normal price with the bulk tier as a second line, so the whole
                    price rule is visible without widening the table by two columns. */}
                <TableCell className="text-right tabular-nums text-sm">
                  {formatUsd(product.price_usd)}
                  {formatBulkTier(product) && (
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      {formatBulkTier(product)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{product.category ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={product.is_active ? "success" : "secondary"}>
                    {product.is_active ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDateTime(product.last_price_change_at)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing(product);
                          setFormOpen(true);
                        }}
                      >
                        Bearbeiten
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(product)}>
                        {product.is_active ? "Deaktivieren" : "Aktivieren"}
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => openDeleteDialog(product)}>
                        Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} loading={saving} onSubmit={handleSubmit} />

      <ProductCsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} onImported={invalidate} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Produkt löschen?"
        variant="destructive"
        confirmLabel={deleteBlocked ? "Kann nicht gelöscht werden" : "Endgültig löschen"}
        description={
          deleteBlocked ? (
            <span>
              „{deleteTarget?.name}" wird noch in mindestens einem Warenkorb verwendet und kann daher nicht
              endgültig gelöscht werden. Bitte stattdessen <strong>deaktivieren</strong>, damit bestehende
              Warenkörbe ihre Preis-Snapshots behalten (siehe docs/KONZEPT.md).
            </span>
          ) : (
            <span>„{deleteTarget?.name}" wird endgültig aus der Produktdatenbank entfernt.</span>
          )
        }
        onConfirm={deleteBlocked ? () => setDeleteTarget(null) : handleDelete}
      />
    </div>
  );
}
