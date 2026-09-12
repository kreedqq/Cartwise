import { BookOpen, ClipboardList, ShoppingBag, Star } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { CartCard } from "@/components/cart/CartCard";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderTemplatesCard } from "@/components/shop/OrderTemplatesCard";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { useCarts } from "@/hooks/useCarts";
import { useCartSummaries } from "@/hooks/useCartSummaries";
import { isOpenCart } from "@/services/carts";
import { useAuth } from "@/context/AuthProvider";
import { visibleAccountLabel } from "@/lib/username";
import { useFavorites } from "@/hooks/useFavorites";
import { useMyOrders } from "@/hooks/useOrders";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { formatDateTime, summarizeOrderCharges } from "@/lib/money";
import { PEPTIDE_NAV_LABEL } from "@/lib/navigation";
import { OrderIdentity } from "@/components/orders/OrderIdentity";

export default function DashboardPage() {
  const cartsQuery = useCarts();
  const summariesQuery = useCartSummaries();
  const ordersQuery = useMyOrders();
  const favoritesQuery = useFavorites();
  const rateQuery = useExchangeRate();
  const { customerRoleName, profile } = useAuth();
  const greetingName = visibleAccountLabel(profile, "dort");
  const recentOrders = (ordersQuery.data ?? []).slice(0, 4);
  const favoriteCount = favoritesQuery.data?.length ?? 0;
  // Submitted carts have already become an order (visible under "Meine Bestellungen")
  // and must not linger in the active "Warenkörbe" overview.
  const openCarts = (cartsQuery.data ?? []).filter((cart) => isOpenCart(cart.status));

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Übersicht"
        title={`Willkommen, ${greetingName}`}
        description="Warenkorb, Bestellungen und Schnellzugriff auf den Katalog – in einer Ansicht."
      />

      <div className="flex flex-wrap items-center gap-2">
        {customerRoleName && (
          <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
            Meine Rolle: {customerRoleName}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ShortcutCard to="/shop" icon={ShoppingBag} title="Shop" description="Peptides, Oils, Orals und Reconstitution Water." />
        <ShortcutCard
          to="/peptide"
          icon={BookOpen}
          title={PEPTIDE_NAV_LABEL}
          description="Mathematische Rechner und wissenschaftliche Substanzprofile."
        />
        <ShortcutCard to="/orders" icon={ClipboardList} title="Meine Bestellungen" description="Status und Gesamt Endpreis." />
        <ShortcutCard
          to="/favorites"
          icon={Star}
          title="Favoriten"
          description={favoriteCount > 0 ? `${favoriteCount} gespeicherte Artikel.` : "Artikel für schnelle Nachbestellung."}
        />
      </div>

      <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight">Warenkorb</h2>
              <p className="text-sm text-muted-foreground">
                Dein Warenkorb. Zum Öffnen die Karte antippen.
              </p>
            </div>
          </div>

          {cartsQuery.isLoading && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-[5.5rem] w-full" />
              ))}
            </div>
          )}

          {cartsQuery.isError && (
            <ErrorState message="Warenkörbe konnten nicht geladen werden." onRetry={() => cartsQuery.refetch()} />
          )}

          {cartsQuery.data && openCarts.length === 0 && (
            <div className="rounded-xl border border-border/70 bg-card p-4">
              <p className="text-sm text-muted-foreground">Noch kein Warenkorb vorhanden.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/shop">Zum Shop</Link>
                </Button>
              </div>
            </div>
          )}

          {cartsQuery.data && openCarts.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
              {openCarts.map((cart) => (
                <CartCard key={cart.id} cart={cart} summary={summariesQuery.data?.get(cart.id)} />
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Letzte Bestellungen</h2>
            <Link to="/orders" className="text-sm font-medium text-primary hover:underline">
              Alle anzeigen
            </Link>
          </div>
          {ordersQuery.isLoading && <Skeleton className="h-28 w-full" />}
          {ordersQuery.data && recentOrders.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Bestellungen.</p>
          )}
          {recentOrders.length > 0 && (
            <div className="divide-y divide-border">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3 transition-colors hover:bg-secondary/40"
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
              ))}
            </div>
          )}
        </div>
      </section>

      <OrderTemplatesCard currentRate={rateQuery.data?.rate ?? null} />
    </div>
  );
}

function ShortcutCard({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: typeof ShoppingBag;
  title: string;
  description: string;
}) {
  return (
    <Link to={to} className="group block">
      <Card className="h-full border-0 bg-transparent shadow-none ring-1 ring-border/70 transition-colors group-hover:bg-secondary/40">
        <CardHeader className="flex-row items-start gap-3 space-y-0 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-foreground">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="mt-1 text-xs">{description}</CardDescription>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
