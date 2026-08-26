import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { listUsersWithRoles, type UserWithRoles } from "@/services/profiles";
import { setUserRole } from "@/services/roles";
import { toast } from "@/components/ui/toaster";
import { useAuth } from "@/context/AuthProvider";
import { formatDateTime } from "@/lib/money";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: listUsersWithRoles });
  const [target, setTarget] = React.useState<{ user: UserWithRoles; grant: boolean } | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleConfirm() {
    if (!target) return;
    setLoading(true);
    try {
      await setUserRole(target.user.id, "admin", target.grant);
      toast.success(target.grant ? "Admin-Rolle vergeben." : "Admin-Rolle entzogen.");
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rolle konnte nicht geändert werden.");
    } finally {
      setLoading(false);
    }
  }

  if (usersQuery.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Anzeigename</TableHead>
            <TableHead>Rollen</TableHead>
            <TableHead>Registriert seit</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(usersQuery.data ?? []).map((u) => {
            const isAdmin = u.roles.includes("admin");
            const isSelf = u.id === currentUser?.id;
            return (
              <TableRow key={u.id}>
                <TableCell className="text-sm font-medium">{u.displayName}</TableCell>
                <TableCell>
                  <div className="flex gap-1.5">
                    {u.roles.map((role) => (
                      <Badge key={role} variant={role === "admin" ? "success" : "secondary"}>
                        {role === "admin" ? "Admin" : "Nutzer"}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDateTime(u.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isAdmin && isSelf}
                    title={isAdmin && isSelf ? "Du kannst dir nicht selbst die Admin-Rolle entziehen." : undefined}
                    onClick={() => setTarget({ user: u, grant: !isAdmin })}
                  >
                    {isAdmin ? (
                      <>
                        <ShieldOff /> Admin entziehen
                      </>
                    ) : (
                      <>
                        <ShieldCheck /> Zu Admin machen
                      </>
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={!!target}
        onOpenChange={(open) => !open && setTarget(null)}
        title={target?.grant ? "Admin-Rolle vergeben?" : "Admin-Rolle entziehen?"}
        description={
          target?.grant
            ? `„${target.user.displayName}" erhält vollen Zugriff auf Produktverwaltung, Importe und Benutzerrollen.`
            : `„${target?.user.displayName}" verliert den Zugriff auf den Admin-Bereich.`
        }
        confirmLabel={target?.grant ? "Admin machen" : "Rolle entziehen"}
        variant={target?.grant ? "default" : "destructive"}
        loading={loading}
        onConfirm={handleConfirm}
      />
    </>
  );
}
