import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, PackageSearch, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ShopProductsTable } from "@/components/shop/ShopProductsTable";
import { ShopProductsMobileList } from "@/components/shop/ShopProductsMobileList";
import { ShopCategoryHub } from "@/components/shop/ShopCategoryHub";
import { PageHeader } from "@/components/common/PageHeader";
import { useShopProducts } from "@/hooks/useShopProducts";
import { useFavorites } from "@/hooks/useFavorites";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { hasBulkTier } from "@/lib/money";
import { cn } from "@/lib/utils";
import { productMatchesShopSearch } from "@/lib/shop/display";
import {
  countProductsByShopCategory,
  isShopCategoryId,
  productInShopCategory,
  shopCategoryById,
  SHOP_CATEGORIES,
  type ShopCategoryId,
} from "@/lib/shopCategories";

export default function ShopPage() {
  const productsQuery = useShopProducts();
  const favoritesQuery = useFavorites();
  const rateQuery = useExchangeRate();
  const [params, setParams] = useSearchParams();
  const selected = isShopCategoryId(params.get("cat")) ? (params.get("cat") as ShopCategoryId) : null;

  const [search, setSearch] = React.useState("");
  const [bulkOnly, setBulkOnly] = React.useState(false);

  const products = React.useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const counts = React.useMemo(() => (products.length ? countProductsByShopCategory(products) : null), [products]);

  const filtered = React.useMemo(() => {
    if (!selected) return [];
    const term = search.trim();
    return products.filter((p) => {
      if (!productInShopCategory(p, selected)) return false;
      if (bulkOnly && !hasBulkTier(p)) return false;
      return productMatchesShopSearch(p, term);
    });
  }, [products, search, selected, bulkOnly]);

  const favoriteProductIds = React.useMemo(
    () => new Set((favoritesQuery.data ?? []).map((f) => f.productId)),
    [favoritesQuery.data],
  );

  function selectCategory(id: ShopCategoryId) {
    setSearch("");
    setBulkOnly(false);
    setParams({ cat: id });
  }

  if (!selected) {
    return (
      <div className="space-y-10">
        <PageHeader
          eyebrow="Shop"
          title="Katalog"
          description="Wähle eine Kategorie. BAC Water und AA Water liegen unter Reconstitution Water."
        />
        {productsQuery.isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[200px] w-full rounded-2xl" />
            ))}
          </div>
        )}
        {productsQuery.isError && (
          <ErrorState message="Produkte konnten nicht geladen werden." onRetry={() => productsQuery.refetch()} />
        )}
        {productsQuery.data && <ShopCategoryHub counts={counts} onSelect={selectCategory} />}
      </div>
    );
  }

  const active = shopCategoryById(selected);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Shop"
        title={active.label}
        description={`${filtered.length} Artikel · Variante und Menge wählen, dann in den Warenkorb legen.`}
        actions={
          <Button variant="ghost" size="sm" onClick={() => setParams({})} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Alle Kategorien
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {SHOP_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => selectCategory(category.id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
              category.id === selected
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            {category.headline}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Produktname suchen …"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="bulk-only" checked={bulkOnly} onCheckedChange={(v) => setBulkOnly(v === true)} />
          <Label htmlFor="bulk-only" className="cursor-pointer text-sm font-normal text-muted-foreground">
            Nur mit Mengenpreis
          </Label>
        </div>
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
        <EmptyState icon={PackageSearch} title="Keine Produkte gefunden." description="Passe deine Suche oder Filter an." />
      )}

      {filtered.length > 0 && (
        <>
          <div className="hidden lg:block">
            <ShopProductsTable products={filtered} rate={rateQuery.data?.rate ?? null} favoriteProductIds={favoriteProductIds} />
          </div>
          <div className="lg:hidden">
            <ShopProductsMobileList
              products={filtered}
              rate={rateQuery.data?.rate ?? null}
              favoriteProductIds={favoriteProductIds}
            />
          </div>
        </>
      )}
    </div>
  );
}
