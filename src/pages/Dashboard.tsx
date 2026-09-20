import { ArrowRight, Layers, Star } from "lucide-react";
import { Link } from "react-router-dom";

import { CartCard } from "@/components/cart/CartCard";
import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";
import { ErrorState } from "@/components/common/ErrorState";
import { KitProgress } from "@/components/kit-requests/KitProgress";
import { OrderIdentity } from "@/components/orders/OrderIdentity";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { OrderTemplatesCard } from "@/components/shop/OrderTemplatesCard";
import { ShopAreaPortalGallery } from "@/components/shop/ShopAreaPortalGallery";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthProvider";
import { useCarts } from "@/hooks/useCarts";
import { useCartSummaries } from "@/hooks/useCartSummaries";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useFavorites } from "@/hooks/useFavorites";
import {
  useCanUseKitRequests,
  useMyKitRequestParticipations,
  useMyKitRequests,
} from "@/hooks/useKitRequests";
import { useMyOrders } from "@/hooks/useOrders";
import { useMyShopAreas } from "@/hooks/useMyShopAreas";
import { PAGE_BLEED_PAD, PAGE_BLEED_TOP, UI_TYPE } from "@/lib/design/tokens";
import { formatDateTime, summarizeOrderCharges } from "@/lib/money";
import { visibleAccountLabel } from "@/lib/username";
import { cn } from "@/lib/utils";
import { isOpenCart } from "@/services/carts";
import type { KitRequestCard } from "@/services/kitRequests";

type DashboardSignal =
  | { kind: "kit_full"; count: number }
  | { kind: "cart_pending"; count: number }
  | { kind: "discover" };

function resolveSignal(openCartCount: number, fullKitCount: number): DashboardSignal {
  if (fullKitCount > 0) return { kind: "kit_full", count: fullKitCount };
  if (openCartCount > 0) return { kind: "cart_pending", count: openCartCount };
  return { kind: "discover" };
}

