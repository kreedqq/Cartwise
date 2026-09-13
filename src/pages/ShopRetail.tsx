import * as React from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, PackageSearch, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ShopProductsTable } from "@/components/shop/ShopProductsTable";
import { ShopProductsMobileList } from "@/components/shop/ShopProductsMobileList";
import { AreaStorefrontChrome } from "@/components/shop/AreaStorefrontChrome";
import { ShopCategoryHub } from "@/components/shop/ShopCategoryHub";
import { PageHeader } from "@/components/common/PageHeader";
import { ShopAreaProvider } from "@/context/ShopAreaContext";
import { useMyShopAreas } from "@/hooks/useMyShopAreas";
import { useShopAreaStorefront } from "@/hooks/useShopAreaStorefront";
import { useShopProducts } from "@/hooks/useShopProducts";
import { useFavorites } from "@/hooks/useFavorites";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { cn } from "@/lib/utils";
import { productMatchesShopSearch } from "@/lib/shop/display";
import {
  countProductsByAreaCategory,
  productsInAreaCategory,
  storefrontHeadline,
  visibleStorefrontCategories,
} from "@/lib/shop/areaCategories";
import { DEFAULT_SHOP_AREA, type MyShopArea } from "@/lib/shop/shopAreas";
import { areaDensityClass, areaThemeCssVars, parseAreaTheme } from "@/lib/shop/areaTheme";
import { useShopAreaContext } from "@/context/ShopAreaContext";
import { isShopCategoryId } from "@/lib/shopCategories";

export default function ShopRetailPage({ area }: { area?: MyShopArea }) {
  const areasQuery = useMyShopAreas();
  const allowed = area
    ? true
    : (areasQuery.data?.some((item) => item.key === DEFAULT_SHOP_AREA) ?? false);
  const currentArea = area ?? areasQuery.data?.find((item) => item.key === DEFAULT_SHOP_AREA);

  if (!area && areasQuery.isLoading) return <FullScreenSpinner label="Shop wird geladen …" />;
  if (!area && areasQuery.isError) {
    return <ErrorState message="Shop-Bereiche konnten nicht geladen werden." onRetry={() => areasQuery.refetch()} />;
  }
  if (!allowed || !currentArea) return <Navigate to="/403" replace />;

  return (
    <ShopAreaProvider
      shopArea={currentArea.key}
      pricingProfile={currentArea.pricing_profile}
      theme={parseAreaTheme(currentArea.theme)}
    >
      <ShopCatalog area={currentArea} />
    </ShopAreaProvider>
  );
}

