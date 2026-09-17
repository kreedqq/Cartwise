import { Navigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { ShopCatalogHero } from "@/components/shop/ShopCatalogHero";
import { AreaGlyph } from "@/lib/shop/areaIcons";
import { parseAreaTheme } from "@/lib/shop/areaTheme";
import { isGroupBuyPricing, type MyShopArea } from "@/lib/shop/shopAreas";
import { UI_TYPE } from "@/lib/design/tokens";
import { useMyShopAreas } from "@/hooks/useMyShopAreas";
import { cn } from "@/lib/utils";

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
    <div className="space-y-5 sm:space-y-6">
      <ShopCatalogHero
        compact
        title="Premium Peptide Katalog"
        subtitle="Retail oder Group Buy — direkt in den Katalog."
      />
      <section className="space-y-3">
        <div>
          <p className={UI_TYPE.eyebrow}>Verkaufsbereiche</p>
          <h2 className="mt-2 font-display text-xl font-semibold tracking-tight sm:text-2xl">Direkt einkaufen</h2>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => (
            <AreaEntry key={area.key} area={area} />
          ))}
        </div>
      </section>
    </div>
  );
}

function AreaEntry({ area }: { area: MyShopArea }) {
  const theme = parseAreaTheme(area.theme);
  const isGb = isGroupBuyPricing(area.pricing_profile);
  return (
    <Link
      to={area.path}
      className={cn(
        "group flex items-center gap-4 rounded-xl border border-border/40 bg-gradient-to-br from-card/40 to-background/20 p-4",
        "transition-colors hover:border-primary/40 hover:from-primary/5",
      )}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <AreaGlyph iconKey={area.icon_key} className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-semibold tracking-tight">{theme.hub.title || area.name}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {theme.hub.description ||
            area.subtitle ||
            (isGb ? "Kits teilen · nur den eigenen Anteil zahlen" : "Einzelverkauf · Vials · Packungen")}
        </p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
