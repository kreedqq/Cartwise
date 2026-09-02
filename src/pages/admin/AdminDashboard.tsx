import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  ClipboardList,
  DollarSign,
  Package,
  RefreshCw,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AdminSection } from "@/components/admin/AdminSection";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExchangeRateStatusCard } from "@/components/admin/ExchangeRateStatusCard";
import { DataIssuesCard } from "@/components/admin/DataIssuesCard";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { PaymentMethodBadge } from "@/components/orders/PaymentMethodBadge";
import { listAllProducts } from "@/services/products";
import { listAllOrders } from "@/services/orders";
import { listUsersWithRoles } from "@/services/profiles";
import { formatDateTime, formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";
import { OrderIdentity } from "@/components/orders/OrderIdentity";

export default function AdminDashboardPage() {
  const productsQuery = useQuery({ queryKey: ["admin-products-count"], queryFn: () => listAllProducts() });
  const ordersQuery = useQuery({ queryKey: ["admin-orders-dashboard"], queryFn: listAllOrders });
  const usersQuery = useQuery({ queryKey: ["admin-users-count"], queryFn: listUsersWithRoles });

  const products = productsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const users = usersQuery.data ?? [];

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thisMonth = orders.filter((o) => o.submitted_at >= startOfMonth);
  const open = orders.filter((o) => o.status === "pending" || o.status === "processing" || o.status === "confirmed");
  const monthValue = thisMonth.reduce((sum, o) => sum + Number(o.total_usd), 0);

  const isLoading = productsQuery.isLoading || ordersQuery.isLoading;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Bestelleingänge"
          value={isLoading ? null : orders.length}
          icon={ClipboardList}
          color="gold"
          to="/admin/orders"
        />
        <KpiCard
          label="Offen / Aktiv"
          value={isLoading ? null : open.length}
          icon={AlertCircle}
          color={open.length > 0 ? "warning" : "neutral"}
          to="/admin/orders"
        />
        <KpiCard
          label="Umsatz (Monat)"
          value={isLoading ? null : formatUsd(monthValue)}
          icon={DollarSign}
          color="gold"
        />
        <KpiCard
          label="Kunden"
          value={usersQuery.isLoading ? null : users.length}
          icon={Users}
          color="neutral"
          to="/admin/users"
        />
        <KpiCard
          label="Produkte gesamt"
          value={isLoading ? null : products.length}
          icon={Package}
          color="neutral"
          to="/admin/products"
        />
        <KpiCard
          label="Aktive Produkte"
          value={isLoading ? null : products.filter((p) => p.is_active).length}
          icon={Package}
          color="neutral"
          to="/admin/products"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction to="/admin/users" icon={ShieldCheck} label="Benutzer & Rollen" />
        <QuickAction to="/admin/surcharges" icon={DollarSign} label="Rollenaufschläge" />
        <QuickAction to="/admin/shipping" icon={Truck} label="Versandkosten" />
        <QuickAction to="/admin/products" icon={Package} label="Produkte verwalten" />
        <QuickAction to="/admin/users" icon={Users} label="Benutzer verwalten" />
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ExchangeRateStatusCard />
        <DataIssuesCard />
      </div>

      {/* Recent orders */}
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
                className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-secondary/60"
              >
                <div className="min-w-0">
                  <OrderIdentity
                    orderNumber={order.order_number}
                    telegramSnapshot={order.telegram_username_snapshot}
                  />
                  <p className="text-[11px] text-muted-foreground">{formatDateTime(order.submitted_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden sm:block">
                    <PaymentMethodBadge paymentMethod={order.payment_method} />
                  </span>
                  <span className="text-xs tabular-nums text-foreground">{formatUsd(order.total_usd)}</span>
                  <OrderStatusBadge status={order.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </AdminSection>
    </div>
  );
}

/* ─── KPI card ──────────────────────────────────────────────────────────── */
function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  to,
}: {
  label: string;
  value: number | string | null;
  icon: typeof Package;
  color: "gold" | "warning" | "neutral";
  to?: string;
}) {
  const iconClass = cn(
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
    color === "gold" && "bg-primary/12 text-primary",
    color === "warning" && "bg-warning/15 text-warning",
    color === "neutral" && "bg-muted text-muted-foreground",
  );

  const inner = (
    <div className="flex items-center gap-3 p-3.5">
      <span className={iconClass}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
        {value === null ? (
          <Skeleton className="mt-1 h-5 w-12" />
        ) : (
          <p className="text-lg font-bold tabular-nums tracking-tight text-foreground">{value}</p>
        )}
      </div>
    </div>
  );

  const cardClass =
    "rounded-lg border border-border bg-card shadow-[0_1px_2px_0_hsl(var(--foreground)/0.04)] transition-shadow hover:shadow-[0_2px_8px_0_hsl(var(--foreground)/0.08)]";

  if (to) {
    return (
      <Link to={to} className={cn(cardClass, "block")}>
        {inner}
      </Link>
    );
  }
  return <div className={cardClass}>{inner}</div>;
}

/* ─── Quick action card ─────────────────────────────────────────────────── */
function QuickAction({ to, icon: Icon, label }: { to: string; icon: typeof Package; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-2.5 text-xs font-medium text-foreground shadow-[0_1px_2px_0_hsl(var(--foreground)/0.04)] transition-all hover:border-primary/30 hover:shadow-[0_2px_8px_0_hsl(var(--foreground)/0.08)]"
    >
      <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="truncate">{label}</span>
      <ArrowRight className="ml-auto h-3 w-3 shrink-0 text-muted-foreground/50" />
    </Link>
  );
}

/* ─── Refresh button helper ─────────────────────────────────────────────── */
function _RefreshButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} loading={loading} className="h-7 gap-1 text-xs">
      <RefreshCw className="h-3 w-3" /> Aktualisieren
    </Button>
  );
}
