import * as React from "react";
import { Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Layers, PackageSearch, Plus, Search } from "lucide-react";

import { ShopProductsTable } from "@/components/shop/ShopProductsTable";
import { ShopProductsMobileList } from "@/components/shop/ShopProductsMobileList";
import { AreaStorefrontChrome } from "@/components/shop/AreaStorefrontChrome";
import { ShopCategoryHub } from "@/components/shop/ShopCategoryHub";
import { CreateKitRequestDialog } from "@/components/kit-requests/CreateKitRequestDialog";
import { JoinKitRequestDialog } from "@/components/kit-requests/JoinKitRequestDialog";
import { KitRequestCardView } from "@/components/kit-requests/KitRequestCard";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { PageHeader } from "@/components/common/PageHeader";
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
import { ShopAreaProvider, useShopAreaContext } from "@/context/ShopAreaContext";
import {
  isGroupBuyPricing,
  type MyShopArea,
  type ShopAreaKey,
} from "@/lib/shop/shopAreas";
import { areaDensityClass, parseAreaTheme } from "@/lib/shop/areaTheme";
import { kitRequestStatusLabel, type KitRequestSort } from "@/lib/kitRequests";
import { shopGroupsForCategory, productMatchesShopSearch } from "@/lib/shop/display";
import { formatProductVariant } from "@/lib/shop/variantCoverage";
import {
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

  return (
    <ShopAreaProvider
      shopArea={current.key}
      pricingProfile="group_buy"
      theme={parseAreaTheme(current.theme)}
    >
      <GroupBuyContent shopArea={current.key} areaName={current.name} />
    </ShopAreaProvider>
  );
}

function GroupBuyContent({ shopArea, areaName }: { shopArea: ShopAreaKey; areaName: string }) {
  const { theme } = useShopAreaContext();
  const productsQuery = useShopProducts(shopArea);
  const storefrontQuery = useShopAreaStorefront(shopArea);
  const favoritesQuery = useFavorites();
  const rateQuery = useExchangeRate();
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [activeSection, setActiveSection] = React.useState<"catalog" | "kits">("catalog");

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
  const selectedCategory = visible.find((category) => category.category_key === selectedKey) ?? null;

  const filtered = React.useMemo(() => {
    if (!selectedCategory) return [];
    const term = search.trim();
    return productsInAreaCategory(products, assignments, selectedCategory.category_key).filter((p) =>
      productMatchesShopSearch(p, term),
    );
  }, [assignments, products, search, selectedCategory]);

  const favoriteProductIds = React.useMemo(
    () => new Set((favoritesQuery.data ?? []).map((f) => f.productId)),
    [favoritesQuery.data],
  );

  function selectCategory(key: string) {
    setSearch("");
    setSelectedKey(key);
  }

  return (
    <div className={areaDensityClass(theme)} data-shop-area={shopArea}>
      <AreaStorefrontChrome theme={theme} areaName={areaName}>
      <PageHeader
        eyebrow={areaName}
        title={areaName}
        description="Gemeinsam bestellen: Katalog oder Kit mit anderen Kunden teilen."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11"
              variant={activeSection === "catalog" ? "default" : "outline"}
              onClick={() => setActiveSection("catalog")}
            >
              Produkte
            </Button>
            <Button
              className="min-h-11"
              variant={activeSection === "kits" ? "default" : "outline"}
              onClick={() => setActiveSection("kits")}
            >
              <Layers className="mr-1.5 h-4 w-4" />
              Kit Gesuche
            </Button>
          </div>
        }
      />

      {activeSection === "catalog" && (
        <>
        <div className="mb-6 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h2 className="text-lg font-semibold">Kit gemeinsam kaufen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Teile ein Kit mit anderen Kunden und bezahle nur für deinen Anteil.
          </p>
          <Button className="mt-3 min-h-11" onClick={() => setActiveSection("kits")}>
            Kit Gesuche ansehen
          </Button>
        </div>
        <GroupBuyCatalog
          shopArea={shopArea}
          areaName={areaName}
          products={products}
          counts={counts}
          visible={visible}
          assignments={assignments}
          storefrontLoading={storefrontQuery.isLoading}
          storefrontError={storefrontQuery.isError}
          onStorefrontRetry={() => void storefrontQuery.refetch()}
          filtered={filtered}
          search={search}
          selectedCategory={selectedCategory}
          favoriteProductIds={favoriteProductIds}
          rate={rateQuery.data?.rate ?? null}
          isLoading={productsQuery.isLoading}
          isError={productsQuery.isError}
          onRefetch={() => void productsQuery.refetch()}
          onSelectCategory={selectCategory}
          onSearch={setSearch}
          onClearCategory={() => setSelectedKey(null)}
        />
        </>
      )}

      {activeSection === "kits" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="text-lg font-semibold">Kit gemeinsam kaufen</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Teile ein Kit mit anderen Kunden und bezahle nur für deinen Anteil.
            </p>
          </div>
          <KitRequestsSection
            shopArea={shopArea}
            areaName={areaName}
            categories={visible}
            assignments={assignments}
          />
        </div>
      )}
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
  search: string;
  selectedCategory: AreaCategory | null;
  favoriteProductIds: Set<string>;
  rate: number | null;
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
  onSelectCategory: (id: string) => void;
  onSearch: (term: string) => void;
  onClearCategory: () => void;
}

