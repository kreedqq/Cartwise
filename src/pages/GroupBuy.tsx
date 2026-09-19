import * as React from "react";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Layers, PackageSearch, Search } from "lucide-react";

import { ShopCatalogHeader } from "@/components/shop/ShopCatalogHeader";
import { ShopCatalogToolbar } from "@/components/shop/ShopCatalogToolbar";
import { ShopProductGrid } from "@/components/shop/ShopProductGrid";
import { parseShopCatalogSort, type ShopCatalogSort } from "@/lib/shop/catalogSort";
import { AreaStorefrontChrome } from "@/components/shop/AreaStorefrontChrome";
import { ShopCategoryHub } from "@/components/shop/ShopCategoryHub";
import { CreateKitRequestDialog } from "@/components/kit-requests/CreateKitRequestDialog";
import { JoinKitRequestDialog } from "@/components/kit-requests/JoinKitRequestDialog";
import { KitRequestCardView } from "@/components/kit-requests/KitRequestCard";
import { KitRequestFilterBar } from "@/components/kit-requests/KitRequestFilterBar";
import { CreateKitRequestButton, KitAreaActionNav, KitRequestHint } from "@/components/kit-requests/KitRequestIntro";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { AreaSectionHeader } from "@/components/common/PageHeader";
import { KitMarketplaceHero } from "@/components/kit-requests/KitMarketplaceHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import {
  useCancelKitRequest,
  useCanUseKitRequests,
  useLeaveKitRequest,
  useMyKitRequestParticipations,
  useMyKitRequests,
  useOpenKitRequests,
  useSyncKitRequestCarts,
  type OpenKitRequestFilters,
} from "@/hooks/useKitRequests";
import { useMyShopAreas } from "@/hooks/useMyShopAreas";
import { useShopAreaStorefront } from "@/hooks/useShopAreaStorefront";
import { useShopProducts } from "@/hooks/useShopProducts";
import { useFavorites } from "@/hooks/useFavorites";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useShopCart } from "@/hooks/useShopCart";
import { KitRequestDetailDialog } from "@/components/kit-requests/KitRequestDetailDialog";
import { ShopAreaProvider, useShopAreaContext } from "@/context/ShopAreaContext";
import {
  isGroupBuyPricing,
  type MyShopArea,
  type ShopAreaKey,
} from "@/lib/shop/shopAreas";
import { ShopCatalogBreadcrumbs } from "@/components/shop/ShopCatalogBreadcrumbs";
import { portalConfigFromAreaTheme } from "@/lib/shop/areaPortal";
import { parseCategoryPortalOverrides, parseVialMedia } from "@/lib/shop/portalAssets";
import { areaDensityClass, parseAreaTheme } from "@/lib/shop/areaTheme";
import {
  KIT_REQUEST_CARD_GRID,
  KIT_REQUEST_TAB_TRIGGER_CLASS,
  KIT_REQUEST_TABS_LIST_CLASS,
  kitRequestStatusLabel,
  type KitRequestSort,
} from "@/lib/kitRequests";
import {
  AREA_KIT_REQUESTS_DESCRIPTION,
  AREA_PAGE_CONTENT_SLOT,
  AREA_PAGE_RHYTHM,
} from "@/lib/shop/areaLayout";
import { shopGroupsForCategory, productMatchesShopSearch, variantLabelForProduct } from "@/lib/shop/display";
import {
  buildShopCatalogSearchParams,
  readShopCatalogUrlState,
} from "@/lib/shop/shopCatalogUrlState";
import {
  catalogProductsForKitFilters,
  countProductsByAreaCategory,
  productsInAreaCategory,
  storefrontHeadline,
  visibleStorefrontCategories,
  type AreaCategory,
  type AreaCategoryAssignment,
} from "@/lib/shop/areaCategories";
import { isShopCategoryId } from "@/lib/shopCategories";
import { cn } from "@/lib/utils";
import type { KitRequestCard } from "@/services/kitRequests";
import type { Tables } from "@/types/database";

const PAGE_SIZE = 20;

