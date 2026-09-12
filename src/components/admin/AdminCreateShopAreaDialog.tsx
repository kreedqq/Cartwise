import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { MAX_PDF_SIZE_BYTES } from "@/lib/constants";
import { slugifyShopAreaName } from "@/lib/shop/shopAreas";
import { matchVendorCatalogRows } from "@/lib/shop/vendorCatalog";
import { ACCEPTED_IMPORT_ACCEPT, ACCEPTED_IMPORT_LABEL, detectImportSourceKind } from "@/services/productImportSource";
import { applyVendorCatalogFromFile, createAdminShopArea } from "@/services/shopAreas";
import { parseVendorCatalogFile } from "@/services/vendorCatalogImport";
import type { Tables } from "@/types/database";

type CreateMode = "empty" | "file" | "template" | "duplicate";

export function AdminCreateShopAreaDialog({
  open,
  onOpenChange,
  areas,
  products = [],
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areas: Tables<"shop_areas">[];
  products?: Tables<"products">[];
  onCreated: (key: string) => void;
}) {
  const [name, setName] = React.useState("");
  const [mode, setMode] = React.useState<CreateMode>("empty");
  const [template, setTemplate] = React.useState("peptix");
  const [sourceKey, setSourceKey] = React.useState(areas[0]?.key ?? "shop");
  const [copyCategories, setCopyCategories] = React.useState(true);
  const [copyRoles, setCopyRoles] = React.useState(true);
  const [copyDesign, setCopyDesign] = React.useState(true);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<{
    valid: number;
    variants: number;
    linked: number;
    unlinked: number;
  } | null>(null);
  const [saving, setSaving] = React.useState(false);

  const slug = slugifyShopAreaName(name);

  function templateForCreate(): string {
    if (mode === "duplicate") return "duplicate";
    if (mode === "template") return template;
    return "empty";
  }

  async function onPickFile(next: File | undefined) {
    setFile(null);
    setPreview(null);
    if (!next) return;
    if (next.size > MAX_PDF_SIZE_BYTES) {
      toast.error("Datei ist größer als 10 MB.");
      return;
    }
    if (!detectImportSourceKind(next.name)) {
      toast.error(`Erlaubt: ${ACCEPTED_IMPORT_LABEL}.`);
      return;
    }
    try {
      const parsed = await parseVendorCatalogFile(next);
      const matched = matchVendorCatalogRows(parsed.rows, products);
      setFile(next);
      setPreview({
        valid: matched.matched.length,
        variants: new Set(matched.matched.map((row) => row.dosage_vial).filter(Boolean)).size,
        linked: matched.matched.filter((row) => row.product_id).length,
        unlinked: matched.matched.filter((row) => !row.product_id).length,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Datei konnte nicht gelesen werden.");
    }
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Bitte einen Namen eingeben.");
      return;
    }
    if (mode === "file" && !file) {
      toast.error("Bitte eine Händlerdatei wählen.");
      return;
    }
    setSaving(true);
    try {
      const created = await createAdminShopArea({
        name: name.trim(),
        template: templateForCreate(),
        sourceKey: mode === "duplicate" ? sourceKey : null,
        copyCategories,
        copyRoles,
        copyDesign,
      });
      if (mode === "file" && file) {
        const parsed = await parseVendorCatalogFile(file);
        const matched = matchVendorCatalogRows(parsed.rows, products);
        await applyVendorCatalogFromFile(
          created.key,
          file,
          matched.matched.map((entry) => ({
            vendor_code: entry.code,
            product_id: entry.product_id,
            price_usd: entry.price_usd,
            bulk_price_usd: entry.bulk_price_usd,
            bulk_price_min_quantity: entry.bulk_price_min_quantity,
            vendor_name: entry.name,
            vendor_dosage: entry.dosage_vial,
            vendor_raw: entry.vendor_raw,
            imported_category_key: entry.imported_category_key,
          })),
        );
      }
      toast.success(`${created.name} wurde angelegt.`);
      onCreated(created.key);
      onOpenChange(false);
      setName("");
      setFile(null);
      setPreview(null);
    } catch (error) {
      console.error(error);
      toast.error("Bereich konnte nicht angelegt werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Neuen Verkaufsbereich anlegen</DialogTitle>
          <DialogDescription>
            Leer, aus Vorlage, per Duplikat oder mit Händlerdatei. Bestellungen und Warenkörbe werden nicht kopiert.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="area-name">Name</Label>
            <Input id="area-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Zubehör" />
            <p className="text-xs text-muted-foreground">Technischer Key / Pfad: {slug || "—"}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Erstellen als</Label>
            <Select value={mode} onValueChange={(value) => setMode(value as CreateMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="empty">Leer erstellen</SelectItem>
                <SelectItem value="file">Händlerdatei importieren</SelectItem>
                <SelectItem value="template">Aus Vorlage erstellen</SelectItem>
                <SelectItem value="duplicate">Bestehenden Bereich duplizieren</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "template" ? (
            <div className="space-y-1.5">
              <Label>Vorlage</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="peptix">PEPTIX Standard</SelectItem>
                  <SelectItem value="retail">Retail Vorlage</SelectItem>
                  <SelectItem value="group_buy">Group Buy Vorlage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {mode === "duplicate" ? (
            <div className="space-y-1.5">
              <Label>Quelle</Label>
              <Select value={sourceKey} onValueChange={setSourceKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((area) => (
                    <SelectItem key={area.key} value={area.key}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {mode === "file" ? (
            <div className="space-y-1.5">
              <Label htmlFor="area-file">Händlerdatei</Label>
              <Input
                id="area-file"
                type="file"
                accept={ACCEPTED_IMPORT_ACCEPT}
                onChange={(event) => void onPickFile(event.target.files?.[0])}
              />
              {preview ? (
                <p className="text-xs text-muted-foreground">
                  {preview.valid} gültige Artikel · {preview.variants} Varianten · {preview.linked} mit Masterprodukt ·{" "}
                  {preview.unlinked} ohne Masterprodukt
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Excel oder CSV. Fehlende globale SKU ist kein Fehler.</p>
              )}
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={copyCategories} onCheckedChange={(value) => setCopyCategories(value === true)} />
            Kategorien übernehmen
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={copyRoles} onCheckedChange={(value) => setCopyRoles(value === true)} />
            Rollen übernehmen
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={copyDesign} onCheckedChange={(value) => setCopyDesign(value === true)} />
            Design übernehmen
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="button" onClick={() => void handleCreate()} disabled={saving}>
            {mode === "file" ? "Bereich erstellen und Katalog übernehmen" : "Bereich anlegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
