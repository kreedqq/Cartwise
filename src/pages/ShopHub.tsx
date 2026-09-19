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
    <div className="relative -mx-4 min-h-[calc(100vh-12rem)] px-4 pb-12 pt-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="relative space-y-8 sm:space-y-10">
        <header className="mx-auto max-w-2xl space-y-2 text-center sm:text-left">
          <p className={UI_TYPE.eyebrow}>PEPTIX</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
            Betrete deine Welt
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Jeder Verkaufsbereich ist ein eigenes Portal — wähle dein Ziel und betrete die Welt.
          </p>
        </header>
        <section className="space-y-4">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-left">
            Portal-Galerie
          </p>
          <div className="grid grid-cols-1 gap-10 sm:gap-12 lg:grid-cols-2 lg:gap-x-14 lg:gap-y-16">
            {areas.map((area, index) => {
              const copy = shopAreaPortalProps(area);
              return (
                <div
                  key={area.key}
                  className={index % 2 === 1 ? "lg:translate-y-8" : undefined}
                >
                  <ShopAreaPortal
                    layout="hub"
                    href={area.path}
                    title={copy.title}
                    description={copy.description}
                    accentHex={copy.accentHex}
                    glow={copy.portal.glow}
                    atmosphere={copy.portal.atmosphere}
                    backgroundImageUrl={copy.backgroundImageUrl}
                    portalAssetUrl={copy.portalAssetUrl}
                    icon={<AreaGlyph iconKey={area.icon_key} className="h-5 w-5" />}
                    badge={area.badge_text}
                    metaLabel={copy.metaLabel}
                    ctaLabel={copy.ctaLabel}
                    disabled={copy.disabled}
                    priorityImage={index === 0}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