export default function GroupBuyPage({ area }: { area?: MyShopArea }) {
  const { slug } = useParams<{ slug: string }>();
  const areasQuery = useMyShopAreas();

  if (!area && areasQuery.isLoading) return <FullScreenSpinner label="Group Buy wird geladen …" />;
  if (!area && areasQuery.isError) {
    return <ErrorState message="Shop-Bereiche konnten nicht geladen werden." onRetry={() => areasQuery.refetch()} />;
  }

  const current =
    area ??
    (areasQuery.data ?? []).find(
      (item) => item.slug === slug && isGroupBuyPricing(item.pricing_profile),
    );
  if (!current || !isGroupBuyPricing(current.pricing_profile)) return <Navigate to="/403" replace />;
  const areaSlug = current.slug ?? slug;
  if (!areaSlug) return <Navigate to="/403" replace />;

  const content = (
    <GroupBuyContent
      shopArea={current.key}
      areaSlug={areaSlug}
      areaName={current.name}
      areaDescription={current.subtitle}
    />
  );

  // When area prop is provided, ShopAreaPage already wraps with ShopAreaProvider — avoid double-nesting
  if (area) return content;

  return (
    <ShopAreaProvider
      shopArea={current.key}
      pricingProfile="group_buy"
      theme={parseAreaTheme(current.theme)}
      portal={portalConfigFromAreaTheme(current.theme)}
      categoryPortals={parseCategoryPortalOverrides(current.theme)}
      vialMedia={parseVialMedia(current.theme)}
    >
      {content}
    </ShopAreaProvider>
  );
}