function GroupBuyCatalog({
  areaName,
  products,
  visible,
  counts,
  storefrontLoading,
  storefrontError,
  onStorefrontRetry,
  filtered,
  search,
  selectedCategory,
  favoriteProductIds,
  rate,
  isLoading,
  isError,
  onRefetch,
  onSelectCategory,
  onSearch,
  onClearCategory,
}: GroupBuyCatalogProps) {
  const { theme } = useShopAreaContext();
  if (!selectedCategory) {
    return (
      <div className="space-y-10">
        <PageHeader
          eyebrow={areaName}
          title="Katalog"
          description="Group-Buy-Preise. Kits, Mengenstaffeln und geteilte Bestellungen."
        />
        {(isLoading || storefrontLoading) && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[200px] w-full rounded-2xl" />
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
      </div>
    );
  }

  const tableCategoryId = isShopCategoryId(selectedCategory.category_key)
    ? selectedCategory.category_key
    : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={areaName}
        title={selectedCategory.label}
        description={`${filtered.length} Artikel · Menge wählen und in den Warenkorb legen.`}
        actions={
          <Button variant="ghost" size="sm" onClick={onClearCategory} className="gap-1.5">
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
            onClick={() => onSelectCategory(category.category_key)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
              category.category_key === selectedCategory.category_key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            {storefrontHeadline(category.label)}
          </button>
        ))}
      </div>

      <div className="relative min-w-[160px] max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={theme.searchPlaceholder || "Produktname suchen …"}
          className="pl-8"
        />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
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
        <>
          <div className="hidden lg:block">
            <ShopProductsTable
              products={filtered}
              rate={rate}
              favoriteProductIds={favoriteProductIds}
              categoryId={tableCategoryId}
              categoryLabel={selectedCategory.label}
              pricingProfile="group_buy"
            />
          </div>
          <div className="lg:hidden">
            <ShopProductsMobileList
              products={filtered}
              rate={rate}
              favoriteProductIds={favoriteProductIds}
              categoryId={tableCategoryId}
              pricingProfile="group_buy"
            />
          </div>
        </>
      )}
    </div>
  );
}

