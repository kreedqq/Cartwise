import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { AdminSection } from "@/components/admin/AdminSection";
import { Skeleton } from "@/components/ui/skeleton";
import { QUERY_KEYS } from "@/lib/constants";
import { healthLabel, type SystemHealthLevel } from "@/lib/admin/systemHealthStatus";
import { UI_RADIUS } from "@/lib/design/tokens";
import { fetchAdminSystemHealth } from "@/services/adminSystemHealth";
import { cn } from "@/lib/utils";

function HealthIcon({ level }: { level: SystemHealthLevel }) {
  if (level === "error") return <XCircle className="h-4 w-4 text-destructive" aria-hidden />;
  if (level === "needs_attention") return <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />;
  return <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />;
}

export function AdminSystemHealthSection() {
  const query = useQuery({
    queryKey: QUERY_KEYS.adminSystemHealth,
    queryFn: fetchAdminSystemHealth,
    staleTime: 30_000,
  });

  const data = query.data;

  return (
    <AdminSection title="Systemstatus">
      {query.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : query.isError || !data ? (
        <p className="text-sm text-destructive">Systemstatus konnte nicht geladen werden.</p>
      ) : (
        <div className="space-y-4">
          <div
            className={cn(
              "flex items-center gap-3 border border-border bg-card px-4 py-3",
              UI_RADIUS.md,
            )}
          >
            <Activity className="h-5 w-5 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-foreground">Gesamt</p>
              <p className="text-xs text-muted-foreground">{healthLabel(data.overall)}</p>
            </div>
            <div className="ml-auto">
              <HealthIcon level={data.overall} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.cards.map((card) => {
              const inner = (
                <div
                  className={cn(
                    "flex h-full flex-col gap-1 border border-border bg-card p-3.5 transition-colors",
                    UI_RADIUS.md,
                    card.href && "hover:border-primary/30",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {card.title}
                    </p>
                    <HealthIcon level={card.level} />
                  </div>
                  <p className="text-lg font-bold tabular-nums tracking-tight text-foreground">{card.value}</p>
                  <p className="text-xs leading-snug text-muted-foreground">{card.context}</p>
                  <p className="mt-auto pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {healthLabel(card.level)}
                  </p>
                </div>
              );
              return card.href ? (
                <Link key={card.id} to={card.href} className="block min-h-[44px]">
                  {inner}
                </Link>
              ) : (
                <div key={card.id}>{inner}</div>
              );
            })}
          </div>
        </div>
      )}
    </AdminSection>
  );
}