function GroupBuyContent({
  shopArea,
  areaSlug,
  areaName,
  areaDescription,
}: {
  shopArea: ShopAreaKey;
  areaSlug: string;
  areaName: string;
  areaDescription?: string | null;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { theme } = useShopAreaContext();
  const productsQuery = useShopProducts(shopArea);
  const storefrontQuery = useShopAreaStorefront(shopArea);
  const favoritesQuery = useFavorites();
  const rateQuery = useExchangeRate();
  const canUseKitRequestsQuery = useCanUseKitRequests();
  const canUseKitRequests = canUseKitRequestsQuery.data === true;
  const urlCatalog = React.useMemo(() => readShopCatalogUrlState(searchParams), [searchParams]);
  const [searchDraft, setSearchDraft] = React.useState(urlCatalog.search);
  const kitsPath = `/shop/${areaSlug}/kit-gesuche`;
  const catalogPath = `/shop/${areaSlug}`;
  const pathSection: "catalog" | "kits" = location.pathname.endsWith("/kit-gesuche") ? "kits" : "catalog";
  const [createOpen, setCreateOpen] = React.useState(false);
  const section =
    canUseKitRequestsQuery.isSuccess && !canUseKitRequests && pathSection === "kits"
      ? "catalog"
      : pathSection;

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
  const selectedCategory =
    visible.find((category) => category.category_key === urlCatalog.categoryKey) ?? null;

  React.useEffect(() => {
    // Sync draft when user navigates with browser back/forward (URL is source of truth).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional URL → input sync
    setSearchDraft(urlCatalog.search);
  }, [urlCatalog.search]);

  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = buildShopCatalogSearchParams(searchParams, { search: searchDraft });
      if (next.toString() !== searchParams.toString()) {
        setSearchParams(next, { replace: true });
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchDraft, searchParams, setSearchParams]);

  const filtered = React.useMemo(() => {
    if (!selectedCategory) return [];
    const term = urlCatalog.search.trim();
    const variantNeedle = urlCatalog.variant.trim().toLowerCase();
    return productsInAreaCategory(products, assignments, selectedCategory.category_key)
      .filter((p) => productMatchesShopSearch(p, term))
      .filter((p) => {
        if (!variantNeedle) return true;
        return variantLabelForProduct(p).toLowerCase().includes(variantNeedle);
      });
  }, [assignments, products, selectedCategory, urlCatalog.search, urlCatalog.variant]);

  // Global hub search — active when a search term is set but no category is selected
  const globalSearchResults = React.useMemo(() => {
    if (selectedCategory) return null;
    const term = urlCatalog.search.trim();
    if (!term) return null;
    return products.filter((p) => productMatchesShopSearch(p, term));
  }, [products, selectedCategory, urlCatalog.search]);

  const favoriteProductIds = React.useMemo(
    () => new Set((favoritesQuery.data ?? []).map((f) => f.productId)),
    [favoritesQuery.data],
  );

  function selectCategory(key: string) {
    setSearchDraft("");
    setSearchParams(buildShopCatalogSearchParams(searchParams, { categoryKey: key, search: "", variant: "" }), {
      replace: true,
    });
  }

  function clearCategory() {
    setSearchParams(buildShopCatalogSearchParams(searchParams, { categoryKey: null, search: "", variant: "" }), {
      replace: true,
    });
  }

  const { activeCart } = useShopCart(shopArea);
  const cartHref = activeCart?.id ? `/carts/${activeCart.id}` : null;
  return (
    <div className={areaDensityClass(theme)} data-shop-area={shopArea}>
      <AreaStorefrontChrome theme={theme} areaName={areaName}>
      <div className={AREA_PAGE_RHYTHM}>
      {section === "kits" ? (
        <KitMarketplaceHero
          areaName={areaName}
          description={areaDescription}
          actions={
            <KitAreaActionNav
              section={section}
              onSection={(next) => {
                navigate(next === "kits" ? kitsPath : catalogPath);
              }}
              cartHref={cartHref}
              canUseKitRequests={canUseKitRequests}
              onCreate={() => {
                if (!canUseKitRequests) return;
                navigate(kitsPath);
                setCreateOpen(true);
              }}
            />
          }
        />
      ) : (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <KitAreaActionNav
            section={section}
            onSection={(next) => {
              navigate(next === "kits" ? kitsPath : catalogPath);
            }}
            cartHref={cartHref}
            canUseKitRequests={canUseKitRequests}
            onCreate={() => {
              if (!canUseKitRequests) return;
              navigate(kitsPath);
              setCreateOpen(true);
            }}
          />
        </div>
      )}

      <div className={AREA_PAGE_CONTENT_SLOT}>
      {section === "catalog" && (
        <GroupBuyCatalog
          shopArea={shopArea}
          areaName={areaName}
          onKitCreated={
            canUseKitRequests
              ? () => {
                  navigate(kitsPath);
                }
              : undefined
          }
          products={products}
          counts={counts}
          visible={visible}
          assignments={assignments}
          storefrontLoading={storefrontQuery.isLoading}
          storefrontError={storefrontQuery.isError}
          onStorefrontRetry={() => void storefrontQuery.refetch()}
          filtered={filtered}
          globalSearchResults={globalSearchResults}
          search={searchDraft}
          selectedCategory={selectedCategory}
          favoriteProductIds={favoriteProductIds}
          rate={rateQuery.data?.rate ?? null}
          rateLoading={rateQuery.isFetching && rateQuery.data?.rate == null}
          isLoading={productsQuery.isLoading}
          isError={productsQuery.isError}
          onRefetch={() => void productsQuery.refetch()}
          onSelectCategory={selectCategory}
          onSearch={setSearchDraft}
          onClearCategory={clearCategory}
          catalogSort={urlCatalog.sort}
          onCatalogSortChange={(sort) =>
            setSearchParams(buildShopCatalogSearchParams(searchParams, { sort }), { replace: true })
          }
        />
      )}

      {section === "kits" && canUseKitRequests && (
        <KitRequestsSection
          shopArea={shopArea}
          areaName={areaName}
          categories={visible}
          assignments={assignments}
          onCreateOpenChange={setCreateOpen}
        />
      )}
      </div>
      </div>
      {canUseKitRequests ? (
        <CreateKitRequestDialog
          shopArea={shopArea}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => navigate(kitsPath)}
        />
      ) : null}
      </AreaStorefrontChrome>
    </div>
  );
}

