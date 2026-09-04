import { Link, useSearchParams } from "react-router-dom";
import { Ban, CheckCircle2, Clock, Package, PackageCheck, Search, Truck } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminOrders } from "@/hooks/useAdminOrders";
import { useAdminOrderProgressMap } from "@/hooks/useOrderProgress";
import { resolveOrderProgress } from "@/lib/orderProgress";
import {
  SHIPPING_STAT_CARDS,
  countShippingStats,
  filterShippingHubOrders,
  formatShippingListDate,
  type ShippingListFilter,
  type TrackingListFilter,
} from "@/lib/shippingHub";
import { hasTrackingNumber } from "@/lib/tracking";
import { cn } from "@/lib/utils";
import { formatOrderTelegramSnapshot } from "@/services/orders";
import type { OrderStatus } from "@/types/database";

const STAT_ICONS = {
  pending: Clock,
  processing: Package,
  ready: PackageCheck,
  shipped: Truck,
  cancelled: Ban,
} as const;

function parseStatusFilter(value: string | null): ShippingListFilter {
  if (
    value === "pending" ||
    value === "processing" ||
    value === "ready" ||
    value === "shipped" ||
    value === "cancelled"
  ) {
    return value;
  }
  return "all";
}

function parseTrackingFilter(value: string | null): TrackingListFilter {
  if (value === "with" || value === "without") return value;
  return "all";
}

export default function AdminShipmentCenterPage() {
  const ordersQuery = useAdminOrders();
  const progressQuery = useAdminOrderProgressMap();
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const status = parseStatusFilter(params.get("status"));
  const tracking = parseTrackingFilter(params.get("tracking"));
  const orders = ordersQuery.data ?? [];
  const stats = countShippingStats(orders);
  const filtered = filterShippingHubOrders(orders, { status, tracking, search });

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (!value || value === "all") next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  }

  function progressFor(order: { id: string; status: OrderStatus; submitted_at: string }) {
    return resolveOrderProgress(order.status, progressQuery.data?.get(order.id), order.submitted_at);
  }

  if (ordersQuery.isError) {
    return <ErrorState message="Bestellungen konnten nicht geladen werden." onRetry={() => ordersQuery.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Versand"
        description="Verwalte Bestellfortschritt, Versandstatus und Sendungsverfolgung zentral an einem Ort."
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {SHIPPING_STAT_CARDS.map((card) => {
          const Icon = STAT_ICONS[card.key];
          const active = status === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => updateParams({ status: active ? "all" : card.key })}
              className={cn(
                "rounded-2xl border bg-card p-3 text-left shadow-[0_0_24px_hsl(var(--primary)/0.04)] transition-colors",
                active
                  ? "border-primary/50 ring-1 ring-primary/30"
                  : "border-primary/15 hover:border-primary/35",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-mono text-xl font-semibold tabular-nums text-foreground">
                  {ordersQuery.isLoading ? "—" : stats[card.key]}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">{card.label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{card.description}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-primary/15 bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => updateParams({ q: event.target.value || null })}
            placeholder="Bestellnummer oder Telegram-Name"
            className="pl-9"
            aria-label="Bestellungen suchen"
          />
        </div>
        <Select value={status} onValueChange={(value) => updateParams({ status: value })}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Status filtern">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {SHIPPING_STAT_CARDS.map((card) => (
              <SelectItem key={card.key} value={card.key}>
                {card.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tracking} onValueChange={(value) => updateParams({ tracking: value })}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Sendungsverfolgung filtern">
            <SelectValue placeholder="Sendungsverfolgung" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Sendungen</SelectItem>
            <SelectItem value="with">Mit Sendungsnummer</SelectItem>
            <SelectItem value="without">Ohne Sendungsnummer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {ordersQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Keine Bestellungen"
          description="Für die aktuelle Suche und die gewählten Filter gibt es keine Bestellungen."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-primary/15 bg-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-secondary/40 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Bestellnummer</th>
                  <th className="px-4 py-3 font-semibold">Telegram Benutzername</th>
                  <th className="px-4 py-3 font-semibold">Datum</th>
                  <th className="px-4 py-3 font-semibold">Bestellstatus</th>
                  <th className="px-4 py-3 font-semibold">Fortschritt</th>
                  <th className="px-4 py-3 font-semibold">Sendungsverfolgung</th>
                  <th className="px-4 py-3 font-semibold">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const progress = progressFor(order);
                  const tracked = hasTrackingNumber(order);
                  return (
                    <tr key={order.id} className="border-b border-border/70 last:border-0 hover:bg-primary/[0.03]">
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{order.order_number}</td>
                      <td className="px-4 py-3 font-medium">{formatOrderTelegramSnapshot(order)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatShippingListDate(order.submitted_at)}
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-[8rem] max-w-[12rem]">
                          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="truncate pr-2">{progress.statusLabel}</span>
                            <span className="font-mono tabular-nums text-primary">{progress.progressPercent} %</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${progress.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {tracked ? (
                          <span className="inline-flex items-center gap-1.5 text-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                            <span className="font-mono">{order.tracking_number}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Keine Sendungsnummer</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/admin/shipping/${order.id}`}>Verwalten</Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((order) => {
              const progress = progressFor(order);
              const tracked = hasTrackingNumber(order);
              return (
                <div
                  key={order.id}
                  className="space-y-3 rounded-2xl border border-primary/15 bg-card p-4 shadow-[0_0_24px_hsl(var(--primary)/0.04)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold">{order.order_number}</p>
                      <p className="mt-0.5 text-sm text-foreground">{formatOrderTelegramSnapshot(order)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatShippingListDate(order.submitted_at)}
                      </p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{progress.statusLabel}</span>
                      <span className="font-mono tabular-nums text-primary">{progress.progressPercent} %</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${progress.progressPercent}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tracked ? (
                      <span className="font-mono text-foreground">{order.tracking_number}</span>
                    ) : (
                      "Keine Sendungsnummer"
                    )}
                  </p>
                  <Button className="w-full" variant="outline" asChild>
                    <Link to={`/admin/shipping/${order.id}`}>Verwalten</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
