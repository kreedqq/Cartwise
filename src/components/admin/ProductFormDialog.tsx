import * as React from "react";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { productFormSchema } from "@/lib/validation";
import { formatQuantity, formatUsd } from "@/lib/money";
import { toast } from "@/components/ui/toaster";
import type { ProductWriteInput } from "@/services/products";
import type { Tables } from "@/types/database";

function parseInput(raw: string): number | null {
  const value = Number(raw.replace(",", "."));
  return raw.trim() !== "" && Number.isFinite(value) ? value : null;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Tables<"products"> | null;
  loading?: boolean;
  onSubmit: (input: ProductWriteInput) => Promise<void>;
}

export function ProductFormDialog({ open, onOpenChange, product, loading, onSubmit }: ProductFormDialogProps) {
  const [form, setForm] = React.useState({
    code: "",
    name: "",
    dosageVial: "",
    description: "",
    category: "",
    priceUsd: "",
    bulkPriceUsd: "",
    bulkPriceMinQuantity: "",
    isActive: true,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Resets the form (to the product's current values, or blanks for a new
  // product) each time the dialog is (re)opened, so a cancelled edit never
  // leaks into the next time it's opened.
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (open) {
      setForm({
        code: product?.code ?? "",
        name: product?.name ?? "",
        dosageVial: product?.dosage_vial ?? "",
        description: product?.description ?? "",
        category: product?.category ?? "",
        priceUsd: product ? String(product.price_usd) : "",
        bulkPriceUsd: product?.bulk_price_usd != null ? String(product.bulk_price_usd) : "",
        bulkPriceMinQuantity:
          product?.bulk_price_min_quantity != null ? String(product.bulk_price_min_quantity) : "",
        isActive: product?.is_active ?? true,
      });
      setErrors({});
    }
  }, [open, product]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Spells the two-tier rule out in the admin's own numbers, so a wrong
  // threshold is obvious before saving rather than after the first order.
  const pricingPreview = React.useMemo(() => {
    const normal = parseInput(form.priceUsd);
    if (normal == null) return null;

    const bulkEmpty = form.bulkPriceUsd.trim() === "" || form.bulkPriceMinQuantity.trim() === "";
    if (bulkEmpty) return `jede Menge × ${formatUsd(normal)}`;

    const bulk = parseInput(form.bulkPriceUsd);
    const min = parseInput(form.bulkPriceMinQuantity);
    if (bulk == null || min == null || min <= 0) return null;

    const normalRange = min > 1 ? `1–${formatQuantity(min - 1)} × ${formatUsd(normal)} · ` : "";
    return `${normalRange}ab ${formatQuantity(min)} × ${formatUsd(bulk)}`;
  }, [form.priceUsd, form.bulkPriceUsd, form.bulkPriceMinQuantity]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = productFormSchema.safeParse({ ...form, priceUsd: form.priceUsd });
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    try {
      await onSubmit({
        code: result.data.code,
        name: result.data.name,
        dosageVial: result.data.dosageVial || null,
        description: result.data.description || null,
        category: result.data.category || null,
        priceUsd: result.data.priceUsd,
        bulkPriceUsd: result.data.bulkPriceUsd,
        bulkPriceMinQuantity: result.data.bulkPriceMinQuantity,
        isActive: result.data.isActive,
      });
      onOpenChange(false);
    } catch (error) {
      // Log the real Postgres/Supabase error (RLS denial, constraint
      // violation, missing grant, ...) so it's diagnosable in the console -
      // the toast below is deliberately generic-but-informative for the
      // admin, never a bare "Failed to fetch".
      console.error("Produkt konnte nicht gespeichert werden:", error);
      const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
      const lower = message.toLowerCase();
      if (lower.includes("duplicate") || lower.includes("bereits") || lower.includes("products_code_key")) {
        setErrors({ code: "Dieser Artikelcode existiert bereits." });
      } else if (lower.includes("permission denied") || lower.includes("row-level security") || lower.includes("42501")) {
        toast.error("Keine Berechtigung zum Speichern. Bitte prüfe, ob dein Konto die Admin-Rolle hat.");
      } else {
        toast.error(`Produkt konnte nicht gespeichert werden: ${message}`);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{product ? "Produkt bearbeiten" : "Neues Produkt"}</DialogTitle>
            <DialogDescription>
              Der Artikelcode wird automatisch normalisiert (Groß-/Kleinschreibung, Leerzeichen).
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="p-code">Artikelcode</Label>
              <Input
                id="p-code"
                value={form.code}
                invalid={!!errors.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className="font-mono uppercase"
              />
              {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
            </div>
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="p-price">Normalpreis (USD)</Label>
              <Input
                id="p-price"
                value={form.priceUsd}
                invalid={!!errors.priceUsd}
                onChange={(e) => setForm((f) => ({ ...f, priceUsd: e.target.value }))}
                inputMode="decimal"
              />
              {errors.priceUsd && <p className="text-xs text-destructive">{errors.priceUsd}</p>}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="p-name">Name</Label>
              <Input
                id="p-name"
                value={form.name}
                invalid={!!errors.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="p-dosage">Dosage / Vial (optional)</Label>
              <Input
                id="p-dosage"
                value={form.dosageVial}
                invalid={!!errors.dosageVial}
                placeholder="z. B. 10 mg / Vial"
                onChange={(e) => setForm((f) => ({ ...f, dosageVial: e.target.value }))}
              />
              {errors.dosageVial && <p className="text-xs text-destructive">{errors.dosageVial}</p>}
            </div>
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="p-category">Kategorie (optional)</Label>
              <Input
                id="p-category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>

            <div className="col-span-2 space-y-3 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Mengenpreis (optional)</p>
                <p className="text-xs text-muted-foreground">
                  Ab der Mindestmenge gilt der Mengenpreis für die gesamte Position - nicht nur für die
                  zusätzlichen Stück. Beide Felder leer lassen, wenn es keinen Mengenpreis gibt.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5 sm:col-span-1">
                  <Label htmlFor="p-bulk-price">Mengenpreis (USD)</Label>
                  <Input
                    id="p-bulk-price"
                    value={form.bulkPriceUsd}
                    invalid={!!errors.bulkPriceUsd}
                    placeholder="z. B. 55"
                    onChange={(e) => setForm((f) => ({ ...f, bulkPriceUsd: e.target.value }))}
                    inputMode="decimal"
                  />
                  {errors.bulkPriceUsd && <p className="text-xs text-destructive">{errors.bulkPriceUsd}</p>}
                </div>
                <div className="col-span-2 space-y-1.5 sm:col-span-1">
                  <Label htmlFor="p-bulk-min">Mengenpreis ab (Menge)</Label>
                  <Input
                    id="p-bulk-min"
                    value={form.bulkPriceMinQuantity}
                    invalid={!!errors.bulkPriceMinQuantity}
                    placeholder="z. B. 10"
                    onChange={(e) => setForm((f) => ({ ...f, bulkPriceMinQuantity: e.target.value }))}
                    inputMode="decimal"
                  />
                  {errors.bulkPriceMinQuantity && (
                    <p className="text-xs text-destructive">{errors.bulkPriceMinQuantity}</p>
                  )}
                </div>
              </div>
              {pricingPreview && (
                <p className="rounded bg-secondary px-2 py-1.5 text-xs tabular-nums text-muted-foreground">
                  Ergibt: {pricingPreview}
                </p>
              )}
            </div>

            <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3 sm:col-span-1">
              <Label htmlFor="p-active" className="cursor-pointer">
                Status: aktiv
              </Label>
              <Switch
                id="p-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="p-description">Beschreibung (optional)</Label>
              <Textarea
                id="p-description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" loading={loading}>
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
