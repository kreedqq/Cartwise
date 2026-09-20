import * as React from "react";

import { AdminSection } from "@/components/admin/AdminSection";
import { ShopProductImageFrame } from "@/components/shop/ShopProductImageFrame";
import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";
import { ErrorState } from "@/components/common/ErrorState";
import { ImageDropzone } from "@/components/media/ImageDropzone";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { EMPTY_DESIGN_STUDIO, mergeDesignStudioIntoConfig } from "@/lib/designStudio";
import { SHOP_GRID } from "@/lib/design/tokens";
import { useDesignStudioCategoryRegistry } from "@/hooks/useDesignStudioCategories";
import { useSaveSiteDesign, useSiteDesign } from "@/hooks/useTrustExperience";
import type { SiteDesignConfig } from "@/lib/siteDesign";
import {
  deleteSiteDesignImage,
  siteDesignImageUrl,
  uploadDesignStudioCategoryImage,
} from "@/services/siteDesign";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

const PREVIEW_BY_CATEGORY: Record<string, Pick<Tables<"products">, "name" | "code">> = {
  peptides: { name: "Semax 10mg", code: "SM10" },
  "injectable-oils": { name: "Test Enanthate 300", code: "TE300" },
  orals: { name: "Anadrol 50mg", code: "OXO50" },
  "reconstitution-water": { name: "BAC Water 10ml", code: "BA10" },
  accessories: { name: "Insulin Spritzen", code: "ACC01" },
};

function previewProduct(categoryKey: string): Tables<"products"> {
  const sample = PREVIEW_BY_CATEGORY[categoryKey] ?? {
    name: "Beispielprodukt",
    code: "DEMO",
  };
  return {
    id: "00000000-0000-4000-8000-000000000001",
    code: sample.code,
    name: sample.name,
    description: null,
    dosage_vial: null,
    category: categoryKey,
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

  const categoriesQuery = useDesignStudioCategoryRegistry(studio.categoryMedia);
  const registry = categoriesQuery.registry;

  const [pendingFile, setPendingFile] = React.useState<Partial<Record<string, File>>>({});
  const [previewCategoryKey, setPreviewCategoryKey] = React.useState("peptides");
  const resolvedPreviewKey =
    registry.find((entry) => entry.key === previewCategoryKey)?.key ?? registry[0]?.key ?? previewCategoryKey;

  async function persist(nextStudio: typeof studio) {
    const baseRecord = siteQuery.data?.configRecord ?? {};
    const merged = mergeDesignStudioIntoConfig(baseRecord, nextStudio) as unknown as SiteDesignConfig;
    await saveMutation.mutateAsync({
      enabled: siteQuery.data?.enabled ?? false,
      config: merged,
    });
    setLocalStudio(null);
  }

  async function uploadCategory(categoryKey: string, label: string) {
    const file = pendingFile[categoryKey];
    if (!file) {
      toast.error("Bitte zuerst eine Datei wählen.");
      return;
    }
    const previousPath = studio.categoryMedia[categoryKey];
    let uploadedPath: string | null = null;
    try {
      uploadedPath = await uploadDesignStudioCategoryImage(categoryKey, file);
      const next = {
        ...studio,
        categoryMedia: { ...studio.categoryMedia, [categoryKey]: uploadedPath },
      };
      await persist(next);
      setPendingFile((p) => {
        const copy = { ...p };
        delete copy[categoryKey];
        return copy;
      });
      toast.success(`${label}: Kategoriebild gespeichert.`);
      if (previousPath && previousPath !== uploadedPath) {
        await deleteSiteDesignImage(previousPath).catch(() => undefined);
      }
    } catch (error) {
      if (uploadedPath) await deleteSiteDesignImage(uploadedPath).catch(() => undefined);
      toast.error(error instanceof Error ? error.message : "Upload fehlgeschlagen.");
    }
  }

  async function removeCategory(categoryKey: string) {
    const path = studio.categoryMedia[categoryKey];
    if (!path) return;
    const nextMedia = { ...studio.categoryMedia };
    delete nextMedia[categoryKey];
    await persist({ ...studio, categoryMedia: nextMedia });
    await deleteSiteDesignImage(path).catch(() => undefined);
    toast.success("Kategoriebild entfernt.");
  }

  const previewEntry = registry.find((entry) => entry.key === resolvedPreviewKey);
  const previewProductRow = previewProduct(resolvedPreviewKey);
  const previewLabel = previewEntry?.label ?? resolvedPreviewKey;

  return (
    <div className="space-y-6">
      <AdminSection
        title="Kategorie Bilder"
        description="Ein Standardbild pro Kategorie für alle Produkte ohne eigenes Produktbild. Getrennt von Portal-Assets und Vials."
        padded
      >
        {categoriesQuery.isLoading ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-80 w-full rounded-xl" />
            ))}
          </div>
        ) : categoriesQuery.isError ? (
          <ErrorState
            message={
              categoriesQuery.error instanceof Error
                ? `Kategorien konnten nicht geladen werden: ${categoriesQuery.error.message}`
                : "Kategorien konnten nicht geladen werden."
            }
            onRetry={() => void categoriesQuery.refetch()}
          />
        ) : registry.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Kategorien im System. Legen Sie Kategorien unter Shop Bereiche an.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {registry.map((entry) => {
              const categoryKey = entry.key;
              const activePath = studio.categoryMedia[categoryKey];
              const activeUrl = activePath ? siteDesignImageUrl(activePath) : null;
              const pending = pendingFile[categoryKey];
              const pendingUrl = pending ? URL.createObjectURL(pending) : null;
              const displayUrl = pendingUrl ?? activeUrl;
              const isActive = Boolean(activePath);

              return (
                <div
                  key={categoryKey}
                  className="rounded-xl border border-border/60 bg-card/30 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {entry.headline}
                      </p>
                      <p className="text-sm text-muted-foreground">{entry.label}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/80">{categoryKey}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
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
                    <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">{activePath}</p>
                  ) : null}

                  {isActive ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Dieses Bild wird für Produkte dieser Kategorie verwendet, sofern kein eigenes Produktbild gesetzt ist.
                    </p>
                  ) : null}

                  <div className="mt-3 space-y-2">
                    <ImageDropzone
                      previewUrl={pendingUrl}
                      onFile={async (file) => setPendingFile((p) => ({ ...p, [categoryKey]: file }))}
                      label={isActive ? "Bild ersetzen" : "Bild hochladen"}
                      hint="JPG, PNG oder WebP · empfohlen ≥ 800×1000"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        loading={saveMutation.isPending}
                        disabled={!pending}
                        onClick={() => void uploadCategory(categoryKey, entry.label)}
                      >
                        {isActive ? "Ersetzen" : "Hochladen"}
                      </Button>
                      {isActive ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          loading={saveMutation.isPending}
                          onClick={() => void removeCategory(categoryKey)}
                        >
                          Entfernen
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setPreviewCategoryKey(categoryKey)}
                      >
                        Vorschau Karte
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AdminSection>

      {registry.length > 0 ? (
        <AdminSection title="Beispiel Produktkarte" padded>
          <p className="mb-3 text-sm text-muted-foreground">
            Live-Vorschau mit Kategorie-Fallback (ohne Produktbild) — Kategorie:{" "}
            <span className="font-medium text-foreground">{previewLabel}</span>
          </p>
          <article className={cn(SHOP_GRID.card, "max-w-[16rem]")} data-testid="category-media-preview-card">
            <ShopProductImageFrame
              product={previewProductRow}
              categoryKey={resolvedPreviewKey}
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
      ) : null}
    </div>
  );
}
