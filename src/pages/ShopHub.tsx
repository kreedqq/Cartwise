import * as React from "react";
import { Navigate, Link } from "react-router-dom";

import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { useMyShopAreas } from "@/hooks/useMyShopAreas";
import { AreaGlyph } from "@/lib/shop/areaIcons";
import { parseAreaTheme } from "@/lib/shop/areaTheme";
import { isGroupBuyPricing, type MyShopArea } from "@/lib/shop/shopAreas";
import { siteDesignImageUrl } from "@/services/siteDesign";

export default function ShopHubPage() {
  const areasQuery = useMyShopAreas();

  if (areasQuery.isLoading) return <FullScreenSpinner label="Shop wird geladen …" />;
  if (areasQuery.isError) {
    return <ErrorState message="Shop-Bereiche konnten nicht geladen werden." onRetry={() => areasQuery.refetch()} />;
  }

  const areas = areasQuery.data ?? [];
  if (areas.length === 0) return <Navigate to="/403" replace />;

  if (areas.length === 1) {
    return <Navigate to={areas[0].path} replace />;
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Peptix"
        title="Shop"
        description="Wähle einen Verkaufsbereich."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map((area) => (
          <ShopAreaCard key={area.key} area={area} />
        ))}
      </div>
    </div>
  );
}

function ShopAreaCard({ area }: { area: MyShopArea }) {
  const theme = parseAreaTheme(area.theme);
  const subtitle =
    theme.hub.description ||
    area.subtitle ||
    (isGroupBuyPricing(area.pricing_profile)
      ? "Gemeinsamer Einkauf · Kits · Anteile"
      : "Einzelverkauf · Vials · Packungen");
  const hubImage = theme.hub.image
    ? theme.hub.image.startsWith("http") || theme.hub.image.startsWith("/")
      ? theme.hub.image
      : siteDesignImageUrl(theme.hub.image)
    : null;

  return (
    <Link
      to={area.path}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/60 hover:bg-card/80"
    >
      {hubImage ? <img src={hubImage} alt="" className="h-28 w-full object-cover" /> : null}
      <div className="flex flex-col gap-3 p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <AreaGlyph iconKey={area.icon_key} className="h-5 w-5" />
          </span>
          <p className="text-base font-semibold">{theme.hub.title || area.name}</p>
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
        {area.badge_text ? (
          <Badge variant="secondary" className="w-fit">
            {area.badge_text}
          </Badge>
        ) : null}
        {area.status === "coming_soon" ? (
          <p className="text-xs font-medium text-primary">Bald verfügbar</p>
        ) : (
          <p className="text-xs font-medium text-primary">Entdecken</p>
        )}
      </div>
    </Link>
  );
}
