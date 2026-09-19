import * as React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { PortalAssetPicker } from "@/components/admin/PortalAssetPicker";
import { AdminSection } from "@/components/admin/AdminSection";
import { ShopAreaPortal } from "@/components/shop/ShopAreaPortal";
import { ShopPortalWorldBackground } from "@/components/shop/ShopPortalWorldBackground";
import { portalConfigFromAreaTheme } from "@/lib/shop/areaPortal";
import {
  isBuiltinPortalAssetId,
  parseCategoryPortalOverrides,
  type BuiltinPortalAssetId,
  portalAssetById,
  resolvePortalAssetPublicUrl,
} from "@/lib/shop/portalAssets";
import { QUERY_KEYS } from "@/lib/constants";
import { listAdminShopAreas } from "@/services/shopAreas";

export default function AdminDesignStudioPortalsPage() {
  const [previewAsset, setPreviewAsset] = React.useState<BuiltinPortalAssetId | "">("portal_cyan");
  const areasQuery = useQuery({
    queryKey: QUERY_KEYS.adminShopAreas,
    queryFn: listAdminShopAreas,
  });

  const areas = areasQuery.data ?? [];
  const assignments = areas.map((area) => {
    const portal = portalConfigFromAreaTheme(area.theme);
    const label = portal.assetId && isBuiltinPortalAssetId(portal.assetId)
      ? portalAssetById(portal.assetId)?.colorLabel
      : portal.customAsset
        ? "Custom"
        : "Standard";
    return { key: area.key, name: area.name, label, portal };
  });

  const accent = previewAsset ? portalAssetById(previewAsset)?.accentHex ?? "#c9a227" : "#c9a227";
  const previewUrl = resolvePortalAssetPublicUrl({ assetId: previewAsset || undefined });

  return (
    <div className="space-y-6">
      <AdminSection title="Built-in Portale" padded>
        <PortalAssetPicker value={previewAsset} onChange={setPreviewAsset} />
        <div className="relative mt-4 max-w-xl py-4">
          <ShopPortalWorldBackground accentHex={accent} intensity="hub" className="rounded-lg" />
          <ShopAreaPortal
            layout="hub"
            title="Live-Vorschau"
            description="Dieselbe ShopAreaPortal-Komponente wie auf /shop."
            href="#"
            accentHex={accent}
            portalAssetUrl={previewUrl}
            disabled
            ctaLabel="Betreten"
          />
        </div>
      </AdminSection>

      <AdminSection title="Zuweisungen (Shop-Bereiche)" padded>
        {areasQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Lade Bereiche …</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {assignments.map((row) => (
              <li key={row.key} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 py-2">
                <span className="font-medium">{row.name}</span>
                <span className="text-muted-foreground">{row.label ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Portal pro Bereich und Kategorie bearbeiten unter{" "}
          <Link to="/admin/shop-areas" className="text-primary underline-offset-2 hover:underline">
            Verkaufsbereiche → Bereichsdesign → Portal
          </Link>
          .
        </p>
      </AdminSection>

      <AdminSection title="Kategorie-Zuweisungen" padded>
        {areasQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Lade …</p>
        ) : (
          (() => {
            const catRows = (areasQuery.data ?? []).flatMap((area) => {
              const overrides = parseCategoryPortalOverrides(area.theme);
              return Object.entries(overrides)
                .filter(([, v]) => v.assetId?.trim())
                .map(([catKey, v]) => ({ area, catKey, v }));
            });
            if (catRows.length === 0) {
              return <p className="text-sm text-muted-foreground">Noch keine Kategorie-Portale gesetzt.</p>;
            }
            return (
              <ul className="space-y-2 text-sm">
                {catRows.map(({ area, catKey, v }) => (
                  <li
                    key={`${area.key}-${catKey}`}
                    className="flex flex-wrap justify-between gap-2 border-b border-border/40 py-2"
                  >
                    <span>
                      {area.name} / <span className="font-mono text-xs">{catKey}</span>
                    </span>
                    <span className="text-muted-foreground">
                      {portalAssetById(v.assetId)?.colorLabel ?? v.assetId}
                    </span>
                  </li>
                ))}
              </ul>
            );
          })()
        )}
      </AdminSection>
    </div>
  );
}
