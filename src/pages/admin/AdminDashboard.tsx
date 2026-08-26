import { useQuery } from "@tanstack/react-query";
import { FileText, Package, ShieldCheck, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExchangeRateStatusCard } from "@/components/admin/ExchangeRateStatusCard";
import { DataIssuesCard } from "@/components/admin/DataIssuesCard";
import { listAllProducts } from "@/services/products";
import { listUsersWithRoles } from "@/services/profiles";
import { listImportHistory } from "@/services/pdfImport";

export default function AdminDashboardPage() {
  const productsQuery = useQuery({ queryKey: ["admin-products-count"], queryFn: () => listAllProducts() });
  const usersQuery = useQuery({ queryKey: ["admin-users-count"], queryFn: listUsersWithRoles });
  const importsQuery = useQuery({ queryKey: ["admin-imports-count"], queryFn: listImportHistory });

  const adminCount = usersQuery.data?.filter((u) => u.roles.includes("admin")).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Package} label="Produkte" value={productsQuery.data?.length ?? "—"} />
        <StatCard icon={Users} label="Benutzer" value={usersQuery.data?.length ?? "—"} />
        <StatCard icon={ShieldCheck} label="Admins" value={adminCount} />
        <StatCard icon={FileText} label="Importe" value={importsQuery.data?.length ?? "—"} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ExchangeRateStatusCard />
        <DataIssuesCard />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
