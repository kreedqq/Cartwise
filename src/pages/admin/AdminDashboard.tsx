import { useQuery } from "@tanstack/react-query";
import { ClipboardList, FileText, Package, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExchangeRateStatusCard } from "@/components/admin/ExchangeRateStatusCard";
import { DataIssuesCard } from "@/components/admin/DataIssuesCard";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { listAllProducts } from "@/services/products";
import { listAllOrders } from "@/services/orders";
import { formatDateTime, formatUsd } from "@/lib/money";

export default function AdminDashboardPage() {
  const productsQuery = useQuery({ queryKey: ["admin-products-count"], queryFn: () => listAllProducts() });
  const ordersQuery = useQuery({ queryKey: ["admin-orders-dashboard"], queryFn: listAllOrders });

  const products = productsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const today = orders.filter((o) => o.submitted_at >= startOfDay);
  const thisMonth = orders.filter((o) => o.submitted_at >= startOfMonth);
  const open = orders.filter((o) => o.status === "pending" || o.status === "processing" || o.status === "confirmed");
  const completed = orders.filter((o) => o.status === "completed");
  const todayValue = today.reduce((sum, o) => sum + Number(o.total_usd), 0);
  const monthValue = thisMonth.reduce((sum, o) => sum + Number(o.total_usd), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={ClipboardList} label="Bestellungen heute" value={today.length} hint={formatUsd(todayValue)} />
        <StatCard icon={ShoppingCart} label="Offene Bestellungen" value={open.length} />
        <StatCard icon={ClipboardList} label="Diesen Monat" value={thisMonth.length} hint={formatUsd(monthValue)} />
        <StatCard icon={FileText} label="Abgeschlossen" value={completed.length} />
        <StatCard icon={Package} label="Produkte" value={products.length} />
        <StatCard icon={Package} label="Aktive Produkte" value={products.filter((p) => p.is_active).length} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/admin/roles"
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary/50"
        >
          Rollen & Preisregeln
        </Link>
        <Link to="/admin/shipping" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary/50">
          Versandkosten
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ExchangeRateStatusCard />
        <DataIssuesCard />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Letzte Bestellungen</CardTitle>
          <Link to="/admin/orders" className="text-sm text-primary hover:underline">
            Alle anzeigen
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {orders.slice(0, 8).map((order) => (
            <Link
              key={order.id}
              to={`/admin/orders/${order.id}`}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-secondary/50"
            >
              <div>
                <p className="font-mono text-xs font-medium">{order.order_number}</p>
                <p className="text-[11px] text-muted-foreground">{formatDateTime(order.submitted_at)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm tabular-nums">{formatUsd(order.total_usd)}</span>
                <OrderStatusBadge status={order.status} />
              </div>
            </Link>
          ))}
          {orders.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Bestellungen.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Package;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="flex items-center gap-3 p-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/80">
          <Icon className="h-3.5 w-3.5 text-foreground" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular-nums tracking-tight">{value}</p>
          {hint && <p className="truncate text-[10px] text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
