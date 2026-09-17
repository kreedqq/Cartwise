import { Navigate } from "react-router-dom";

import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { ShopAreaShowcase } from "@/components/shop/ShopAreaShowcase";
import { PAGE_BLEED_PAD, PAGE_BLEED_TOP, UI_TYPE } from "@/lib/design/tokens";
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
    <div className="space-y-10">
      <section className={cn(PAGE_BLEED_TOP, "relative overflow-hidden border-b border-primary/20")}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(820px_300px_at_80%_0%,hsl(var(--primary)/0.14),transparent_55%)]"
        />
        <div className={cn(PAGE_BLEED_PAD, "relative py-10 lg:py-14")}>
          <p className={UI_TYPE.eyebrow}>Shop</p>
          <h1 className="mt-3 max-w-3xl font-display text-[clamp(2rem,4.5vw,3.6rem)] font-semibold leading-[0.94] tracking-tight">
            Entdecke deine PEPTIX Verkaufsbereiche
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Retail für den direkten Einzelkauf. Group Buy, wenn du ein Kit teilst und nur deinen Anteil zahlst.
          </p>
        </div>
      </section>
      <ShopAreaShowcase areas={areas} heading="Wähle einen Bereich" />
    </div>
  );
}
