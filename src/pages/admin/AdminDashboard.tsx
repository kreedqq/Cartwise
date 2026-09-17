import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Layers,
  Megaphone,
  Package,
  Palette,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { ExchangeRateStatusCard } from "@/components/admin/ExchangeRateStatusCard";
import { QuantityDiscountsSwitch } from "@/components/admin/QuantityDiscountsSwitch";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { PaymentMethodBadge } from "@/components/orders/PaymentMethodBadge";
import { OrderIdentity } from "@/components/orders/OrderIdentity";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { QUERY_KEYS } from "@/lib/constants";
import { formatDateTime, formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";
import { fetchAdminSystemHealth, type AdminSystemHealthCard } from "@/services/adminSystemHealth";
import { listAllOrders } from "@/services/orders";

export default function AdminDashboardPage() {
  // Use the system health service for all counts — avoids full dataset loads
  const healthQuery = useQuery({
    queryKey: QUERY_KEYS.adminSystemHealth,
    queryFn: fetchAdminSystemHealth,
    staleTime: 30_000,
  });

  // Keep a targeted recent-orders query (last 10 only) for the activity feed
  const ordersQuery = useQuery({
    queryKey: ["admin-orders-recent"],
    queryFn: listAllOrders,
    staleTime: 60_000,
  });

  const health = healthQuery.data;
  const orders = ordersQuery.data ?? [];

  const attentionCards = (health?.cards ?? []).filter(
    (c) => c.level === "error" || c.level === "needs_attention",
  );
  const healthyCards = (health?.cards ?? []).filter((c) => c.level === "healthy");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        section="Übersicht"
        title="Operations"
        description="Was zuerst erledigt werden muss."
      />

      {healthQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : attentionCards.length > 0 ? (
        <section className="border border-warning/40 bg-warning/[0.06] p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-warning">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Handlungsbedarf
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attentionCards.map((card) => (
              <OpsCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      ) : (
        <div className="flex items-center gap-3 border border-success/30 bg-success/8 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          <p className="text-sm font-medium text-success">Alle Systeme in Ordnung — keine offenen Probleme.</p>
        </div>
      )}

      <nav className="flex flex-wrap gap-x-6 gap-y-2 border-y border-border py-3 text-sm font-medium">
        <QuickAction to="/admin/orders" icon={ClipboardList} label="Bestellungen" />
        <QuickAction to="/admin/kit-requests" icon={Layers} label="Kit Gesuche" />
        <QuickAction to="/admin/carts" icon={ShoppingCart} label="Warenkörbe" />
        <QuickAction to="/admin/users" icon={Users} label="Benutzer" />
        <QuickAction to="/admin/products" icon={Package} label="Produkte" />
        <QuickAction to="/admin/announcements" icon={Megaphone} label="Ankündigungen" />
        <QuickAction to="/admin/design" icon={Palette} label="Design" />
        <QuickAction to="/admin/shipping-costs" icon={Truck} label="Versand" />
      </nav>

      {/* ── System status row ─────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
          Systemstatus
        </h2>
        {healthyCards.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {healthyCards.map((card) => (
              <StatusPill key={card.id} card={card} />
            ))}
          </div>
        ) : healthQuery.isLoading ? (
          <Skeleton className="h-16 w-full rounded-lg" />
        ) : (
          <p className="text-sm text-muted-foreground">
            Offene Punkte stehen oben unter Handlungsbedarf. Weitere Systeme sind derzeit nicht als ruhig gemeldet.
          </p>
        )}
      </section>

      {/* ── Exchange rate ─────────────────────────────────────────────── */}
      <div className="max-w-sm">
        <ExchangeRateStatusCard />
      </div>

      <QuantityDiscountsSwitch />

      {/* ── Recent orders ─────────────────────────────────────────────── */}
      <AdminSection
        title="Letzte Bestellungen"
        actions={
          <Button variant="ghost" size="sm" asChild className="h-7 gap-1 text-xs">
            <Link to="/admin/orders">
              Alle anzeigen <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        }
      >
        {ordersQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">Noch keine Bestellungen</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {orders.slice(0, 8).map((order) => (
              <Link
                key={order.id}
                to={`/admin/orders/${order.id}`}
                className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary/60"
              >
                {/* Status badge first — primary signal for admin */}
                <OrderStatusBadge status={order.status} />

                {/* Identity + date */}
                <div className="min-w-0 flex-1">
                  <OrderIdentity
                    orderNumber={order.order_number}
                    telegramSnapshot={order.telegram_username_snapshot}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {formatDateTime(order.submitted_at)}
                  </p>
                </div>

                {/* Amount + payment */}
                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden sm:block">
                    <PaymentMethodBadge paymentMethod={order.payment_method} />
                  </span>
                  <span className="text-xs tabular-nums text-foreground">
                    {formatUsd(order.total_usd)}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground/70" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </AdminSection>
    </div>
  );
}

/* ─── Ops card (attention / needs_attention items) ──────────────────────── */
function OpsCard({ card }: { card: AdminSystemHealthCard }) {
  const isError = card.level === "error";
  const inner = (
    <div
      className={cn(
        "group flex min-h-[5rem] flex-col gap-1 rounded-lg border p-3.5 transition-all",
        isError
          ? "border-destructive/35 bg-destructive/[0.08] hover:border-destructive/55 hover:shadow-[0_0_0_2px_hsl(var(--destructive)/0.12)]"
          : "border-warning/35 bg-warning/[0.07] hover:border-warning/55 hover:shadow-[0_0_0_2px_hsl(var(--warning)/0.12)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {card.title}
        </p>
        {isError ? (
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
        )}
      </div>
      <p
        className={cn(
          "text-2xl font-bold tabular-nums tracking-tight leading-none",
          isError ? "text-destructive" : "text-warning",
        )}
      >
        {card.value}
      </p>
      <p className="text-xs leading-snug text-muted-foreground">{card.context}</p>
      {card.href && (
        <div className="mt-1 flex items-center gap-0.5 text-[11px] font-medium opacity-0 transition-opacity group-hover:opacity-100">
          <span className={isError ? "text-destructive" : "text-warning"}>
            Details ansehen
          </span>
          <ArrowRight className={cn("h-3 w-3", isError ? "text-destructive" : "text-warning")} />
        </div>
      )}
    </div>
  );
  if (card.href) {
    return <Link to={card.href}>{inner}</Link>;
  }
  return inner;
}

/* ─── Status pill (healthy cards) ──────────────────────────────────────── */
function StatusPill({ card }: { card: AdminSystemHealthCard }) {
  const inner = (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-xs transition-colors hover:border-primary/30">
      <CheckCircle2 className="h-3 w-3 shrink-0 text-success" aria-hidden />
      <span className="truncate font-medium text-foreground">{card.title}</span>
      <span className="ml-auto shrink-0 text-muted-foreground">{card.value}</span>
    </div>
  );
  if (card.href) {
    return <Link to={card.href}>{inner}</Link>;
  }
  return inner;
}

/* ─── Quick action card ─────────────────────────────────────────────────── */
function QuickAction({ to, icon: Icon, label }: { to: string; icon: typeof Package; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-foreground hover:text-primary">
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