interface GroupBuyCatalogProps {
  shopArea: ShopAreaKey;
  areaName: string;
  products: Tables<"products">[];
  visible: AreaCategory[];
  counts: Record<string, number>;
  assignments: AreaCategoryAssignment[];
  storefrontLoading: boolean;
  storefrontError: boolean;
  onStorefrontRetry: () => void;
  filtered: Tables<"products">[];
  /** Products matching global search across all categories (hub-level, no category required). */
  globalSearchResults: Tables<"products">[] | null;
  search: string;
  selectedCategory: AreaCategory | null;
  favoriteProductIds: Set<string>;
  rate: number | null;
  rateLoading?: boolean;
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
  onSelectCategory: (id: string) => void;
  onSearch: (term: string) => void;
  onClearCategory: () => void;
  onKitCreated?: () => void;
  catalogSort: string;
  onCatalogSortChange: (sort: string) => void;
}

function GroupBuyCatalog({
  shopArea: _shopArea,
  areaName,
  products,
  visible,
  counts,
  assignments,
  storefrontLoading,
  storefrontError,
  onStorefrontRetry,
  filtered,
  globalSearchResults,
  search,
  selectedCategory,
  favoriteProductIds,
  rate,
  rateLoading = false,
  isLoading,
  isError,
  onRefetch,
  onSelectCategory,
  onSearch,
  onClearCategory,
  onKitCreated,
  catalogSort,
  onCatalogSortChange,
}: GroupBuyCatalogProps) {
  const { theme } = useShopAreaContext();
  if (!selectedCategory) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <ShopCatalogBreadcrumbs items={[{ label: "Shop", href: "/shop" }, { label: areaName }]} />

        {/* Global hub search field — visible even without category selection */}
        <div className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={theme.searchPlaceholder || "Alle Produkte durchsuchen …"}
            className="h-11 pl-8"
            aria-label="Produkte suchen"
          />
        </div>

        {/* Global search results */}
        {globalSearchResults !== null && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {globalSearchResults.length === 0
                ? "Keine Treffer — versuche einen anderen Suchbegriff."
                : `${globalSearchResults.length} Treffer`}
            </p>
            {globalSearchResults.length > 0 && (
              <ShopProductGrid
                products={globalSearchResults}
                rate={rate}
                rateLoading={rateLoading}
                favoriteProductIds={favoriteProductIds}
                categoryAssignments={assignments}
                pricingProfile="group_buy"
                sort={catalogSort}
                onKitCreated={onKitCreated}
              />
            )}
          </div>
        )}

        {/* Category hub — shown when no search active */}
        {globalSearchResults === null && (
          <>
            {(isLoading || storefrontLoading) && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="mx-auto h-[220px] w-full max-w-[20rem] rounded-none bg-muted/30" />
                ))}
              </div>
            )}
            {(isError || storefrontError) && (
              <ErrorState
                message="Produkte konnten nicht geladen werden."
                onRetry={() => {
                  onRefetch();
                  onStorefrontRetry();
                }}
              />
            )}
            {!isLoading && !isError && !storefrontLoading && !storefrontError && visible.length === 0 && (
              <EmptyState icon={PackageSearch} title="Aktuell sind keine Produkte verfügbar." />
            )}
            {!isLoading && !isError && !storefrontLoading && !storefrontError && visible.length > 0 && (
              <ShopCategoryHub categories={visible} counts={counts} onSelect={onSelectCategory} />
            )}
          </>
        )}
      </div>
    );
  }

  const tableCategoryId = isShopCategoryId(selectedCategory.category_key)
    ? selectedCategory.category_key
    : undefined;

  return (
    <div className="space-y-8">
      <ShopCatalogHeader
        eyebrow={areaName ? `Group Buy · ${areaName}` : "Group Buy"}
        title={selectedCategory.label}
        productCount={filtered.length}
        actions={
          <Button variant="ghost" size="sm" onClick={onClearCategory} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Kategorien
          </Button>
        }
      />

      <ShopCatalogToolbar
        searchValue={search}
        onSearchChange={onSearch}
        searchPlaceholder={theme.searchPlaceholder || "Produktname suchen …"}
        sortValue={parseShopCatalogSort(catalogSort)}
        onSortChange={(sort: ShopCatalogSort) => onCatalogSortChange(sort)}
        categoryPills={visible.map((category) => (
          <button
            key={category.category_key}
            type="button"
            onClick={() => onSelectCategory(category.category_key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              category.category_key === selectedCategory.category_key
                ? "bg-primary text-primary-foreground"
                : "bg-muted/80 text-muted-foreground hover:bg-muted",
            )}
          >
            {storefrontHeadline(category.label)}
          </button>
        ))}
      />

      {isLoading && (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4 xl:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[17rem] w-full rounded-xl sm:h-[18rem]" />
          ))}
        </div>
      )}

      {isError && (
        <ErrorState message="Produkte konnten nicht geladen werden." onRetry={onRefetch} />
      )}

      {!isLoading && !isError && products.length === 0 && (
        <EmptyState icon={PackageSearch} title="Aktuell sind keine Produkte verfügbar." />
      )}

      {!isLoading && !isError && products.length > 0 && filtered.length === 0 && (
        <EmptyState icon={PackageSearch} title="Keine Produkte gefunden." description="Passe deine Suche an." />
      )}

      {filtered.length > 0 && (
        <ShopProductGrid
          products={filtered}
          rate={rate}
          rateLoading={rateLoading}
          favoriteProductIds={favoriteProductIds}
          categoryId={tableCategoryId}
          categoryLabel={selectedCategory.label}
          categoryAssignments={assignments}
          pricingProfile="group_buy"
          sort={catalogSort}
          onKitCreated={onKitCreated}
        />
      )}
    </div>
  );
}

