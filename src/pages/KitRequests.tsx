import * as React from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Layers } from "lucide-react";

import { CreateKitRequestDialog } from "@/components/kit-requests/CreateKitRequestDialog";
import { JoinKitRequestDialog } from "@/components/kit-requests/JoinKitRequestDialog";
import { KitOnboardingBanner } from "@/components/kit-requests/KitOnboardingBanner";
import { KitRequestCardView } from "@/components/kit-requests/KitRequestCard";
import { KitRequestFilterBar } from "@/components/kit-requests/KitRequestFilterBar";
import { CreateKitRequestButton, KitRequestHint } from "@/components/kit-requests/KitRequestIntro";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
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
import { ShopAreaProvider } from "@/context/ShopAreaContext";
import { portalConfigFromAreaTheme } from "@/lib/shop/areaPortal";
import { parseCategoryPortalOverrides, parseVialMedia } from "@/lib/shop/portalAssets";
import { parseAreaTheme } from "@/lib/shop/areaTheme";
import {
  isGroupBuyPricing,
  type ShopAreaKey,
} from "@/lib/shop/shopAreas";
import {
  KIT_REQUEST_CARD_GRID,
  KIT_REQUEST_ROLE_DENIED_MESSAGE,
  KIT_REQUEST_TAB_TRIGGER_CLASS,
  KIT_REQUEST_TABS_LIST_CLASS,
  kitRequestStatusLabel,
  type KitRequestSort,
} from "@/lib/kitRequests";
import { shopGroupsForCategory } from "@/lib/shop/display";
import { catalogProductsForKitFilters, visibleStorefrontCategories } from "@/lib/shop/areaCategories";
import {
  buildKitFilterSearchParams,
  readKitFilterUrlState,
} from "@/lib/shop/shopCatalogUrlState";
import type { KitRequestCard } from "@/services/kitRequests";

const PAGE_SIZE = 20;

export default function KitRequestsPage() {
  const location = useLocation();
  const areasQuery = useMyShopAreas();
  const canUseKitRequestsQuery = useCanUseKitRequests();

  if (areasQuery.isLoading || canUseKitRequestsQuery.isLoading) {
    return <FullScreenSpinner label="Group Buy wird geladen …" />;
  }
  if (areasQuery.isError) {
    return <ErrorState message="Shop-Bereiche konnten nicht geladen werden." onRetry={() => areasQuery.refetch()} />;
  }

  const groupBuyAreas = (areasQuery.data ?? []).filter((area) => isGroupBuyPricing(area.pricing_profile) && area.purchasable);
  if (groupBuyAreas.length === 0) return <Navigate to="/403" replace />;

  if (canUseKitRequestsQuery.isSuccess && canUseKitRequestsQuery.data !== true) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon={Layers}
          title="Kit Gesuche nicht freigeschaltet"
          description={KIT_REQUEST_ROLE_DENIED_MESSAGE}
        />
      </div>
    );
  }

  if (location.pathname.startsWith("/kit-gesuche")) {
    return <Navigate to={groupBuyAreas[0].path} replace />;
  }

  const requested = location.pathname.replace(/^\/shop\//, "");
  const current =
    groupBuyAreas.find((area) => area.slug === requested) ?? groupBuyAreas[0];
  if (!current) return <Navigate to="/403" replace />;

  return (
    <ShopAreaProvider
      shopArea={current.key}
      pricingProfile="group_buy"
      theme={parseAreaTheme(current.theme)}
      portal={portalConfigFromAreaTheme(current.theme)}
      categoryPortals={parseCategoryPortalOverrides(current.theme)}
      vialMedia={parseVialMedia(current.theme)}
    >
      <KitRequestsContent shopArea={current.key} areaName={current.name} />
    </ShopAreaProvider>
  );
}

