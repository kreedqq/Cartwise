import * as React from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AdminSection } from "@/components/admin/AdminSection";
import { ShopProductImageFrame } from "@/components/shop/ShopProductImageFrame";
import { ImageDropzone } from "@/components/media/ImageDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import {
  EMPTY_DESIGN_STUDIO,
  mergeDesignStudioIntoConfig,
  parseDesignStudioConfig,
  type VialLibraryEntry,
} from "@/lib/designStudio";
import { QUERY_KEYS } from "@/lib/constants";
import { PEPTIX_CANONICAL_VIAL_PATH } from "@/lib/shop/portalTheme";
import { parseVialMedia } from "@/lib/shop/portalAssets";
import { useSaveSiteDesign, useSiteDesign } from "@/hooks/useTrustExperience";
import { parseSiteDesignConfig, type SiteDesignConfig } from "@/lib/siteDesign";
import { listAdminShopAreas, updateAdminShopArea } from "@/services/shopAreas";
import { supabase } from "@/lib/supabaseClient";
import {
  deleteSiteDesignImage,
  siteDesignImageUrl,
  uploadDesignStudioVial,
} from "@/services/siteDesign";
import type { ShopAreaKey } from "@/lib/shop/shopAreas";
import type { Tables } from "@/types/database";

const PREVIEW_PRODUCT: Tables<"products"> = {
  id: "00000000-0000-0000-0000-000000000001",
  code: "PREVIEW-VIAL",
  name: "Retatrutide 10mg",
  description: null,
  dosage_vial: "10mg",
  category: "peptides",
  image_path: null,
  badge_key: null,
  price_usd: 0,
  bulk_price_usd: null,
  bulk_price_min_quantity: null,
  currency: "USD",
  is_active: true,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
  last_price_change_at: null,
};

