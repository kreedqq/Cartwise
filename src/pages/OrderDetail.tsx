import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, Printer, RefreshCw, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { OrderProgressTracker } from "@/components/orders/OrderProgressTracker";
import { OrderTrackingCard } from "@/components/orders/OrderTrackingCard";
import { useOrderProgress } from "@/hooks/useOrderProgress";
import { resolveOrderProgress } from "@/lib/orderProgress";
import { useMyOrder, useMyOrderStatusHistory } from "@/hooks/useOrders";
import { useShopCart } from "@/hooks/useShopCart";
import { useOrderTemplateMutations } from "@/hooks/useOrderTemplates";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { OrderChargeSummary } from "@/components/orders/OrderChargeSummary";
import { OrderShippingCard } from "@/components/orders/OrderShippingCard";
import { downloadOrderCsv, printOrderDocument, toOrderExportDoc } from "@/lib/orderExport";
import { formatDateTime, formatEur, formatUsd, summarizeOrderCharges } from "@/lib/money";
import { formatOrderItemQuantity } from "@/lib/quantityFormat";
import { listKitSizesForOrder } from "@/services/kitOrderContext";
import { QUERY_KEYS } from "@/lib/constants";
import { PAYMENT_METHOD_LABELS, isPaymentMethod } from "@/lib/shop/paymentMethod";
import { cartItemDisplayName, cartItemVariantSubtitle } from "@/lib/shop/cartDisplay";
import { ORDER_STATUS_LABELS, formatOrderTelegramSnapshot, orderItemsToBulkLines } from "@/services/orders";
import { toast } from "@/components/ui/toaster";

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const orderQuery = useMyOrder(orderId);
  const historyQuery = useMyOrderStatusHistory(orderId);
  const kitSizesQuery = useQuery({
    queryKey: QUERY_KEYS.orderKitSizes(orderId ?? ""),
    queryFn: () => listKitSizesForOrder(orderId as string),
    enabled: Boolean(orderId),
  });
  const progressQuery = useOrderProgress(orderId);
  const rateQuery = useExchangeRate();
  const { addManyToActiveCart } = useShopCart();
  const templates = useOrderTemplateMutations();
  const [templateName, setTemplateName] = React.useState("");
  const [reordering, setReordering] = React.useState(false);

  if (orderQuery.isLoading) return <FullScreenSpinner label="Bestellung wird geladen …" />;
  if (orderQuery.isError) {
    return <ErrorState message="Bestellung konnte nicht geladen werden." onRetry={() => orderQuery.refetch()} />;
  }
  if (!orderQuery.data) {
    return <EmptyState title="Bestellung nicht gefunden" description="Diese Bestellung existiert nicht oder gehört einem anderen Konto." />;
  }

  const order = orderQuery.data;
  const kitSizes = kitSizesQuery.data;

  function itemKitSize(item: (typeof order.items)[number]) {
    return item.product_id ? kitSizes?.get(item.product_id) ?? null : null;
  }

  const exportDoc = toOrderExportDoc(order, order.items, undefined, null, { audience: "customer", kitSizes });

  async function handleReorder() {
    setReordering(true);
    try {
      const items = await addManyToActiveCart(orderItemsToBulkLines(order.items), rateQuery.data?.rate ?? null);
      const unavailable = items.filter((i) => i.resolution_status !== "resolved");
      const added = items.length - unavailable.length;
      if (added > 0) toast.success(`${added} Artikel mit aktuellen Preisen in den Warenkorb übernommen.`);
      if (unavailable.length > 0) {
        toast.error("Einige Artikel sind nicht mehr verfügbar.", {
          description: unavailable.map((i) => i.product_code_input).join(", "),
        });
      }
      navigate("/dashboard");
    } catch (error) {
      console.error("Erneut bestellen fehlgeschlagen:", error);
      toast.error("Die Bestellung konnte nicht übernommen werden.");
    } finally {
      setReordering(false);
    }
  }

  async function handleSaveTemplate() {
    const name = templateName.trim();
    if (!name) {
      toast.error("Bitte gib einen Namen für die Vorlage ein.");
      return;
    }
    try {
      await templates.create.mutateAsync({
        name,
        lines: order.items.map((item) => ({ productCode: item.product_code_snapshot, quantity: item.quantity })),
      });
      toast.success(`Vorlage „${name}" gespeichert.`);
      setTemplateName("");
    } catch (error) {
      console.error("Vorlage speichern fehlgeschlagen:", error);
      toast.error("Vorlage konnte nicht gespeichert werden.");
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/orders")}>
        <ArrowLeft /> Zurück zu meinen Bestellungen
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">Telegram: {formatOrderTelegramSnapshot(order)}</p>
          <p className="text-sm text-muted-foreground">{formatDateTime(order.submitted_at)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="space-y-4">
        <OrderProgressTracker
          progress={resolveOrderProgress(order.status, progressQuery.data, order.submitted_at)}
        />
        <OrderTrackingCard tracking={order} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleReorder} loading={reordering}>
          <RefreshCw /> Erneut bestellen
        </Button>
        <Button variant="outline" size="sm" onClick={() => printOrderDocument(exportDoc)}>
          <Printer /> Als PDF
        </Button>
        <Button variant="outline" size="sm" onClick={() => downloadOrderCsv(exportDoc)}>
          <FileDown /> CSV
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Code</TableHead>
                <TableHead>Artikel</TableHead>
                <TableHead className="text-right">Menge</TableHead>
                <TableHead className="hidden sm:table-cell">Preisart</TableHead>
                <TableHead className="text-right">Einzelpreis</TableHead>
                <TableHead className="text-right">Gesamt USD</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Gesamt EUR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="hidden sm:table-cell font-mono text-xs">{item.product_code_snapshot}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{cartItemDisplayName(item)}</p>
                    {cartItemVariantSubtitle(item) && (
                      <p className="text-xs text-muted-foreground">{cartItemVariantSubtitle(item)}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatOrderItemQuantity(item, itemKitSize(item))}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs">
                    {item.applied_price_tier === "bulk" ? "Mengenpreis" : "Normalpreis"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatUsd(item.unit_price_usd_snapshot)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatUsd(item.line_total_usd)}</TableCell>
                  <TableCell className="hidden sm:table-cell text-right tabular-nums text-primary">
                    {item.eur_value_snapshot != null ? formatEur(item.eur_value_snapshot) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <OrderShippingCard snapshot={order} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summe</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderChargeSummary
              charges={summarizeOrderCharges({
                productUsd: order.total_usd,
                productEur: order.total_eur,
                chinaAmount: order.china_shipping_amount,
                chinaCurrency: order.china_shipping_currency,
                deAmount: order.de_shipping_amount,
                deCurrency: order.de_shipping_currency,
                usdToEurRate: order.exchange_rate,
              })}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verlauf</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(historyQuery.data ?? []).map((entry) => (
              <div key={entry.id} className="flex justify-between gap-3">
                <span>{ORDER_STATUS_LABELS[entry.new_status]}</span>
                <span className="text-muted-foreground">{formatDateTime(entry.changed_at)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-border pt-2">
              <span>Zahlungsmethode</span>
              <span className="font-medium">
                {isPaymentMethod(order.payment_method) ? PAYMENT_METHOD_LABELS[order.payment_method] : "—"}
              </span>
            </div>
            {order.note && (
              <p className="border-t border-border pt-2 text-muted-foreground">
                Notiz: {order.note}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4" /> Als Bestellvorlage speichern
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="z. B. Standardbestellung"
            className="max-w-xs"
          />
          <Button variant="outline" onClick={handleSaveTemplate} loading={templates.create.isPending}>
            Speichern
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
