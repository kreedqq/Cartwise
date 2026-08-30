import { useQuery } from "@tanstack/react-query";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { listAuditLogs } from "@/services/adminStats";
import { formatDateTime } from "@/lib/money";

export default function AdminAuditLogPage() {
  const query = useQuery({ queryKey: ["admin-audit-logs"], queryFn: () => listAuditLogs(200) });

  if (query.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <AdminPageHeader title="Audit-Log" description="Protokoll aller Produkt- und Rollenänderungen (letzte 200 Einträge)." />

      {!query.data || query.data.length === 0 ? (
        <EmptyState
          title="Noch keine Einträge"
          description="Produkt- und Rollenänderungen erscheinen hier automatisch."
        />
      ) : (
        <AdminSection>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Zeitpunkt</TableHead>
                <TableHead>Aktion</TableHead>
                <TableHead>Entität</TableHead>
                <TableHead className="pr-4">Akteur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="pl-4 whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(log.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-foreground">
                    {log.entity_type}
                    {log.entity_id && (
                      <span className="ml-1 font-mono text-muted-foreground">{log.entity_id.slice(0, 8)}</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 font-mono text-xs text-muted-foreground">
                    {log.actor_id ? log.actor_id.slice(0, 8) : "System"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </AdminSection>
      )}
    </div>
  );
}
