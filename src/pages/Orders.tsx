import { ArrowRight, ClipboardList } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { useMyOrders } from "@/hooks/useOrders";
import { PAGE_BLEED_PAD, PAGE_BLEED_TOP, UI_TYPE } from "@/lib/design/tokens";
import { formatDateTime, summarizeOrderCharges } from "@/lib/money";
import { formatShopAreaLabel } from "@/lib/shop/shopAreas";
import { OrderIdentity } from "@/components/orders/OrderIdentity";
import { cn } from "@/lib/utils";

export default function OrdersPage() {
  const navigate = useNavigate();
  const ordersQuery = useMyOrders();

  return (
    <div className="space-y-8">
      <section className={cn(PAGE_BLEED_TOP, "border-b border-border/70")}>
        <div className={cn(PAGE_BLEED_PAD, "py-10")}>
          <p className={UI_TYPE.eyebrow}>Historie</p>
          <h1 className="mt-2 font-display text-[clamp(2rem,4vw,3.2rem)] font-semibold tracking-tight">
            Meine Bestellungen
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Status, Fortschritt und Gesamtpreis inkl. Versand.
          </p>
        </div>
      </section>

      {ordersQuery.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {ordersQuery.isError && (
        <ErrorState message="Bestellungen konnten nicht geladen werden." onRetry={() => ordersQuery.refetch()} />
      )}

      {ordersQuery.data && ordersQuery.data.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="Du hast noch keine Bestellungen."
          description="Lege Artikel in den Warenkorb und sende die erste Bestellung ab."
          action={
            <Button asChild size="sm">
              <Link to="/shop">Zum Shop →</Link>
            </Button>
          }
        />
      )}

      {ordersQuery.data && ordersQuery.data.length > 0 && (
        <ol className="divide-y divide-border border-y border-border">
          {ordersQuery.data.map((order) => (
            <li key={order.id}>
              <button
                type="button"
                className="group flex w-full items-center gap-4 py-4 text-left transition-colors hover:bg-secondary/30"
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                <span className="hidden h-12 w-px shrink-0 bg-primary sm:block" />
                <OrderStatusBadge status={order.status} />
                <div className="min-w-0 flex-1">
                  <OrderIdentity
                    orderNumber={order.order_number}
                    telegramSnapshot={order.telegram_username_snapshot}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(order.submitted_at)}
                    {order.shop_area ? ` · ${formatShopAreaLabel(order.shop_area)}` : ""}
                  </p>
                </div>
                <p className="shrink-0 font-display text-base font-semibold tabular-nums">
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
                </p>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-primary" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
