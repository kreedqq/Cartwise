import * as React from "react";
import { useNavigate } from "react-router-dom";
import { FileDown, Search } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusSelect } from "@/components/orders/OrderStatusSelect";
import { PaymentMethodBadge } from "@/components/orders/PaymentMethodBadge";
import { toast } from "@/components/ui/toaster";
import { useAdminOrderItems, useAdminOrders, useAdminUserDirectory } from "@/hooks/useAdminOrders";
import { useSetOrderStatus } from "@/hooks/useOrders";
import { buildAdminOrderItemsCsv, downloadOrdersListCsv } from "@/lib/orderExport";
import { formatDateTime, formatUsd, summarizeOrderCharges } from "@/lib/money";
import { formatDeliveryMethodLabel } from "@/lib/shippingAddress";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/shop/paymentMethod";
import {
  ADMIN_WORKFLOW_STATUSES,
  ORDER_STATUS_LABELS,
  formatOrderTelegramSnapshot,
  orderTelegramUsername,
} from "@/services/orders";
import type { OrderStatus } from "@/types/database";

const STATUS_FILTERS: Array<{ value: "all" | OrderStatus; label: string }> = [
  { value: "all", label: "Alle Status" },
  ...ADMIN_WORKFLOW_STATUSES.map((value) => ({ value, label: ORDER_STATUS_LABELS[value] })),
  { value: "confirmed", label: ORDER_STATUS_LABELS.confirmed },
  { value: "cancelled", label: ORDER_STATUS_LABELS.cancelled },
];

