import * as React from "react";
import { Layers, Plus } from "lucide-react";

import { CreateKitRequestDialog } from "@/components/kit-requests/CreateKitRequestDialog";
import { JoinKitRequestDialog } from "@/components/kit-requests/JoinKitRequestDialog";
import { KitRequestCardView } from "@/components/kit-requests/KitRequestCard";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
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
import { useShopProducts } from "@/hooks/useShopProducts";
import {
  kitRequestStatusLabel,
  type KitRequestSort,
} from "@/lib/kitRequests";
import { shopGroupsForCategory } from "@/lib/shop/display";
import { formatProductVariant } from "@/lib/shop/variantCoverage";
import { SHOP_CATEGORIES, isShopCategoryId } from "@/lib/shopCategories";
import type { KitRequestCard } from "@/services/kitRequests";

const PAGE_SIZE = 20;

export default function KitRequestsPage() {
  const productsQuery = useShopProducts();

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

  const groups = React.useMemo(
    () =>
      shopGroupsForCategory(
        productsQuery.data ?? [],
        isShopCategoryId(category) ? category : null,
      ),
    [productsQuery.data, category],
  );

  const filters: OpenKitRequestFilters = {
    search,
    category,
    productName,
    productId,
    variant,
    minRemaining,
    sort,
    page,
  };

  const openQuery = useOpenKitRequests(filters);
  const mineQuery = useMyKitRequests();
  const joinedQuery = useMyKitRequestParticipations();
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
      <PageHeader
        eyebrow="Marktplatz"
        title="Kit Gesuche"
        description="Offene Kits durchsuchen, Vials reservieren und automatisch in den Warenkorb legen, sobald das Kit vollständig ist."
        actions={
          <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Gesuch erstellen
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="open" className="flex-1 sm:flex-none">
            Offene Gesuche
          </TabsTrigger>
          <TabsTrigger value="mine" className="flex-1 sm:flex-none">
            Meine Gesuche
          </TabsTrigger>
          <TabsTrigger value="joined" className="flex-1 sm:flex-none">
            Meine Teilnahmen
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
                  {SHOP_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
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
              <Label>Verbleibend</Label>
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
                  <SelectItem value="fewest_remaining">Wenigste fehlende Vials</SelectItem>
                  <SelectItem value="most_remaining">Meiste fehlende Vials</SelectItem>
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
            <EmptyState icon={Layers} title="Noch keine eigenen Gesuche" description="Erstelle ein Kit-Gesuch, um Teilnehmer zu finden." />
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
            <EmptyState icon={Layers} title="Keine Teilnahmen" description="Tritt einem offenen Gesuch bei, um hier zu erscheinen." />
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

      <CreateKitRequestDialog open={createOpen} onOpenChange={setCreateOpen} />
      <JoinKitRequestDialog request={joinTarget} open={joinTarget != null} onOpenChange={(next) => !next && setJoinTarget(null)} />

      <ConfirmDialog
        open={leaveTarget != null}
        onOpenChange={(next) => !next && setLeaveTarget(null)}
        title="Teilnahme stornieren"
        description="Deine reservierten Vials werden wieder freigegeben. Das Gesuch bleibt offen."
        confirmLabel="Stornieren"
        variant="destructive"
        loading={leaveMutation.isPending}
        onConfirm={async () => {
          if (!leaveTarget) return;
          try {
            await leaveMutation.mutateAsync(leaveTarget.id);
            toast.success("Teilnahme storniert.");
            setLeaveTarget(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Stornierung fehlgeschlagen.");
          }
        }}
      />

      <ConfirmDialog
        open={cancelTarget != null}
        onOpenChange={(next) => !next && setCancelTarget(null)}
        title="Gesuch stornieren"
        description="Das offene Gesuch wird geschlossen. Bereits reservierte Anteile anderer Teilnehmer werden freigegeben. Es werden keine Warenkörbe erzeugt."
        confirmLabel="Gesuch stornieren"
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
