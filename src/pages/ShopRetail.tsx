import * as React from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, PackageSearch } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ShopCatalogFiltersSheet } from "@/components/shop/ShopCatalogFiltersSheet";
import { ShopCatalogHeader } from "@/components/shop/ShopCatalogHeader";
import { ShopCatalogToolbar } from "@/components/shop/ShopCatalogToolbar";
import { ShopCatalogBreadcrumbs } from "@/components/shop/ShopCatalogBreadcrumbs";
import { ShopProductGrid } from "@/components/shop/ShopProductGrid";
import { parseShopCatalogSort, type ShopCatalogSort } from "@/lib/shop/catalogSort";
import { AreaStorefrontChrome } from "@/components/shop/AreaStorefrontChrome";
import { ShopCategoryHub } from "@/components/shop/ShopCategoryHub";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AREA_PAGE_CONTENT_SLOT, AREA_PAGE_RHYTHM } from "@/lib/shop/areaLayout";
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
import { portalConfigFromAreaTheme } from "@/lib/shop/areaPortal";
import { parseCategoryPortalOverrides, parseVialMedia } from "@/lib/shop/portalAssets";
import { areaDensityClass, areaThemeCssVars, parseAreaTheme } from "@/lib/shop/areaTheme";
import { useShopAreaContext } from "@/context/ShopAreaContext";
import { isShopCategoryId } from "@/lib/shopCategories";
import { buildShopCatalogSearchParams, readShopCatalogUrlState } from "@/lib/shop/shopCatalogUrlState";

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

  // When area prop is provided, ShopAreaPage already wraps with ShopAreaProvider — avoid double-nesting
  if (area) return <ShopCatalog area={area} />;

  return (
    <ShopAreaProvider
      shopArea={currentArea.key}
      pricingProfile={currentArea.pricing_profile}
      theme={parseAreaTheme(currentArea.theme)}
      portal={portalConfigFromAreaTheme(currentArea.theme)}
      categoryPortals={parseCategoryPortalOverrides(currentArea.theme)}
      vialMedia={parseVialMedia(currentArea.theme)}
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
  const urlCatalog = React.useMemo(() => readShopCatalogUrlState(params), [params]);
  const [searchDraft, setSearchDraft] = React.useState(urlCatalog.search);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const favoritesOnly = params.get("favorites") === "1";

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
  const selected = visible.find((category) => category.category_key === urlCatalog.categoryKey) ?? null;

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional URL → input sync
    setSearchDraft(urlCatalog.search);
  }, [urlCatalog.search]);

  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = buildShopCatalogSearchParams(params, { search: searchDraft });
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchDraft, params, setParams]);

  const favoriteProductIds = React.useMemo(
    () => new Set((favoritesQuery.data ?? []).map((f) => f.productId)),
    [favoritesQuery.data],
  );

  const filtered = React.useMemo(() => {
    if (!selected) return [];
    const term = urlCatalog.search.trim();
    let list = productsInAreaCategory(products, assignments, selected.category_key).filter((product) =>
      productMatchesShopSearch(product, term),
    );
    if (favoritesOnly) {
      list = list.filter((product) => favoriteProductIds.has(product.id));
    }
    return list;
  }, [assignments, products, selected, urlCatalog.search, favoritesOnly, favoriteProductIds]);

  function selectCategory(key: string) {
    setSearchDraft("");
    setParams(buildShopCatalogSearchParams(params, { categoryKey: key, search: "" }), { replace: true });
  }

  if (!selected) {
    return (
      <div
        className={areaDensityClass(theme)}
        data-shop-area={area.key}
        style={areaThemeCssVars(theme)}
      >
        <AreaStorefrontChrome theme={theme} areaName={area.name}>
        <div className={AREA_PAGE_RHYTHM}>
        <ShopCatalogBreadcrumbs items={[{ label: "Shop", href: "/shop" }, { label: area.name }]} className="mb-3" />
        <div className={AREA_PAGE_CONTENT_SLOT}>
        {(productsQuery.isLoading || storefrontQuery.isLoading) && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="mx-auto h-[220px] w-full max-w-[20rem] rounded-none bg-muted/30" />
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
        </div>
        </div>
        </AreaStorefrontChrome>
      </div>
    );
  }

  const tableCategoryId = isShopCategoryId(selected.category_key) ? selected.category_key : undefined;

  return (
    <div className={areaDensityClass(theme)} data-shop-area={area.key} style={areaThemeCssVars(theme)}>
      <AreaStorefrontChrome theme={theme} areaName={area.name}>
      <div className={AREA_PAGE_RHYTHM}>
      <ShopCatalogBreadcrumbs
        items={[
          { label: "Shop", href: "/shop" },
          { label: area.name, href: area.path },
          { label: storefrontHeadline(selected.label) },
        ]}
        className="mb-2"
      />
      <ShopCatalogHeader
        eyebrow="Produktwelt"
        title={storefrontHeadline(selected.label)}
        productCount={filtered.length}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setParams(buildShopCatalogSearchParams(params, { categoryKey: null, search: "" }), { replace: true })}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Kategorien
          </Button>
        }
      />

      <div className={`${AREA_PAGE_CONTENT_SLOT} space-y-4`}>
      <ShopCatalogToolbar
        searchValue={searchDraft}
        onSearchChange={setSearchDraft}
        searchPlaceholder={theme.searchPlaceholder || "Produktname suchen …"}
        filterActive={favoritesOnly}
        onOpenFilters={() => setFiltersOpen(true)}
        sortValue={parseShopCatalogSort(urlCatalog.sort)}
        onSortChange={(sort: ShopCatalogSort) =>
          setParams(buildShopCatalogSearchParams(params, { sort }), { replace: true })
        }
        categoryPills={visible.map((category) => (
          <button
            key={category.category_key}
            type="button"
            onClick={() => selectCategory(category.category_key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              category.category_key === selected.category_key
                ? "bg-primary text-primary-foreground"
                : "bg-muted/80 text-muted-foreground hover:bg-muted",
            )}
          >
            {storefrontHeadline(category.label)}
          </button>
        ))}
      />
      <ShopCatalogFiltersSheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="retail-favorites-only" className="text-sm">
            Nur Favoriten
          </Label>
          <Switch
            id="retail-favorites-only"
            checked={favoritesOnly}
            onCheckedChange={(checked) => {
              const next = new URLSearchParams(params);
              if (checked) next.set("favorites", "1");
              else next.delete("favorites");
              setParams(next, { replace: true });
            }}
          />
        </div>
      </ShopCatalogFiltersSheet>

      {productsQuery.isLoading && (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4 xl:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[17rem] w-full rounded-xl sm:h-[18rem]" />
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
        <ShopProductGrid
          products={filtered}
          rate={rateQuery.data?.rate ?? null}
          rateLoading={rateQuery.isFetching && rateQuery.data?.rate == null}
          favoriteProductIds={favoriteProductIds}
          categoryId={tableCategoryId}
          categoryLabel={selected.label}
          categoryAssignments={assignments}
          pricingProfile={area.pricing_profile}
          sort={urlCatalog.sort}
        />
      )}
      </div>
      </div>
      </AreaStorefrontChrome>
    </div>
  );
}