function KitRequestsSection({
  shopArea,
  categories,
  assignments,
}: {
  shopArea: ShopAreaKey;
  areaName?: string;
  categories: AreaCategory[];
  assignments: AreaCategoryAssignment[];
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
  const [createOpen, setCreateOpen] = React.useState(false);
  const [joinTarget, setJoinTarget] = React.useState<KitRequestCard | null>(null);
  const [leaveTarget, setLeaveTarget] = React.useState<KitRequestCard | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<KitRequestCard | null>(null);
  const [myStatus, setMyStatus] = React.useState<string>("all");

  const groups = React.useMemo(() => {
    const catalog = productsQuery.data ?? [];
    const scoped = category
      ? productsInAreaCategory(catalog, assignments, category)
      : catalog.filter((product) => assignments.some((row) => row.product_id === product.id));
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
    (g) => g.displayName === productName || g.variants[0]?.name === productName,
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
    <div className="min-w-0 space-y-8">
      <div className="flex justify-end">
        <Button className="min-h-11 w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Kit teilen
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="open" className="flex-1 sm:flex-none">
            Offene Kit Gesuche
          </TabsTrigger>
          <TabsTrigger value="mine" className="flex-1 sm:flex-none">
            Von mir erstellt
          </TabsTrigger>
          <TabsTrigger value="joined" className="flex-1 sm:flex-none">
            Meine Kit Beteiligungen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="space-y-6">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2 xl:col-span-1">
              <Label htmlFor="kit-search">Suche</Label>
              <Input
                id="kit-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Produkt oder Username"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kategorie</Label>
              <Select
                value={category ?? "all"}
                onValueChange={(value) => {
                  setCategory(value === "all" ? null : value);
                  setProductName(null);
                  setProductId(null);
                  setVariant(null);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kategorien</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.category_key} value={cat.category_key}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Produkt</Label>
              <Select
                value={productName ?? "all"}
                onValueChange={(value) => {
                  setProductName(value === "all" ? null : value);
                  setProductId(null);
                  setVariant(null);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Produkte</SelectItem>
                  {groups.map((group) => (
                    <SelectItem
                      key={group.groupKey}
                      value={group.variants[0]?.name ?? group.displayName}
                    >
                      {group.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Variante</Label>
              <Select
                value={variant ?? "all"}
                onValueChange={(value) => {
                  if (value === "all") {
                    setVariant(null);
                    setProductId(null);
                    setPage(1);
                    return;
                  }
                  const match = variantOptions.find((item) => (item.dosage_vial || item.code) === value);
                  setVariant(value);
                  setProductId(match?.id ?? null);
                  setPage(1);
                }}
                disabled={!productName}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Alle Varianten" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Varianten</SelectItem>
                  {variantOptions.map((item) => (
                    <SelectItem key={item.id} value={item.dosage_vial || item.code}>
                      {formatProductVariant(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Noch verfügbar</Label>
              <Select
                value={minRemaining == null ? "all" : String(minRemaining)}
                onValueChange={(value) => {
                  setMinRemaining(value === "all" ? null : Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Beliebig</SelectItem>
                  <SelectItem value="1">Mindestens 1</SelectItem>
                  <SelectItem value="2">Mindestens 2</SelectItem>
                  <SelectItem value="4">Mindestens 4</SelectItem>
                  <SelectItem value="6">Mindestens 6</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sortierung</Label>
              <Select
                value={sort}
                onValueChange={(value) => {
                  setSort(value as KitRequestSort);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Neueste</SelectItem>
                  <SelectItem value="fewest_remaining">Am vollsten zuerst</SelectItem>
                  <SelectItem value="most_remaining">Meiste Plätze frei</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {openQuery.isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-full rounded-xl" />
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
              title="Keine offenen Gesuche"
              description="Erstelle ein Gesuch, wenn du ein Kit teilen möchtest, ohne bereits alle Teilnehmer zu kennen."
            />
          ) : null}

          {openQuery.data && openQuery.data.items.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {openQuery.data.items.map((item) => (
                  <KitRequestCardView
                    key={item.id}
                    request={item}
                    onJoin={setJoinTarget}
                    onLeave={setLeaveTarget}
                    onCancel={setCancelTarget}
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
                    <Button className="flex-1 sm:flex-none" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      Zurück
                    </Button>
                    <Button
                      className="flex-1 sm:flex-none"
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
            <EmptyState icon={Layers} title="Noch kein eigenes Kit" description="Teile ein Kit, um andere Kunden einzuladen." />
          ) : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {myRequests.map((item) => (
              <KitRequestCardView
                key={item.id}
                request={item}
                onCancel={setCancelTarget}
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {myParticipations.map((item) => (
              <KitRequestCardView
                key={item.id}
                request={item}
                onLeave={setLeaveTarget}
                onRetryCart={(req) => void handleRetryCart(req)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <CreateKitRequestDialog shopArea={shopArea} open={createOpen} onOpenChange={setCreateOpen} />
      <JoinKitRequestDialog request={joinTarget} open={joinTarget != null} onOpenChange={(next) => !next && setJoinTarget(null)} />

      <ConfirmDialog
        open={leaveTarget != null}
        onOpenChange={(next) => !next && setLeaveTarget(null)}
        title="Möchtest du dieses Kit verlassen?"
        description="Dein Anteil wird wieder freigegeben."
        confirmLabel="Kit verlassen"
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
        <SelectTrigger className="w-full">
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