const PAYMENT_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Alle Zahlungen" },
  ...PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] })),
  { value: "none", label: "Nicht angegeben" },
];

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const ordersQuery = useAdminOrders();
  const itemsQuery = useAdminOrderItems();
  const directoryQuery = useAdminUserDirectory();
  const setStatusMutation = useSetOrderStatus();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<"all" | OrderStatus>("all");
  const [payment, setPayment] = React.useState("all");
  const [pendingOrderId, setPendingOrderId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const orders = ordersQuery.data ?? [];
    const items = itemsQuery.data ?? [];
    const directory = directoryQuery.data;
    const term = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (status !== "all" && order.status !== status) return false;
      if (payment !== "all") {
        if (payment === "none" && order.payment_method != null) return false;
        if (payment !== "none" && order.payment_method !== payment) return false;
      }
      if (!term) return true;
      const customer = order.user_id ? directory?.get(order.user_id) : undefined;
      const customerHay = `${orderTelegramUsername(order) ?? ""} ${customer?.email ?? ""}`.toLowerCase();
      if (order.order_number.toLowerCase().includes(term)) return true;
      if (customerHay.includes(term)) return true;
      return items.some(
        (item) =>
          item.order_id === order.id &&
          (item.product_code_snapshot.toLowerCase().includes(term) ||
            item.product_name_snapshot.toLowerCase().includes(term)),
      );
    });
  }, [ordersQuery.data, itemsQuery.data, directoryQuery.data, search, status, payment]);

  async function handleStatusChange(orderId: string, nextStatus: OrderStatus) {
    setPendingOrderId(orderId);
    try {
      await setStatusMutation.mutateAsync({ orderId, status: nextStatus });
      toast.success(`Status: ${ORDER_STATUS_LABELS[nextStatus]}`);
    } catch (error) {
      console.error("Bestellstatus ändern fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Status konnte nicht geändert werden.");
    } finally {
      setPendingOrderId(null);
    }
  }

  function handleExport() {
    const items = itemsQuery.data ?? [];
    downloadOrdersListCsv(
      "bestelleingaenge.csv",
      buildAdminOrderItemsCsv(
        filtered.flatMap((order) => {
          const telegram = order.telegram_username_snapshot?.trim() || null;
          const delivery = formatDeliveryMethodLabel(order.shipping_delivery_method);
          const orderItems = items.filter((item) => item.order_id === order.id);
          if (orderItems.length === 0) {
            return [
              {
                order_number: order.order_number,
                submitted_at: order.submitted_at,
                telegramUsername: telegram,
                productCode: "",
                productName: "",
                quantity: 0,
                unitPriceUsd: 0,
                lineTotalUsd: 0,
                deliveryMethodLabel: delivery,
                roleSurchargeUsd: null,
                orderTotalUsd: order.total_usd,
              },
            ];
          }
          return orderItems.map((item) => ({
            order_number: order.order_number,
            submitted_at: order.submitted_at,
            telegramUsername: telegram,
            productCode: item.product_code_snapshot,
            productName: item.product_name_snapshot,
            quantity: item.quantity,
            unitPriceUsd: item.unit_price_usd_snapshot,
            lineTotalUsd: item.line_total_usd,
            deliveryMethodLabel: delivery,
            roleSurchargeUsd: null,
            orderTotalUsd: order.total_usd,
          }));
        }),
      ),
    );
  }

  const hasFilters = search.trim() !== "" || status !== "all" || payment !== "all";

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Eingegangene Bestellungen"
        description={`${filtered.length} ${filtered.length === 1 ? "Bestellung" : "Bestellungen"}${hasFilters ? " gefunden" : " gesamt"}`}
        actions={
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
            <FileDown /> CSV-Export
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Bestellnummer, Telegram Benutzername, E-Mail …"
            className="pl-8 text-sm"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as "all" | OrderStatus)}>
          <SelectTrigger className="w-full flex-1 text-sm sm:w-44 sm:flex-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={payment} onValueChange={setPayment}>
          <SelectTrigger className="w-full flex-1 text-sm sm:w-44 sm:flex-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_FILTERS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* States */}
      {ordersQuery.isLoading && <Skeleton className="h-64 w-full" />}
      {ordersQuery.isError && (
        <ErrorState message="Bestellungen konnten nicht geladen werden." onRetry={() => ordersQuery.refetch()} />
      )}
      {!ordersQuery.isLoading && !ordersQuery.isError && filtered.length === 0 && (
        <EmptyState
          title="Keine Bestellungen gefunden"
          description={
            hasFilters
              ? "Versuche einen anderen Filter oder lösche die Suche."
              : "Noch keine Bestellungen vorhanden."
          }
        />
      )}

      {/* Table — desktop */}
      {filtered.length > 0 && (
        <AdminSection>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Bestellung</TableHead>
                  <TableHead>Telegram Benutzername</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Zahlung</TableHead>
                  <TableHead className="pr-4 text-right">Gesamt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((order) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                  >
                    <TableCell className="pl-4 font-mono text-xs font-semibold">{order.order_number}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatOrderTelegramSnapshot(order)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(order.submitted_at)}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <OrderStatusSelect
                        value={order.status}
                        disabled={pendingOrderId === order.id}
                        onValueChange={(next) => void handleStatusChange(order.id, next)}
                      />
                    </TableCell>
                    <TableCell>
                      <PaymentMethodBadge paymentMethod={order.payment_method} />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <p className="tabular-nums text-sm font-semibold">
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
                      <p className="tabular-nums text-[11px] text-muted-foreground">
                        {formatUsd(order.total_usd)}
                      </p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 p-3 md:hidden">
            {filtered.map((order) => (
              <div
                key={order.id}
                className="w-full space-y-2 rounded-lg border border-border bg-background p-3 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                  >
                    <p className="font-mono text-sm font-semibold">{order.order_number}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Telegram: {formatOrderTelegramSnapshot(order)}
                    </p>
                  </button>
                  <OrderStatusSelect
                    value={order.status}
                    disabled={pendingOrderId === order.id}
                    className="w-[11.5rem] shrink-0"
                    onValueChange={(next) => void handleStatusChange(order.id, next)}
                  />
                </div>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 text-left text-xs text-muted-foreground"
                  onClick={() => navigate(`/admin/orders/${order.id}`)}
                >
                  <span>{formatDateTime(order.submitted_at)}</span>
                  <span className="tabular-nums font-semibold text-foreground">
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
                </button>
                <PaymentMethodBadge paymentMethod={order.payment_method} />
              </div>
            ))}
          </div>
        </AdminSection>
      )}
    </div>
  );
}
