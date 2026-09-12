import { Navigate, useParams } from "react-router-dom";
import { Store } from "lucide-react";

import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { PageHeader } from "@/components/common/PageHeader";
import { ShopAreaProvider } from "@/context/ShopAreaContext";
import { useMyShopAreas } from "@/hooks/useMyShopAreas";
import { parseAreaTheme } from "@/lib/shop/areaTheme";
import GroupBuyPage from "@/pages/GroupBuy";
import ShopRetailPage from "@/pages/ShopRetail";

export default function ShopAreaPage() {
  const { slug } = useParams<{ slug: string }>();
  const areasQuery = useMyShopAreas();

  if (areasQuery.isLoading) return <FullScreenSpinner label="Shop wird geladen …" />;
  if (areasQuery.isError) {
    return <ErrorState message="Shop-Bereiche konnten nicht geladen werden." onRetry={() => areasQuery.refetch()} />;
  }

  const area = (areasQuery.data ?? []).find((item) => item.slug === slug);
  if (!area) return <Navigate to="/403" replace />;

  if (!area.purchasable) {
    const comingSoon = area.status === "coming_soon";
    return (
      <div className="space-y-8">
        <PageHeader eyebrow={area.short_name || area.name} title={area.name} description={area.subtitle ?? undefined} />
        <EmptyState
          icon={Store}
          title={comingSoon ? "Bald verfügbar" : "Dieser Bereich ist derzeit nicht geöffnet."}
          description={area.description ?? "Produkte können hier noch nicht bestellt werden."}
        />
      </div>
    );
  }

  const theme = parseAreaTheme(area.theme);
  return (
    <ShopAreaProvider shopArea={area.key} pricingProfile={area.pricing_profile} theme={theme}>
      {area.pricing_profile === "group_buy" ? <GroupBuyPage area={area} /> : <ShopRetailPage area={area} />}
    </ShopAreaProvider>
  );
}