function KitRequestsSection({
  shopArea,
  categories,
  assignments,
  onCreateOpenChange,
}: {
  shopArea: ShopAreaKey;
  areaName?: string;
  categories: AreaCategory[];
  assignments: AreaCategoryAssignment[];
  onCreateOpenChange: (open: boolean) => void;
}) {
  const productsQuery = useShopProducts(shopArea);

  const [tab, setTab] = React.useState("open");
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<string | null>(null);
  const [productName, setProductName] = React.useState<string | null>(null);
  const [productId, setProductId] = React.useState<string | null>(null);
  const [variant, setVariant] = React.useState<string | null>(null);
  const [minRemaining, setMinRemaining] = React.useState<number | null>(null);
  const [sort, setSort] = React.useState<KitRequestSort>("newest");
  const [page, setPage] = React.useState(1);
  const [joinTarget, setJoinTarget] = React.useState<KitRequestCard | null>(null);
  const [leaveTarget, setLeaveTarget] = React.useState<KitRequestCard | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<KitRequestCard | null>(null);
  const [detailTarget, setDetailTarget] = React.useState<KitRequestCard | null>(null);
  const [myStatus, setMyStatus] = React.useState<string>("all");

  const groups = React.useMemo(() => {
    const catalog = productsQuery.data ?? [];
    const scoped = catalogProductsForKitFilters(catalog, assignments, category);
    return shopGroupsForCategory(scoped, null);
  }, [assignments, category, productsQuery.data]);

  const filters: OpenKitRequestFilters = {
    search,
    category,
    productName,
    productId,
    variant,
    minRemaining,
    sort,
    page,
    shopArea,
  };

  const openQuery = useOpenKitRequests(filters);
  const mineQuery = useMyKitRequests(shopArea);
  const joinedQuery = useMyKitRequestParticipations(shopArea);
  const leaveMutation = useLeaveKitRequest();
  const cancelMutation = useCancelKitRequest();
  const syncMutation = useSyncKitRequestCarts();

  const selectedGroup = groups.find(
    (group) =>
      group.groupKey === productName ||
      group.displayName === productName ||
      group.variants[0]?.name === productName,
  );
  const variantOptions = selectedGroup?.variants ?? [];

  const myRequests = React.useMemo(() => {
    const items = mineQuery.data ?? [];
    if (myStatus === "all") return items;
    return items.filter((item) => item.status === myStatus);
  }, [mineQuery.data, myStatus]);

  const myParticipations = React.useMemo(() => {
    const items = joinedQuery.data ?? [];
    if (myStatus === "all") return items;
    return items.filter((item) => item.status === myStatus);
  }, [joinedQuery.data, myStatus]);

  const totalPages = Math.max(1, Math.ceil((openQuery.data?.total ?? 0) / PAGE_SIZE));

  async function handleRetryCart(request: KitRequestCard) {
    try {
      await syncMutation.mutateAsync(request.id);
      toast.success("Dein Warenkorb wurde aktualisiert.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Warenkorb konnte nicht synchronisiert werden.");
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <AreaSectionHeader
        title="Kit Gesuche"
        description={AREA_KIT_REQUESTS_DESCRIPTION}
      />
      <KitRequestHint />

      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <TabsList className={KIT_REQUEST_TABS_LIST_CLASS}>
          <TabsTrigger value="open" className={KIT_REQUEST_TAB_TRIGGER_CLASS}>
            Offene Kit Gesuche
          </TabsTrigger>
          <TabsTrigger value="mine" className={KIT_REQUEST_TAB_TRIGGER_CLASS}>
            Von mir erstellt
          </TabsTrigger>
          <TabsTrigger value="joined" className={KIT_REQUEST_TAB_TRIGGER_CLASS}>
            Meine Kit Beteiligungen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="space-y-6">
          <KitRequestFilterBar
            searchId="kit-search"
            search={search}
            onSearch={(value) => {
              setSearch(value);
              setPage(1);
            }}
            category={category}
            onCategory={(value) => {
              setCategory(value);
              setProductName(null);
              setProductId(null);
              setVariant(null);
              setPage(1);
            }}
            categories={categories}
            productName={productName}
            onProductName={(value) => {
              setProductName(value);
              setProductId(null);
              setVariant(null);
              setPage(1);
            }}
            groups={groups}
            variant={variant}
            onVariant={(nextVariant, nextProductId) => {
              setVariant(nextVariant);
              setProductId(nextProductId);
              setPage(1);
            }}
            variantOptions={variantOptions}
            minRemaining={minRemaining}
            onMinRemaining={(value) => {
              setMinRemaining(value);
              setPage(1);
            }}
            sort={sort}
            onSort={(value) => {
              setSort(value);
              setPage(1);
            }}
          />

          {openQuery.isLoading ? (
            <div className={KIT_REQUEST_CARD_GRID}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
          ) : null}

          {openQuery.isError ? (
            <ErrorState
              message="Offene Kit-Gesuche konnten nicht geladen werden."
              onRetry={() => void openQuery.refetch()}
            />
          ) : null}

          {openQuery.data && openQuery.data.items.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Keine offenen Kit Gesuche"
              description="Aktuell gibt es keine passenden offenen Gesuche."
              action={<CreateKitRequestButton onClick={() => onCreateOpenChange(true)} />}
            />
          ) : null}

          {openQuery.data && openQuery.data.items.length > 0 ? (
            <>
              <div className={KIT_REQUEST_CARD_GRID}>
                {openQuery.data.items.map((item) => (
                  <KitRequestCardView
                    key={item.id}
                    request={item}
                    onJoin={setJoinTarget}
                    onLeave={setLeaveTarget}
                    onCancel={setCancelTarget}
                    onDetails={setDetailTarget}
                    onRetryCart={(req) => void handleRetryCart(req)}
                  />
                ))}
              </div>
              {totalPages > 1 ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Seite {page} von {totalPages} · {openQuery.data.total} Gesuche
                  </p>
                  <div className="flex gap-2">
                    <Button
                      className="h-11 min-h-11 flex-1 sm:flex-none"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Zurück
                    </Button>
                    <Button
                      className="h-11 min-h-11 flex-1 sm:flex-none"
                      variant="outline"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Weiter
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="mine" className="space-y-4">
          <StatusFilter value={myStatus} onChange={setMyStatus} />
          {mineQuery.isLoading ? <Skeleton className="h-40 w-full rounded-xl" /> : null}
          {mineQuery.isError ? (
            <ErrorState message="Deine Gesuche konnten nicht geladen werden." onRetry={() => void mineQuery.refetch()} />
          ) : null}
          {mineQuery.data && myRequests.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Noch keine eigenen Gesuche"
              description="Erstelle ein Gesuch, um Teilnehmer zu finden."
              action={<CreateKitRequestButton onClick={() => onCreateOpenChange(true)} />}
            />
          ) : null}
          <div className={KIT_REQUEST_CARD_GRID}>
            {myRequests.map((item) => (
              <KitRequestCardView
                key={item.id}
                request={item}
                onCancel={setCancelTarget}
                onDetails={setDetailTarget}
                onRetryCart={(req) => void handleRetryCart(req)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="joined" className="space-y-4">
          <StatusFilter value={myStatus} onChange={setMyStatus} />
          {joinedQuery.isLoading ? <Skeleton className="h-40 w-full rounded-xl" /> : null}
          {joinedQuery.isError ? (
            <ErrorState
              message="Deine Teilnahmen konnten nicht geladen werden."
              onRetry={() => void joinedQuery.refetch()}
            />
          ) : null}
          {joinedQuery.data && myParticipations.length === 0 ? (
            <EmptyState icon={Layers} title="Keine Kit Beteiligungen" description="Mach bei einem offenen Kit mit, um hier zu erscheinen." />
          ) : null}
          <div className={KIT_REQUEST_CARD_GRID}>
            {myParticipations.map((item) => (
              <KitRequestCardView
                key={item.id}
                request={item}
                onLeave={setLeaveTarget}
                onDetails={setDetailTarget}
                onRetryCart={(req) => void handleRetryCart(req)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <JoinKitRequestDialog request={joinTarget} open={joinTarget != null} onOpenChange={(next) => !next && setJoinTarget(null)} />
      <KitRequestDetailDialog
        kitId={detailTarget?.id ?? null}
        open={detailTarget != null}
        onOpenChange={(next) => !next && setDetailTarget(null)}
        onJoin={
          detailTarget && detailTarget.status === "open" && !detailTarget.isCreator
            ? () => {
                setJoinTarget(detailTarget);
                setDetailTarget(null);
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={leaveTarget != null}
        onOpenChange={(next) => !next && setLeaveTarget(null)}
        title="Möchtest du deinen Anteil wieder freigeben?"
        description="Dein Anteil wird anschließend wieder für andere Kunden verfügbar."
        confirmLabel="Ja, Anteil freigeben"
        variant="destructive"
        loading={leaveMutation.isPending}
        onConfirm={async () => {
          if (!leaveTarget) return;
          try {
            await leaveMutation.mutateAsync(leaveTarget.id);
            toast.success("Du hast das Kit verlassen.");
            setLeaveTarget(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Stornierung fehlgeschlagen.");
          }
        }}
      />

      <ConfirmDialog
        open={cancelTarget != null}
        onOpenChange={(next) => !next && setCancelTarget(null)}
        title="Kit stornieren"
        description="Das offene Kit wird geschlossen. Anteile anderer Teilnehmer werden freigegeben. Es werden keine Warenkörbe erzeugt."
        confirmLabel="Kit stornieren"
        variant="destructive"
        loading={cancelMutation.isPending}
        onConfirm={async () => {
          if (!cancelTarget) return;
          try {
            await cancelMutation.mutateAsync(cancelTarget.id);
            toast.success("Gesuch storniert.");
            setCancelTarget(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Stornierung fehlgeschlagen.");
          }
        }}
      />
    </div>
  );
}

function StatusFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="max-w-xs space-y-1.5">
      <Label>Status</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-h-11 w-full" aria-label="Status filtern">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle</SelectItem>
          {(["open", "full", "cancelled", "expired"] as const).map((status) => (
            <SelectItem key={status} value={status}>
              {kitRequestStatusLabel(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
