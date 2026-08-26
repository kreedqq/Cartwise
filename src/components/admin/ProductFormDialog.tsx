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
import { toast } from "@/components/ui/toaster";
import type { ProductWriteInput } from "@/services/products";
import type { Tables } from "@/types/database";

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
    description: "",
    category: "",
    priceUsd: "",
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
        description: product?.description ?? "",
        category: product?.category ?? "",
        priceUsd: product ? String(product.price_usd) : "",
        isActive: product?.is_active ?? true,
      });
      setErrors({});
    }
  }, [open, product]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
        description: result.data.description || null,
        category: result.data.category || null,
        priceUsd: result.data.priceUsd,
        isActive: result.data.isActive,
      });
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
      if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("bereits")) {
        setErrors({ code: "Dieser Artikelcode existiert bereits." });
      } else {
        toast.error("Produkt konnte nicht gespeichert werden.");
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
              <Label htmlFor="p-price">Preis (USD)</Label>
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
              <Label htmlFor="p-category">Kategorie (optional)</Label>
              <Input
                id="p-category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3 sm:col-span-1">
              <Label htmlFor="p-active" className="cursor-pointer">
                Aktiv
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
