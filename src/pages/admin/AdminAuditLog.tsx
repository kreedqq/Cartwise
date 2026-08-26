import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { listAuditLogs } from "@/services/adminStats";
import { formatDateTime } from "@/lib/money";

export default function AdminAuditLogPage() {
  const query = useQuery({ queryKey: ["admin-audit-logs"], queryFn: () => listAuditLogs(200) });

  if (query.isLoading) return <Skeleton className="h-64 w-full" />;

  if (!query.data || query.data.length === 0) {
    return <EmptyState title="Noch keine Einträge" description="Produkt- und Rollenänderungen erscheinen hier automatisch." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Zeitpunkt</TableHead>
          <TableHead>Aktion</TableHead>
          <TableHead>Entität</TableHead>
          <TableHead>Akteur</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {query.data.map((log) => (
          <TableRow key={log.id}>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              {formatDateTime(log.created_at)}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{log.action}</Badge>
            </TableCell>
            <TableCell className="text-xs">
              {log.entity_type}
              {log.entity_id && <span className="ml-1 font-mono text-muted-foreground">{log.entity_id.slice(0, 8)}</span>}
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {log.actor_id ? log.actor_id.slice(0, 8) : "System"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
