import * as React from "react";

import { AdminSection } from "@/components/admin/AdminSection";
import { ShopProductImageFrame } from "@/components/shop/ShopProductImageFrame";
import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";
import { ImageDropzone } from "@/components/media/ImageDropzone";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import {
  EMPTY_DESIGN_STUDIO,
  mergeDesignStudioIntoConfig,
  parseDesignStudioConfig,
} from "@/lib/designStudio";
import { SHOP_GRID } from "@/lib/design/tokens";
import { useSaveSiteDesign, useSiteDesign } from "@/hooks/useTrustExperience";
import { parseSiteDesignConfig, type SiteDesignConfig } from "@/lib/siteDesign";
import { shopCategoryById, SHOP_CATEGORY_IDS, type ShopCategoryId } from "@/lib/shopCategories";
import {
  deleteSiteDesignImage,
  siteDesignImageUrl,
  uploadDesignStudioCategoryImage,
} from "@/services/siteDesign";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

const PREVIEW_BY_CATEGORY: Record<ShopCategoryId, Pick<Tables<"products">, "name" | "code">> = {
  peptides: { name: "Semax 10mg", code: "SM10" },
  "injectable-oils": { name: "Test Enanthate 300", code: "TE300" },
  orals: { name: "Anadrol 50mg", code: "OXO50" },
  "reconstitution-water": { name: "BAC Water 10ml", code: "BA10" },
};

function previewProduct(categoryId: ShopCategoryId): Tables<"products"> {
  const sample = PREVIEW_BY_CATEGORY[categoryId];
  return {
    id: "00000000-0000-4000-8000-000000000001",
    code: sample.code,
    name: sample.name,
    description: null,
    dosage_vial: null,
    category: categoryId,
    image_path: null,
    badge_key: null,
    price_usd: 42.5,
    bulk_price_usd: null,
    bulk_price_min_quantity: null,
    currency: "USD",
    is_active: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    last_price_change_at: null,
  };
}

