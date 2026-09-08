import * as React from "react";
import { Navigate, Link } from "react-router-dom";
import { ShoppingBag, Users } from "lucide-react";

import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { PageHeader } from "@/components/common/PageHeader";
import { useMyShopAreas } from "@/hooks/useMyShopAreas";
import { isGroupBuyAreaKey, SHOP_AREA_PATHS, type MyShopArea } from "@/lib/shop/shopAreas";

export default function ShopHubPage() {
  const areasQuery = useMyShopAreas();

  if (areasQuery.isLoading) return <FullScreenSpinner label="Shop wird geladen …" />;
  if (areasQuery.isError) {
    return <ErrorState message="Shop-Bereiche konnten nicht geladen werden." onRetry={() => areasQuery.refetch()} />;
  }

  const areas = areasQuery.data ?? [];
  if (areas.length === 0) return <Navigate to="/403" replace />;

  // If only one area, redirect directly to it
  if (areas.length === 1) {
    return <Navigate to={SHOP_AREA_PATHS[areas[0].key]} replace />;
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
  const isGB = isGroupBuyAreaKey(area.key);
  const Icon = isGB ? Users : ShoppingBag;
  const subtitle = isGB ? "Gemeinsamer Einkauf · Kits · Anteile" : "Einzelverkauf · Vials · Packungen";
  const path = SHOP_AREA_PATHS[area.key];

  return (
    <Link
      to={path}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/60 hover:bg-card/80"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <p className="text-base font-semibold">{area.name}</p>
      </div>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </Link>
  );
}