export default function DashboardPage() {
  const cartsQuery = useCarts();
  const summariesQuery = useCartSummaries();
  const ordersQuery = useMyOrders();
  const favoritesQuery = useFavorites();
  const rateQuery = useExchangeRate();
  const areasQuery = useMyShopAreas();
  const { customerRoleName, profile, user } = useAuth();
  const canUseKitRequestsQuery = useCanUseKitRequests();
  const myKitRequestsQuery = useMyKitRequests();
  const myKitParticipationsQuery = useMyKitRequestParticipations();

  const canUseKitRequests = canUseKitRequestsQuery.data === true;
  const greetingName = visibleAccountLabel(profile, "dort");
  const recentOrders = (ordersQuery.data ?? []).slice(0, 4);
  const favoriteCount = favoritesQuery.data?.length ?? 0;

  const openCarts = (cartsQuery.data ?? [])
    .filter((cart) => isOpenCart(cart.status))
    .filter((cart) => !user?.id || cart.user_id === user.id);

  const activeKits = (myKitRequestsQuery.data ?? []).filter(
    (k) => k.status === "open" || k.status === "full",
  );
  const activeParticipations = (myKitParticipationsQuery.data ?? []).filter(
    (k) => k.status === "open" || k.status === "full",
  );
  const kitFeed = [...activeKits, ...activeParticipations].slice(0, 3);

  const fullKitCount =
    activeKits.filter((k) => k.status === "full").length +
    activeParticipations.filter((k) => k.status === "full").length;

  const signal = resolveSignal(openCarts.length, fullKitCount);
  const cartHref = openCarts[0] ? `/carts/${openCarts[0].id}` : "/shop";
  const primaryCart = openCarts[0];
  const primarySummary = primaryCart ? summariesQuery.data?.get(primaryCart.id) : undefined;

  return (
    <div className="space-y-14 lg:space-y-16">
      <section className={cn(PAGE_BLEED_TOP, "relative overflow-hidden border-b border-primary/20")}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(920px_360px_at_12%_0%,hsl(var(--primary)/0.18),transparent_58%)]"
        />
        <div className={cn(PAGE_BLEED_PAD, "relative grid gap-10 py-10 lg:grid-cols-12 lg:py-14")}>
          <div className="lg:col-span-7">
            <p className={UI_TYPE.eyebrow}>Willkommen zurück</p>
            <h1 className="mt-3 font-display text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[0.92] tracking-tight">
              {greetingName}
            </h1>
            {customerRoleName ? (
              <p className="mt-3 text-sm font-medium uppercase tracking-[0.16em] text-primary/80">
                {customerRoleName}
              </p>
            ) : null}
            <HeroCopy signal={signal} />
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="min-h-12 gap-2 px-6">
                <Link to={signal.kind === "kit_full" ? "/kit-gesuche" : signal.kind === "cart_pending" ? cartHref : "/shop"}>
                  {signal.kind === "kit_full"
                    ? "Zum Marketplace"
                    : signal.kind === "cart_pending"
                      ? "Zum Warenkorb"
                      : "Zum Shop"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Link to="/orders" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                Meine Bestellungen
              </Link>
              <Link to="/favorites" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                <Star className="h-3.5 w-3.5" />
                Favoriten{favoriteCount > 0 ? ` (${favoriteCount})` : ""}
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-end border-l-0 border-primary/15 lg:col-span-5 lg:border-l lg:pl-10">
            {signal.kind === "cart_pending" && primarySummary ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Offener Warenkorb</p>
                <div className="mt-3">
                  <DualCurrencyPrice usd={primarySummary.total_usd} eur={primarySummary.total_eur} size="hero" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {primarySummary.item_count === 1 ? "1 Position" : `${primarySummary.item_count} Positionen`}
                </p>
              </div>
            ) : kitFeed[0] ? (
              <DashboardKitLead kit={kitFeed[0]} />
            ) : (
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Öffne den Shop oder ein Group-Buy Kit, wenn du bereit bist.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        <div className="min-w-0 space-y-10 lg:col-span-7">
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold tracking-tight">Letzte Bestellungen</h2>
              <Link to="/orders" className="text-sm font-medium text-primary">
                Alle anzeigen
              </Link>
            </div>
            {ordersQuery.isLoading && <Skeleton className="h-28 w-full" />}
            {ordersQuery.data && recentOrders.length === 0 && (
              <p className="text-sm text-muted-foreground">Noch keine Bestellungen.</p>
            )}
            {recentOrders.length > 0 && (
              <ol className="relative space-y-0 border-l border-primary/25 pl-5">
                {recentOrders.map((order) => (
                  <li key={order.id}>
                    <span className="absolute -left-[5px] mt-3 h-2.5 w-2.5 rounded-full bg-primary" />
                    <Link
                      to={`/orders/${order.id}`}
                      className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3 transition-colors hover:text-primary"
                    >
                      <div className="min-w-0">
                        <OrderIdentity
                          orderNumber={order.order_number}
                          telegramSnapshot={order.telegram_username_snapshot}
                        />
                        <p className="text-xs text-muted-foreground">{formatDateTime(order.submitted_at)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-medium tabular-nums">
                          {
                            summarizeOrderCharges({
                              productUsd: order.total_usd,
                              productEur: order.total_eur,
                              chinaAmount: order.china_shipping_amount,
                              chinaCurrency: order.china_shipping_currency,
                              deAmount: order.de_shipping_amount,
                              deCurrency: order.de_shipping_currency,
                              usdToEurRate: order.exchange_rate,
                            }).grandDisplay
                          }
                        </span>
                        <OrderStatusBadge status={order.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="min-w-0 space-y-3">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">Warenkorb</h2>
              <p className="text-sm text-muted-foreground">Zum Öffnen die Übersicht antippen.</p>
            </div>
            {cartsQuery.isLoading && <Skeleton className="h-[5.5rem] w-full" />}
            {cartsQuery.isError && (
              <ErrorState message="Warenkörbe konnten nicht geladen werden." onRetry={() => cartsQuery.refetch()} />
            )}
            {cartsQuery.data && openCarts.length === 0 && (
              <div className="border border-border/70 py-5">
                <p className="text-sm text-muted-foreground">Noch kein Warenkorb vorhanden.</p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/shop">Zum Shop</Link>
                </Button>
              </div>
            )}
            {cartsQuery.data && openCarts.length > 0 && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {openCarts.map((cart) => (
                  <CartCard key={cart.id} cart={cart} summary={summariesQuery.data?.get(cart.id)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {canUseKitRequests ? (
          <aside className="min-w-0 space-y-4 lg:col-span-5">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold tracking-tight">Kit Aktivität</h2>
              <Link to="/kit-gesuche" className="text-sm font-medium text-primary">
                Alle Kit Gesuche
              </Link>
            </div>
            {(myKitRequestsQuery.isLoading || myKitParticipationsQuery.isLoading) && (
              <Skeleton className="h-20 w-full" />
            )}
            {myKitRequestsQuery.isSuccess && myKitParticipationsQuery.isSuccess && kitFeed.length === 0 ? (
              <div className="border border-primary/20 bg-primary/[0.04] p-5">
                <p className="font-display text-lg font-semibold">Noch kein Kit-Anteil</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Teile ein Kit mit anderen und zahle nur für deinen Anteil.
                </p>
                <Button asChild size="sm" className="mt-4">
                  <Link to="/kit-gesuche">Kit Gesuche entdecken</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {kitFeed.map((kit) => (
                  <DashboardKitCard key={kit.id} kit={kit} />
                ))}
              </div>
            )}
          </aside>
        ) : null}
      </section>

      {(areasQuery.data?.length ?? 0) > 0 ? (
        <div className="relative -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <ShopAreaPortalGallery
            areas={areasQuery.data ?? []}
            heading="Shop Bereiche"
            description="Jeder Verkaufsbereich ist ein eigenes Portal — dieselbe Welt wie im Shop-Hub."
          />
        </div>
      ) : null}

      <OrderTemplatesCard currentRate={rateQuery.data?.rate ?? null} />
    </div>
  );
}

function HeroCopy({ signal }: { signal: DashboardSignal }) {
  if (signal.kind === "kit_full") {
    return (
      <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
        {signal.count === 1 ? "Dein Kit ist voll." : `${signal.count} Kits sind voll.`} Du kannst deinen Anteil jetzt bestellen.
      </p>
    );
  }
  if (signal.kind === "cart_pending") {
    return (
      <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
        Dein Warenkorb wartet. Schließe den Kauf ab oder passe die Menge an.
      </p>
    );
  }
  return (
    <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
      Peptides, Oils, Orals und Kits — bereit, wenn du es bist.
    </p>
  );
}

function DashboardKitLead({ kit }: { kit: KitRequestCard }) {
  const isLastSpot = kit.status === "open" && kit.remainingVials === 1;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Aktives Kit</p>
      <p className="mt-3 font-display text-3xl font-semibold tracking-tight">{kit.productName}</p>
      <p className="mt-1 text-sm text-muted-foreground">{kit.variantLabel}</p>
      <p className="mt-4 font-display text-4xl tabular-nums tracking-tight">
        {kit.allocatedTotal}
        <span className="text-muted-foreground"> / {kit.kitSizeVials}</span>
      </p>
      {isLastSpot ? <p className="mt-2 text-sm font-semibold text-warning">Letzter Platz</p> : null}
    </div>
  );
}

function DashboardKitCard({ kit }: { kit: KitRequestCard }) {
  const isAlmostFull = kit.status === "open" && kit.remainingVials > 0 && kit.remainingVials <= 2;
  const isLastSpot = kit.status === "open" && kit.remainingVials === 1;

  return (
    <Link to="/kit-gesuche" className="group block border border-primary/20 bg-primary/[0.04] p-4 hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{kit.productName}</p>
          <p className="truncate text-xs text-muted-foreground">{kit.variantLabel}</p>
        </div>
        {kit.isCreator ? <Layers className="h-3.5 w-3.5 shrink-0 text-primary/60" /> : null}
      </div>
      <KitProgress
        allocated={kit.allocatedTotal}
        kitSize={kit.kitSizeVials}
        status={kit.status}
        isAlmostFull={isAlmostFull}
        isLastSpot={isLastSpot}
        className="mt-3"
      />
    </Link>
  );
}