function KitRequestsContent({ shopArea, areaName }: { shopArea: ShopAreaKey; areaName: string }) {
  const productsQuery = useShopProducts(shopArea);
  const storefrontQuery = useShopAreaStorefront(shopArea);

  // URL-persistent filters — shareable, browser-back-aware
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilters = readKitFilterUrlState(searchParams);

  const tab = urlFilters.kitTab;
  const search = urlFilters.kitSearch;
  const category = urlFilters.kitCategory;
  const productName = urlFilters.kitProduct;
  const variant = urlFilters.kitVariant;
  const sort = (urlFilters.kitSort as KitRequestSort) ?? "newest";
  const page = urlFilters.kitPage;

  // productId is derived from variant selection; keep as ephemeral state
  const [productId, setProductId] = React.useState<string | null>(null);
  const [minRemaining, setMinRemaining] = React.useState<number | null>(null);

  function patchUrl(patch: Parameters<typeof buildKitFilterSearchParams>[1]) {
    setSearchParams((prev) => buildKitFilterSearchParams(prev, patch), { replace: true });
  }

  const [createOpen, setCreateOpen] = React.useState(false);
  const [joinTarget, setJoinTarget] = React.useState<KitRequestCard | null>(null);
  const [leaveTarget, setLeaveTarget] = React.useState<KitRequestCard | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<KitRequestCard | null>(null);
  const [myStatus, setMyStatus] = React.useState<string>("all");

  const groups = React.useMemo(() => {
    const catalog = productsQuery.data ?? [];
    const assignments = storefrontQuery.data?.assignments ?? [];
    const scoped = catalogProductsForKitFilters(catalog, assignments, category);
    return shopGroupsForCategory(scoped, null);
  }, [category, productsQuery.data, storefrontQuery.data?.assignments]);

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
      <PageHeader
        title={areaName}
        description="Offene Gesuche anderer Kunden"
        actions={<CreateKitRequestButton onClick={() => setCreateOpen(true)} />}
      />
      <KitRequestHint />

      {/* Onboarding explainer — dismissable, only for users with no kit activity yet */}
      <KitOnboardingBanner
        hasExistingKitActivity={
          (mineQuery.data?.length ?? 0) > 0 ||
          (joinedQuery.data?.length ?? 0) > 0
        }
      />

      <Tabs value={tab} onValueChange={(v) => patchUrl({ kitTab: v })} className="min-w-0">
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
              patchUrl({ kitSearch: value, kitPage: 1 });
            }}
            category={category}
            onCategory={(value) => {
              setProductId(null);
              patchUrl({ kitCategory: value, kitProduct: null, kitVariant: null, kitPage: 1 });
            }}
            categories={
              storefrontQuery.data
                ? visibleStorefrontCategories(
                    storefrontQuery.data.categories,
                    storefrontQuery.data.assignments,
                    (productsQuery.data ?? []).map((product) => product.id),
                  )
                : []
            }
            productName={productName}
            onProductName={(value) => {
              setProductId(null);
              patchUrl({ kitProduct: value, kitVariant: null, kitPage: 1 });
            }}
            groups={groups}
            variant={variant}
            onVariant={(nextVariant, nextProductId) => {
              setProductId(nextProductId);
              patchUrl({ kitVariant: nextVariant, kitPage: 1 });
            }}
            variantOptions={variantOptions}
            minRemaining={minRemaining}
            onMinRemaining={(value) => {
              setMinRemaining(value);
              patchUrl({ kitPage: 1 });
            }}
            sort={sort}
            onSort={(value) => {
              patchUrl({ kitSort: value, kitPage: 1 });
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
              action={<CreateKitRequestButton onClick={() => setCreateOpen(true)} />}
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
                      onClick={() => patchUrl({ kitPage: page - 1 })}
                    >
                      Zurück
                    </Button>
                    <Button
                      className="h-11 min-h-11 flex-1 sm:flex-none"
                      variant="outline"
                      disabled={page >= totalPages}
                      onClick={() => patchUrl({ kitPage: page + 1 })}
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
              action={<CreateKitRequestButton onClick={() => setCreateOpen(true)} />}
            />
          ) : null}
          <div className={KIT_REQUEST_CARD_GRID}>
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
            <EmptyState icon={Layers} title="Keine Teilnahmen" description="Tritt einem offenen Gesuch bei, um hier zu erscheinen." />
          ) : null}
          <div className={KIT_REQUEST_CARD_GRID}>
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
          <SelectValue placeholder="Status" />
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
