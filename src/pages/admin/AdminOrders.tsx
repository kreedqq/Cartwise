import * as React from "react";
import { useNavigate } from "react-router-dom";
import { FileDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { useAdminOrderItems, useAdminOrders, useAdminUserDirectory } from "@/hooks/useAdminOrders";
import { buildOrdersListCsv, downloadOrdersListCsv } from "@/lib/orderExport";
import { formatDateTime, formatUsd, summarizeOrderCharges } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/services/orders";
import type { OrderStatus } from "@/types/database";

const STATUS_FILTERS: Array<{ value: "all" | OrderStatus; label: string }> = [
  { value: "all", label: "Alle" },
  { value: "pending", label: ORDER_STATUS_LABELS.pending },
  { value: "processing", label: ORDER_STATUS_LABELS.processing },
  { value: "confirmed", label: ORDER_STATUS_LABELS.confirmed },
  { value: "completed", label: ORDER_STATUS_LABELS.completed },
  { value: "cancelled", label: ORDER_STATUS_LABELS.cancelled },
];

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const ordersQuery = useAdminOrders();
  const itemsQuery = useAdminOrderItems();
  const directoryQuery = useAdminUserDirectory();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<"all" | OrderStatus>("all");

  const filtered = React.useMemo(() => {
    const orders = ordersQuery.data ?? [];
    const items = itemsQuery.data ?? [];
    const directory = directoryQuery.data;
    const term = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (status !== "all" && order.status !== status) return false;
      if (!term) return true;
      const customer = directory?.get(order.user_id);
      const customerHay = `${customer?.displayName ?? ""} ${customer?.email ?? ""}`.toLowerCase();
      if (order.order_number.toLowerCase().includes(term)) return true;
      if (customerHay.includes(term)) return true;
      return items.some(
        (item) =>
          item.order_id === order.id &&
          (item.product_code_snapshot.toLowerCase().includes(term) ||
            item.product_name_snapshot.toLowerCase().includes(term)),
      );
    });
  }, [ordersQuery.data, itemsQuery.data, directoryQuery.data, search, status]);

  function handleExport() {
    const directory = directoryQuery.data;
    downloadOrdersListCsv(
      "bestellungen.csv",
      buildOrdersListCsv(
        filtered.map((order) => ({
          order_number: order.order_number,
          status: order.status,
          submitted_at: order.submitted_at,
          total_usd: order.total_usd,
          total_eur: order.total_eur,
          customerLabel: directory?.get(order.user_id)?.displayName ?? order.user_id,
          china_shipping_amount: order.china_shipping_amount,
          china_shipping_currency: order.china_shipping_currency,
          de_shipping_amount: order.de_shipping_amount,
          de_shipping_currency: order.de_shipping_currency,
          exchange_rate: order.exchange_rate,
        })),
      ),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Bestellnummer, Kunde, E-Mail, Artikelcode …"
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as "all" | OrderStatus)}>
          <SelectTrigger className="w-48">
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
        <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
          <FileDown /> CSV
        </Button>
      </div>

      {ordersQuery.isLoading && <Skeleton className="h-64 w-full" />}
      {ordersQuery.isError && (
        <ErrorState message="Bestellungen konnten nicht geladen werden." onRetry={() => ordersQuery.refetch()} />
      )}
      {ordersQuery.data && filtered.length === 0 && (
        <EmptyState title="Keine Bestellungen gefunden." />
      )}

      {filtered.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bestellnummer</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Gesamt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((order) => {
              const customer = directoryQuery.data?.get(order.user_id);
              return (
                <TableRow
                  key={order.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/admin/orders/${order.id}`)}
                >
                  <TableCell className="font-mono text-xs font-medium">{order.order_number}</TableCell>
                  <TableCell>
                    <p className="text-sm">{customer?.displayName ?? "—"}</p>
                    {customer?.email && <p className="text-xs text-muted-foreground">{customer.email}</p>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(order.submitted_at)}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <p className="tabular-nums text-sm font-medium">
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
                    <p className="tabular-nums text-xs text-muted-foreground">{formatUsd(order.total_usd)} Produkte</p>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
