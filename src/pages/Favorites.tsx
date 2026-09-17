import * as React from "react";
import { Star } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { ShopProductGrid } from "@/components/shop/ShopProductGrid";
import { ShopAreaProvider } from "@/context/ShopAreaContext";
import { DEFAULT_SHOP_AREA } from "@/lib/shop/shopAreas";
import { useFavorites } from "@/hooks/useFavorites";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { PageHeader } from "@/components/common/PageHeader";
import type { Tables } from "@/types/database";

export default function FavoritesPage() {
  const favoritesQuery = useFavorites();
  const rateQuery = useExchangeRate();

  const products = React.useMemo(
    () =>
      (favoritesQuery.data ?? [])
        .map((f) => f.product)
        .filter((p): p is Tables<"products"> => p != null),
    [favoritesQuery.data],
  );
  const favoriteProductIds = React.useMemo(() => new Set(products.map((p) => p.id)), [products]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Favoriten"
        title="Meine Artikel"
        description="Gespeicherte Artikel für besonders schnelle Bestellungen."
      />

      {favoritesQuery.isLoading && (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4 xl:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[17rem] w-full rounded-xl sm:h-[18rem]" />
          ))}
        </div>
      )}

      {favoritesQuery.isError && (
        <ErrorState message="Favoriten konnten nicht geladen werden." onRetry={() => favoritesQuery.refetch()} />
      )}

      {favoritesQuery.data && products.length === 0 && (
        <EmptyState
          icon={Star}
          title="Du hast noch keine Artikel gespeichert."
          description='Klicke im Shop auf den Stern eines Produkts, um es hier zu speichern.'
        />
      )}

      {products.length > 0 && (
        <ShopAreaProvider shopArea={DEFAULT_SHOP_AREA} pricingProfile="retail">
          <ShopProductGrid
            products={products}
            rate={rateQuery.data?.rate ?? null}
            favoriteProductIds={favoriteProductIds}
            pricingProfile="retail"
          />
        </ShopAreaProvider>
      )}
    </div>
  );
}