export default function AdminDesignStudioCategoriesPage() {
  const siteQuery = useSiteDesign();
  const saveMutation = useSaveSiteDesign();
  const savedStudio = React.useMemo(
    () => siteQuery.data?.designStudio ?? EMPTY_DESIGN_STUDIO,
    [siteQuery.data?.designStudio],
  );
  const [localStudio, setLocalStudio] = React.useState<typeof EMPTY_DESIGN_STUDIO | null>(null);
  const studio = localStudio ?? savedStudio;
  const [pendingFile, setPendingFile] = React.useState<Partial<Record<ShopCategoryId, File>>>({});
  const [previewCategory, setPreviewCategory] = React.useState<ShopCategoryId>("peptides");

  async function persist(nextStudio: typeof studio) {
    const baseRecord = siteQuery.data?.configRecord ?? {};
    const merged = mergeDesignStudioIntoConfig(baseRecord, nextStudio) as unknown as SiteDesignConfig;
    await saveMutation.mutateAsync({
      enabled: siteQuery.data?.enabled ?? false,
      config: merged,
    });
    setLocalStudio(null);
  }

  async function uploadCategory(categoryId: ShopCategoryId) {
    const file = pendingFile[categoryId];
    if (!file) {
      toast.error("Bitte zuerst eine Datei wählen.");
      return;
    }
    const previousPath = studio.categoryMedia[categoryId];
    let uploadedPath: string | null = null;
    try {
      uploadedPath = await uploadDesignStudioCategoryImage(categoryId, file);
      const next = {
        ...studio,
        categoryMedia: { ...studio.categoryMedia, [categoryId]: uploadedPath },
      };
      await persist(next);
      setPendingFile((p) => {
        const copy = { ...p };
        delete copy[categoryId];
        return copy;
      });
      toast.success(`${shopCategoryById(categoryId).headline}: Kategoriebild gespeichert.`);
      if (previousPath && previousPath !== uploadedPath) {
        await deleteSiteDesignImage(previousPath).catch(() => undefined);
      }
    } catch (error) {
      if (uploadedPath) await deleteSiteDesignImage(uploadedPath).catch(() => undefined);
      toast.error(error instanceof Error ? error.message : "Upload fehlgeschlagen.");
    }
  }

  async function removeCategory(categoryId: ShopCategoryId) {
    const path = studio.categoryMedia[categoryId];
    if (!path) return;
    const nextMedia = { ...studio.categoryMedia };
    delete nextMedia[categoryId];
    await persist({ ...studio, categoryMedia: nextMedia });
    await deleteSiteDesignImage(path).catch(() => undefined);
    toast.success("Kategoriebild entfernt.");
  }

  const previewProductRow = previewProduct(previewCategory);
  const previewLabel = shopCategoryById(previewCategory).label;

  return (
    <div className="space-y-6">
      <AdminSection
        title="Kategorie Bilder"
        description="Ein Standardbild pro Kategorie für alle Produkte ohne eigenes Produktbild. Getrennt von Portal-Assets und Vials."
        padded
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {SHOP_CATEGORY_IDS.map((categoryId) => {
            const meta = shopCategoryById(categoryId);
            const activePath = studio.categoryMedia[categoryId];
            const activeUrl = activePath ? siteDesignImageUrl(activePath) : null;
            const pending = pendingFile[categoryId];
            const pendingUrl = pending ? URL.createObjectURL(pending) : null;
            const displayUrl = pendingUrl ?? activeUrl;
            const isActive = Boolean(activePath);

            return (
              <div
                key={categoryId}
                className="rounded-xl border border-border/60 bg-card/30 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {meta.headline}
                    </p>
                    <p className="text-sm text-muted-foreground">{meta.label}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isActive ? "Kategorie Bild aktiv" : "Kein Kategorie Bild"}
                  </span>
                </div>

                <div className="mt-3 flex aspect-[4/5] max-h-72 items-center justify-center overflow-hidden rounded-lg bg-[#0a0a0f] p-2">
                  {displayUrl ? (
                    <img src={displayUrl} alt="" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <p className="text-center text-xs text-muted-foreground">Noch kein Bild</p>
                  )}
                </div>

                {activePath ? (
                  <p className="mt-2 font-mono text-[10px] text-muted-foreground">{activePath}</p>
                ) : null}

                {isActive ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Dieses Bild wird für Produkte dieser Kategorie verwendet, sofern kein eigenes Produktbild gesetzt ist.
                  </p>
                ) : null}

                <div className="mt-3 space-y-2">
                  <ImageDropzone
                    previewUrl={pendingUrl}
                    onFile={async (file) => setPendingFile((p) => ({ ...p, [categoryId]: file }))}
                    label={isActive ? "Bild ersetzen" : "Bild hochladen"}
                    hint="JPG, PNG oder WebP · empfohlen ≥ 800×1000"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      loading={saveMutation.isPending}
                      disabled={!pending}
                      onClick={() => void uploadCategory(categoryId)}
                    >
                      {isActive ? "Ersetzen" : "Hochladen"}
                    </Button>
                    {isActive ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        loading={saveMutation.isPending}
                        onClick={() => void removeCategory(categoryId)}
                      >
                        Entfernen
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewCategory(categoryId)}
                    >
                      Vorschau Karte
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </AdminSection>

      <AdminSection title="Beispiel Produktkarte" padded>
        <p className="mb-3 text-sm text-muted-foreground">
          Live-Vorschau mit Kategorie-Fallback (ohne Produktbild) — Kategorie:{" "}
          <span className="font-medium text-foreground">{previewLabel}</span>
        </p>
        <article className={cn(SHOP_GRID.card, "max-w-[16rem]")} data-testid="category-media-preview-card">
          <ShopProductImageFrame
            product={previewProductRow}
            categoryKey={previewCategory}
            categoryLabel={previewLabel}
          />
          <div className="space-y-1 px-3 pb-3 pt-2">
            <p className="text-sm font-semibold leading-tight">{previewProductRow.name}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{previewLabel}</p>
            <DualCurrencyPrice usd={42.5} rate={1.08} size="compact" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">In den Warenkorb</p>
          </div>
        </article>
      </AdminSection>
    </div>
  );
}