async function listProductsWithCustomVial(limit = 25) {
  const { data, error } = await supabase
    .from("products")
    .select("id, code, name, image_path, dosage_vial")
    .not("image_path", "is", null)
    .order("code")
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export default function AdminDesignStudioVialsPage() {
  const queryClient = useQueryClient();
  const siteQuery = useSiteDesign();
  const saveMutation = useSaveSiteDesign();
  const areasQuery = useQuery({ queryKey: QUERY_KEYS.adminShopAreas, queryFn: listAdminShopAreas });
  const productVialsQuery = useQuery({
    queryKey: ["admin-vial-product-assignments"] as const,
    queryFn: () => listProductsWithCustomVial(),
  });

  const savedStudio = React.useMemo(
    () => siteQuery.data?.designStudio ?? EMPTY_DESIGN_STUDIO,
    [siteQuery.data?.designStudio],
  );
  const [localStudio, setLocalStudio] = React.useState<typeof EMPTY_DESIGN_STUDIO | null>(null);
  const studio = localStudio ?? savedStudio;
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [pendingName, setPendingName] = React.useState("Neues Vial");

  async function persist(nextStudio: typeof studio) {
    const baseRecord = siteQuery.data?.configRecord ?? {};
    const merged = mergeDesignStudioIntoConfig(baseRecord, nextStudio) as unknown as SiteDesignConfig;
    await saveMutation.mutateAsync({
      enabled: siteQuery.data?.enabled ?? false,
      config: merged,
    });
    setLocalStudio(null);
  }

  async function uploadVial() {
    if (!pendingFile) {
      toast.error("Bitte zuerst eine Datei wählen.");
      return;
    }
    let uploadedPath: string | null = null;
    try {
      uploadedPath = await uploadDesignStudioVial(pendingFile);
      const entry: VialLibraryEntry = {
        id: crypto.randomUUID(),
        name: pendingName.trim() || pendingFile.name,
        path: uploadedPath,
        uploadedAt: new Date().toISOString(),
      };
      const next = {
        ...studio,
        vialLibrary: [entry, ...studio.vialLibrary],
        globalVialPath: studio.globalVialPath ?? uploadedPath,
      };
      await persist(next);
      setPendingFile(null);
      setPendingName("Neues Vial");
      toast.success("Vial hochgeladen.");
    } catch (error) {
      if (uploadedPath) {
        await deleteSiteDesignImage(uploadedPath).catch(() => undefined);
      }
      const message = error instanceof Error ? error.message : "Speichern fehlgeschlagen.";
      toast.error(message.includes("row-level security") ? `${message} (Storage oder site_design_settings)` : message);
    }
  }

  async function setGlobal(path: string) {
    await persist({ ...studio, globalVialPath: path });
    toast.success("Globales Standard-Vial gesetzt.");
  }

  async function removeEntry(entry: VialLibraryEntry) {
    const nextLib = studio.vialLibrary.filter((e) => e.id !== entry.id);
    const nextGlobal = studio.globalVialPath === entry.path ? null : studio.globalVialPath;
    await persist({ ...studio, vialLibrary: nextLib, globalVialPath: nextGlobal });
    await deleteSiteDesignImage(entry.path).catch(() => undefined);
    toast.success("Vial entfernt.");
  }

  async function setAreaVial(areaKey: ShopAreaKey, path: string) {
    const area = areasQuery.data?.find((a) => a.key === areaKey);
    if (!area) return;
    const theme = { ...(area.theme ?? {}) } as Record<string, unknown>;
    const vial = parseVialMedia(theme);
    theme.vialMedia = { ...vial, areaImage: path, categoryImages: vial.categoryImages };
    await updateAdminShopArea(areaKey, { theme });
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminShopAreas });
    toast.success("Bereichs-Vial gespeichert.");
  }

  const assignmentRows = React.useMemo(() => {
    const rows: { type: string; target: string; path: string; href?: string }[] = [];
    if (studio.globalVialPath) {
      rows.push({ type: "Global", target: "Standard-Fallback", path: studio.globalVialPath });
    }
    for (const area of areasQuery.data ?? []) {
      const vial = parseVialMedia(area.theme);
      if (vial.areaImage) {
        rows.push({ type: "Shop-Bereich", target: area.name, path: vial.areaImage });
      }
      for (const [catKey, path] of Object.entries(vial.categoryImages)) {
        if (path) rows.push({ type: "Kategorie", target: `${area.name} / ${catKey}`, path });
      }
    }
    for (const p of productVialsQuery.data ?? []) {
      if (p.image_path) {
        rows.push({
          type: "Produkt / Variante",
          target: `${p.code} — ${p.name}`,
          path: p.image_path,
          href: `/admin/products/${p.id}/edit`,
        });
      }
    }
    return rows;
  }, [areasQuery.data, productVialsQuery.data, studio.globalVialPath]);

  return (
    <div className="space-y-6">
      <AdminSection title="Vial hochladen" padded>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <Label htmlFor="vial-name">Anzeigename</Label>
            <Input id="vial-name" value={pendingName} onChange={(e) => setPendingName(e.target.value)} />
            <ImageDropzone
              previewUrl={pendingFile ? URL.createObjectURL(pendingFile) : null}
              onFile={async (file) => setPendingFile(file)}
              label="Vial-Bild"
              hint="PNG, JPG oder WebP"
            />
            <Button type="button" loading={saveMutation.isPending} onClick={() => void uploadVial()}>
              In Bibliothek speichern
            </Button>
            <p className="text-xs text-muted-foreground">
              Finaler Fallback bleibt{" "}
              <span className="font-mono">{PEPTIX_CANONICAL_VIAL_PATH}</span>
            </p>
          </div>
          <div className="max-w-xs">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Karten-Vorschau</p>
            <ShopProductImageFrame product={PREVIEW_PRODUCT} categoryLabel="Peptide" />
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Vial-Bibliothek" padded>
        {studio.vialLibrary.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Vials hochgeladen.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {studio.vialLibrary.map((entry) => {
              const url = siteDesignImageUrl(entry.path);
              const isGlobal = studio.globalVialPath === entry.path;
              return (
                <div key={entry.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex aspect-[3/4] items-end justify-center rounded-md bg-[#0a0a0f] p-2">
                    {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : null}
                  </div>
                  <p className="mt-2 text-sm font-medium">{entry.name}</p>
                  <p className="text-[10px] text-muted-foreground">{isGlobal ? "Global aktiv" : "Bibliothek"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => void setGlobal(entry.path)}>
                      Als global setzen
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => void removeEntry(entry)}>
                      Löschen
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AdminSection>

      <AdminSection title="Zuweisungen (Priorität: Produkt → Kategorie-Bilder (Design Studio) → Global-Vial → Bereich → Canonical)" padded>
        {assignmentRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Zuweisungen — nutze Globales Vial, Bereichsdesign oder{" "}
            <Link to="/admin/products" className="text-primary underline-offset-2 hover:underline">
              Produktbilder
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Typ</th>
                  <th className="py-2 pr-4">Ziel</th>
                  <th className="py-2">Pfad</th>
                </tr>
              </thead>
              <tbody>
                {assignmentRows.map((row) => (
                  <tr key={`${row.type}-${row.target}-${row.path}`} className="border-b border-border/30">
                    <td className="py-2 pr-4 font-medium">{row.type}</td>
                    <td className="py-2 pr-4">
                      {row.href ? (
                        <Link to={row.href} className="text-primary underline-offset-2 hover:underline">
                          {row.target}
                        </Link>
                      ) : (
                        row.target
                      )}
                    </td>
                    <td className="py-2 font-mono text-[11px] text-muted-foreground">{row.path}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(areasQuery.data ?? []).length > 0 && studio.vialLibrary.length > 0 ? (
          <div className="mt-4 space-y-2 border-t border-border/40 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Schnell: Bereichs-Vial</p>
            {(areasQuery.data ?? []).map((area) => (
              <div key={area.key} className="flex flex-wrap items-center gap-2">
                <span className="min-w-[8rem] text-sm">{area.name}</span>
                <Select
                  onValueChange={(path) => void setAreaVial(area.key as ShopAreaKey, path)}
                >
                  <SelectTrigger className="h-9 max-w-xs">
                    <SelectValue placeholder="Bibliothek-Vial wählen …" />
                  </SelectTrigger>
                  <SelectContent>
                    {studio.vialLibrary.map((entry) => (
                      <SelectItem key={entry.id} value={entry.path}>
                        {entry.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground">
          Kategorie-Produktbilder unter{" "}
          <Link to="/admin/design-studio/categories" className="text-primary underline-offset-2 hover:underline">
            Kategorie Bilder
          </Link>
          . Portal-Design unter Shop Bereiche. Produkt-/Varianten-Bilder unter Produktbilder.
        </p>
      </AdminSection>
    </div>
  );
}