function ShopCatalog({ area }: { area: MyShopArea }) {
  const productsQuery = useShopProducts(area.key);
  const storefrontQuery = useShopAreaStorefront(area.key);
  const { theme } = useShopAreaContext();
  const favoritesQuery = useFavorites();
  const rateQuery = useExchangeRate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = React.useState("");

  const products = React.useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const assignments = React.useMemo(
    () => storefrontQuery.data?.assignments ?? [],
    [storefrontQuery.data?.assignments],
  );
  const visible = React.useMemo(
    () =>
      visibleStorefrontCategories(
        storefrontQuery.data?.categories ?? [],
        assignments,
        products.map((product) => product.id),
      ),
    [assignments, products, storefrontQuery.data?.categories],
  );
  const counts = React.useMemo(
    () => countProductsByAreaCategory(
      products.map((product) => product.id),
      assignments,
    ),
    [assignments, products],
  );
  const selectedKey = params.get("cat");
  const selected = visible.find((category) => category.category_key === selectedKey) ?? null;

  const filtered = React.useMemo(() => {
    if (!selected) return [];
    const term = search.trim();
    return productsInAreaCategory(products, assignments, selected.category_key).filter((product) =>
      productMatchesShopSearch(product, term),
    );
  }, [assignments, products, search, selected]);

  const favoriteProductIds = React.useMemo(
    () => new Set((favoritesQuery.data ?? []).map((f) => f.productId)),
    [favoritesQuery.data],
  );

  function selectCategory(key: string) {
    setSearch("");
    setParams({ cat: key });
  }

  if (!selected) {
    return (
      <div
        className={areaDensityClass(theme)}
        data-shop-area={area.key}
        style={areaThemeCssVars(theme)}
      >
        <AreaStorefrontChrome theme={theme} areaName={area.name}>
        <PageHeader
          eyebrow={area.name}
          title="Katalog"
          description="Einzelverkauf. Peptide, Water und Oils als Vials, Orals als Packungen. Keine Kits, keine Mengenstaffeln."
        />
        {(productsQuery.isLoading || storefrontQuery.isLoading) && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[200px] w-full rounded-2xl" />
            ))}
          </div>
        )}
        {(productsQuery.isError || storefrontQuery.isError) && (
          <ErrorState
            message="Produkte konnten nicht geladen werden."
            onRetry={() => {
              void productsQuery.refetch();
              void storefrontQuery.refetch();
            }}
          />
        )}
        {productsQuery.data && storefrontQuery.data && visible.length === 0 && (
          <EmptyState
            icon={PackageSearch}
            title={theme.emptyTitle || "Aktuell sind keine Produkte verfügbar."}
            description={theme.emptyDescription || undefined}
          />
        )}
        {productsQuery.data && storefrontQuery.data && visible.length > 0 && (
          <ShopCategoryHub categories={visible} counts={counts} onSelect={selectCategory} />
        )}
        </AreaStorefrontChrome>
      </div>
    );
  }

  const tableCategoryId = isShopCategoryId(selected.category_key) ? selected.category_key : undefined;

  return (
    <div className={areaDensityClass(theme)} data-shop-area={area.key} style={areaThemeCssVars(theme)}>
      <AreaStorefrontChrome theme={theme} areaName={area.name}>
      <PageHeader
        eyebrow={area.name}
        title={selected.label}
        description={`${filtered.length} Artikel · Einzelmenge wählen und in den Warenkorb legen.`}
        actions={
          <Button variant="ghost" size="sm" onClick={() => setParams({})} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Alle Kategorien
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {visible.map((category) => (
          <button
            key={category.category_key}
            type="button"
            onClick={() => selectCategory(category.category_key)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
              category.category_key === selected.category_key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            {storefrontHeadline(category.label)}
          </button>
        ))}
      </div>

      <div className="relative w-full max-w-3xl">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={theme.searchPlaceholder || "Produktname suchen …"}
          className="h-11 pl-8"
        />
      </div>

      {productsQuery.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {productsQuery.isError && (
        <ErrorState message="Produkte konnten nicht geladen werden." onRetry={() => productsQuery.refetch()} />
      )}

      {productsQuery.data && products.length === 0 && (
        <EmptyState icon={PackageSearch} title="Aktuell sind keine Produkte verfügbar." />
      )}

      {productsQuery.data && products.length > 0 && filtered.length === 0 && (
        <EmptyState icon={PackageSearch} title="Keine Produkte gefunden." description="Passe deine Suche an." />
      )}

      {filtered.length > 0 && (
        <>
          <div className="hidden lg:block">
            <ShopProductsTable
              products={filtered}
              rate={rateQuery.data?.rate ?? null}
              favoriteProductIds={favoriteProductIds}
              categoryId={tableCategoryId}
              categoryLabel={selected.label}
              pricingProfile={area.pricing_profile}
            />
          </div>
          <div className="lg:hidden">
            <ShopProductsMobileList
              products={filtered}
              rate={rateQuery.data?.rate ?? null}
              favoriteProductIds={favoriteProductIds}
              categoryId={tableCategoryId}
              pricingProfile={area.pricing_profile}
            />
          </div>
        </>
      )}
      </AreaStorefrontChrome>
    </div>
  );
}
