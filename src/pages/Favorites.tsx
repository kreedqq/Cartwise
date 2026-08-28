import * as React from "react";
import { Star } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { ShopProductsTable } from "@/components/shop/ShopProductsTable";
import { ShopProductsMobileList } from "@/components/shop/ShopProductsMobileList";
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
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
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
        <>
          <div className="hidden lg:block">
            <ShopProductsTable products={products} rate={rateQuery.data?.rate ?? null} favoriteProductIds={favoriteProductIds} />
          </div>
          <div className="lg:hidden">
            <ShopProductsMobileList
              products={products}
              rate={rateQuery.data?.rate ?? null}
              favoriteProductIds={favoriteProductIds}
            />
          </div>
        </>
      )}
    </div>
  );
}
