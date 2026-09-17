import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { PRODUCT_BADGE_KEYS, isProductBadgeKey } from "@/lib/shop/productBadge";
import { productFormSchema } from "@/lib/validation";
import { deleteProductImage, productMediaPublicUrl, uploadProductImage } from "@/services/productMedia";
import type { ProductWriteInput } from "@/services/products";
import { updateProductMediaFields } from "@/services/products";
import type { Tables } from "@/types/database";

export type ProductFormState = {
  code: string;
  name: string;
  dosageVial: string;
  description: string;
  category: string;
  priceUsd: string;
  isActive: boolean;
  badgeKey: string;
  imagePath: string;
};

export function emptyProductForm(product?: Tables<"products"> | null): ProductFormState {
  return {
    code: product?.code ?? "",
    name: product?.name ?? "",
    dosageVial: product?.dosage_vial ?? "",
    description: product?.description ?? "",
    category: product?.category ?? "",
    priceUsd: product ? String(product.price_usd) : "",
    isActive: product?.is_active ?? true,
    badgeKey: product?.badge_key ?? "",
    imagePath: product?.image_path ?? "",
  };
}

export function productFormToWriteInput(data: ProductFormState): ProductWriteInput {
  const parsed = productFormSchema.safeParse({
    ...data,
    bulkPriceUsd: "",
    bulkPriceMinQuantity: "",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }
  return {
    code: parsed.data.code,
    name: parsed.data.name,
    dosageVial: parsed.data.dosageVial || null,
    description: parsed.data.description || null,
    category: parsed.data.category || null,
    priceUsd: parsed.data.priceUsd,
    bulkPriceUsd: null,
    bulkPriceMinQuantity: null,
    isActive: parsed.data.isActive,
    badgeKey: data.badgeKey.trim() ? data.badgeKey.trim() : null,
  };
}

export type ProductFormSubmitExtras = {
  imageFile: File | null;
  removeImage: boolean;
};

interface ProductFormSectionsProps {
  form: ProductFormState;
  onChange: React.Dispatch<React.SetStateAction<ProductFormState>>;
  errors: Record<string, string>;
  onErrorsChange: (errors: Record<string, string>) => void;
  onSubmit: (input: ProductWriteInput, extras: ProductFormSubmitExtras) => Promise<void>;
  loading?: boolean;
  submitLabel?: string;
  productId?: string;
}

export function ProductFormSections({
  form,
  onChange,
  errors,
  onErrorsChange,
  onSubmit,
  loading = false,
  submitLabel = "Speichern",
  productId,
}: ProductFormSectionsProps) {
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [removeImage, setRemoveImage] = React.useState(false);
  const previewUrl = React.useMemo(() => {
    if (imageFile) return URL.createObjectURL(imageFile);
    if (!removeImage && form.imagePath) return productMediaPublicUrl(form.imagePath);
    return null;
  }, [form.imagePath, imageFile, removeImage]);

  React.useEffect(() => {
    return () => {
      if (imageFile && previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [imageFile, previewUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = productFormSchema.safeParse({
      ...form,
      bulkPriceUsd: "",
      bulkPriceMinQuantity: "",
    });
    if (!result.success) {
      onErrorsChange(Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    onErrorsChange({});
    const badge = form.badgeKey.trim();
    if (badge && !isProductBadgeKey(badge)) {
      onErrorsChange({ badgeKey: "Ungültiges Badge." });
      return;
    }
    try {
      const input: ProductWriteInput = {
        code: result.data.code,
        name: result.data.name,
        dosageVial: result.data.dosageVial || null,
        description: result.data.description || null,
        category: result.data.category || null,
        priceUsd: result.data.priceUsd,
        bulkPriceUsd: null,
        bulkPriceMinQuantity: null,
        isActive: result.data.isActive,
        badgeKey: badge ? badge : null,
      };
      await onSubmit(input, { imageFile, removeImage });
      if (productId) {
        if (removeImage && form.imagePath) {
          await deleteProductImage(form.imagePath);
          await updateProductMediaFields(productId, { imagePath: null });
          onChange((f) => ({ ...f, imagePath: "" }));
        } else if (imageFile) {
          const path = await uploadProductImage(productId, imageFile);
          await updateProductMediaFields(productId, { imagePath: path });
          onChange((f) => ({ ...f, imagePath: path }));
        }
        setImageFile(null);
        setRemoveImage(false);
      }
    } catch (error) {
      console.error("Produkt speichern fehlgeschlagen:", error);
      const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
      const lower = message.toLowerCase();
      if (lower.includes("duplicate") || lower.includes("products_code_key")) {
        onErrorsChange({ code: "Der Artikelcode existiert bereits." });
      } else if (lower.includes("permission denied") || lower.includes("42501")) {
        toast.error("Keine Berechtigung zum Speichern.");
      } else {
        toast.error(`Produkt konnte nicht gespeichert werden: ${message}`);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Produkt</h2>
        <div className="space-y-1.5">
          <Label htmlFor="pf-name">Produktname</Label>
          <Input
            id="pf-name"
            value={form.name}
            invalid={!!errors.name}
            onChange={(e) => onChange((f) => ({ ...f, name: e.target.value }))}
          />
          {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-code">Code</Label>
          <Input
            id="pf-code"
            value={form.code}
            invalid={!!errors.code}
            onChange={(e) => onChange((f) => ({ ...f, code: e.target.value }))}
            className="font-mono uppercase"
          />
          {errors.code ? <p className="text-xs text-destructive">{errors.code}</p> : null}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Kategorie</h2>
        <Input
          id="pf-category"
          value={form.category}
          placeholder="z. B. Peptide"
          onChange={(e) => onChange((f) => ({ ...f, category: e.target.value }))}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Variante</h2>
        <Input
          id="pf-dosage"
          value={form.dosageVial}
          invalid={!!errors.dosageVial}
          placeholder="z. B. 10 mg × 10 Vials"
          onChange={(e) => onChange((f) => ({ ...f, dosageVial: e.target.value }))}
        />
        {errors.dosageVial ? <p className="text-xs text-destructive">{errors.dosageVial}</p> : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Preis</h2>
        <div className="space-y-1.5">
          <Label htmlFor="pf-price">Preis USD</Label>
          <Input
            id="pf-price"
            value={form.priceUsd}
            invalid={!!errors.priceUsd}
            onChange={(e) => onChange((f) => ({ ...f, priceUsd: e.target.value }))}
            inputMode="decimal"
          />
          {errors.priceUsd ? <p className="text-xs text-destructive">{errors.priceUsd}</p> : null}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Status</h2>
        <div className="flex items-center justify-between rounded-lg border border-border/80 px-4 py-3">
          <Label htmlFor="pf-active">Aktiv</Label>
          <Switch
            id="pf-active"
            checked={form.isActive}
            onCheckedChange={(v) => onChange((f) => ({ ...f, isActive: v }))}
          />
        </div>
      </section>

      <section className="space-y-2">
        <Label htmlFor="pf-desc">Beschreibung (optional)</Label>
        <Textarea
          id="pf-desc"
          rows={3}
          value={form.description}
          onChange={(e) => onChange((f) => ({ ...f, description: e.target.value }))}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Shop-Badge (optional)</h2>
        <select
          id="pf-badge"
          value={form.badgeKey}
          onChange={(e) => onChange((f) => ({ ...f, badgeKey: e.target.value }))}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Kein Badge</option>
          {PRODUCT_BADGE_KEYS.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
        {errors.badgeKey ? <p className="text-xs text-destructive">{errors.badgeKey}</p> : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Produktbild (optional)</h2>
        {previewUrl ? (
          <img src={previewUrl} alt="" className="max-h-48 rounded-lg border border-border object-contain" />
        ) : (
          <p className="text-xs text-muted-foreground">Kein Bild — im Shop erscheint ein PEPTIX-Platzhalter.</p>
        )}
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setImageFile(file);
            setRemoveImage(false);
          }}
        />
        {form.imagePath && !removeImage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setRemoveImage(true);
              setImageFile(null);
            }}
          >
            Bild entfernen
          </Button>
        ) : null}
      </section>

      <Button type="submit" loading={loading} className="w-full sm:w-auto">
        {submitLabel}
      </Button>
    </form>
  );
}
