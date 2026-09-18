import { Navigate } from "react-router-dom";

import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { ShopAreaPortal } from "@/components/shop/ShopAreaPortal";
import { AreaGlyph } from "@/lib/shop/areaIcons";
import { shopAreaPortalProps } from "@/lib/shop/areaPortal";
import { UI_TYPE } from "@/lib/design/tokens";
import { useMyShopAreas } from "@/hooks/useMyShopAreas";

export default function ShopHubPage() {
  const areasQuery = useMyShopAreas();

  if (areasQuery.isLoading) return <FullScreenSpinner label="Shop wird geladen …" />;
  if (areasQuery.isError) {
    return <ErrorState message="Shop-Bereiche konnten nicht geladen werden." onRetry={() => areasQuery.refetch()} />;
  }

  const areas = areasQuery.data ?? [];
  if (areas.length === 0) return <Navigate to="/403" replace />;
  if (areas.length === 1) return <Navigate to={areas[0].path} replace />;

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="space-y-2">
        <p className={UI_TYPE.eyebrow}>PEPTIX</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Premium Research Marketplace</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Wähle einen Verkaufsbereich — jeder Bereich ist ein eigenes Portal in die Produktwelt.
        </p>
      </header>
      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Verkaufsbereiche</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {areas.map((area) => {
            const copy = shopAreaPortalProps(area);
            return (
              <ShopAreaPortal
                key={area.key}
                layout="hub"
                href={area.path}
                title={copy.title}
                description={copy.description}
                accentHex={copy.accentHex}
                glow={copy.portal.glow}
                atmosphere={copy.portal.atmosphere}
                backgroundImageUrl={copy.backgroundImageUrl}
                focalImageUrl={copy.focalImageUrl}
                icon={<AreaGlyph iconKey={area.icon_key} className="h-5 w-5" />}
                badge={area.badge_text}
                metaLabel={copy.metaLabel}
                ctaLabel={copy.ctaLabel}
                disabled={copy.disabled}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
