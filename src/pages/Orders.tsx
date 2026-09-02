import { useNavigate } from "react-router-dom";
import { ClipboardList } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { useMyOrders } from "@/hooks/useOrders";
import { formatDateTime, summarizeOrderCharges } from "@/lib/money";
import { PageHeader } from "@/components/common/PageHeader";
import { OrderIdentity } from "@/components/orders/OrderIdentity";

export default function OrdersPage() {
  const navigate = useNavigate();
  const ordersQuery = useMyOrders();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Historie"
        title="Meine Bestellungen"
        description="Alle abgeschickten Bestellungen mit Status und Gesamt Endpreis inkl. Versand."
      />

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
        />
      )}

      {ordersQuery.data && ordersQuery.data.length > 0 && (
        <div className="space-y-2">
          {ordersQuery.data.map((order) => (
            <Card
              key={order.id}
              className="cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => navigate(`/orders/${order.id}`)}
            >
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <OrderIdentity
                    orderNumber={order.order_number}
                    telegramSnapshot={order.telegram_username_snapshot}
                  />
                  <p className="text-xs text-muted-foreground">{formatDateTime(order.submitted_at)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">
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
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
