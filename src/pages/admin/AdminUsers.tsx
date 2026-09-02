import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { AdminRoleCatalog } from "@/pages/admin/AdminRoleCatalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { useAuth } from "@/context/AuthProvider";
import { formatDateTime } from "@/lib/money";
import { telegramHandleLabel } from "@/lib/username";
import {
  adminDeleteUser,
  adminSetUsernameRequired,
  listUsersWithRoles,
  type UserWithRoles,
} from "@/services/profiles";
import { assignCustomerRole, listCustomerRoles, listUserCustomerRoles } from "@/services/customerRoles";
import { setUserRole } from "@/services/roles";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: listUsersWithRoles });
  const rolesQuery = useQuery({ queryKey: ["customer-roles"], queryFn: listCustomerRoles });
  const assignmentsQuery = useQuery({ queryKey: ["user-customer-roles"], queryFn: listUserCustomerRoles });

  const [managed, setManaged] = React.useState<UserWithRoles | null>(null);
  const [adminTarget, setAdminTarget] = React.useState<{ user: UserWithRoles; grant: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<UserWithRoles | null>(null);
  const [adminLoading, setAdminLoading] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [flagLoading, setFlagLoading] = React.useState(false);

  const roles = rolesQuery.data ?? [];
  const assignmentByUser = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const row of assignmentsQuery.data ?? []) map.set(row.user_id, row.role_id);
    return map;
  }, [assignmentsQuery.data]);

  const defaultRoleId = roles.find((r) => r.is_default)?.id ?? "";

  function customerRoleFor(userId: string) {
    const roleId = assignmentByUser.get(userId) ?? defaultRoleId;
    return roles.find((r) => r.id === roleId) ?? null;
  }

  async function refreshUserQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
      queryClient.invalidateQueries({ queryKey: ["user-customer-roles"] }),
      queryClient.invalidateQueries({ queryKey: ["customer-roles"] }),
    ]);
  }

  async function handleAdminConfirm() {
    if (!adminTarget) return;
    setAdminLoading(true);
    try {
      await setUserRole(adminTarget.user.id, "admin", adminTarget.grant);
      toast.success(adminTarget.grant ? "Admin-Rolle vergeben." : "Admin-Rolle entzogen.");
      await refreshUserQueries();
      setAdminTarget(null);
      setManaged(null);
    } catch (error) {
      console.error("Rolle ändern fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Rolle konnte nicht geändert werden.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleAssign(userId: string, roleId: string) {
    try {
      await assignCustomerRole(userId, roleId);
      toast.success("Rolle zugewiesen.");
      await queryClient.invalidateQueries({ queryKey: ["user-customer-roles"] });
    } catch (error) {
      console.error("Rollenzuweisung fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Zuweisung fehlgeschlagen.");
    }
  }

  async function handleUsernameRequired(user: UserWithRoles, required: boolean) {
    setFlagLoading(true);
    try {
      await adminSetUsernameRequired(user.id, required);
      toast.success(
        required
          ? "Telegram Benutzername wird beim nächsten Login verlangt."
          : "Username-Erzwingung aufgehoben.",
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setManaged((current) =>
        current && current.id === user.id ? { ...current, usernameRequiredOnNextLogin: required } : current,
      );
    } catch (error) {
      console.error("Username-Erzwingung fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Einstellung konnte nicht gespeichert werden.");
    } finally {
      setFlagLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await adminDeleteUser(deleteTarget.id);
      toast.success("Benutzer wurde dauerhaft entfernt.");
      setDeleteTarget(null);
      setManaged(null);
      await refreshUserQueries();
    } catch (error) {
      console.error("Benutzer löschen fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Benutzer konnte nicht entfernt werden.");
    } finally {
      setDeleteLoading(false);
    }
  }

  if (usersQuery.isLoading || rolesQuery.isLoading) return <Skeleton className="h-64 w-full" />;
  if (usersQuery.isError) {
    return <ErrorState message="Benutzer konnten nicht geladen werden." onRetry={() => usersQuery.refetch()} />;
  }

  const users = usersQuery.data ?? [];
  const managedRole = managed ? customerRoleFor(managed.id) : null;
  const managedIsAdmin = managed?.roles.includes("admin") ?? false;
  const managedIsSelf = managed?.id === currentUser?.id;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Benutzer & Rollen"
        description="Benutzer verwalten, Kundenrollen zuweisen und Rollenaufschläge konfigurieren."
      />

      <AdminSection title="Benutzer" padded={false}>
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Telegram Benutzername</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Aufschlag</TableHead>
                <TableHead>Registriert</TableHead>
                <TableHead>Username erforderlich</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const role = customerRoleFor(u.id);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="text-sm font-medium">{telegramHandleLabel(u.username)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{role?.name ?? "—"}</span>
                        {u.roles.includes("admin") && <Badge variant="success">Admin</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {role ? `${Number(role.markup_percent)} %` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(u.createdAt)}</TableCell>
                    <TableCell>{u.usernameRequiredOnNextLogin ? "Ja" : "Nein"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setManaged(u)}>
                        Verwalten
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-3 p-3 md:hidden">
          {users.map((u) => {
            const role = customerRoleFor(u.id);
            return (
              <div key={u.id} className="space-y-3 rounded-lg border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{telegramHandleLabel(u.username)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {role?.name ?? "—"}
                      {role ? ` · ${Number(role.markup_percent)} %` : ""}
                    </p>
                  </div>
                  {u.roles.includes("admin") && <Badge variant="success">Admin</Badge>}
                </div>
                <dl className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                  <div className="flex justify-between gap-3">
                    <dt>Registriert</dt>
                    <dd>{formatDateTime(u.createdAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Username erforderlich</dt>
                    <dd>{u.usernameRequiredOnNextLogin ? "Ja" : "Nein"}</dd>
                  </div>
                </dl>
                <Button variant="outline" size="sm" className="w-full" onClick={() => setManaged(u)}>
                  Verwalten
                </Button>
              </div>
            );
          })}
        </div>
      </AdminSection>

      <AdminSection title="Rollen & Preisaufschlag" description="Katalog der Kundenrollen und ihrer Aufschläge." padded>
        <AdminRoleCatalog />
      </AdminSection>

      <Dialog open={!!managed} onOpenChange={(open) => !open && setManaged(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Benutzer verwalten</DialogTitle>
            <DialogDescription>Rolle, Login-Erzwingung und Account-Löschung für diesen Benutzer.</DialogDescription>
          </DialogHeader>

          {managed && (
            <div className="space-y-5">
              <section className="space-y-3 border-b border-border pb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Benutzer</h3>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Telegram Benutzername</p>
                  <p className="text-sm font-medium">{telegramHandleLabel(managed.username)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Registriert</p>
                  <p className="text-sm">{formatDateTime(managed.createdAt)}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manage-role">Rolle</Label>
                  <Select
                    value={assignmentByUser.get(managed.id) ?? defaultRoleId}
                    onValueChange={(roleId) => void handleAssign(managed.id, roleId)}
                  >
                    <SelectTrigger id="manage-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles
                        .filter((r) => r.is_active || r.id === (assignmentByUser.get(managed.id) ?? defaultRoleId))
                        .map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Preisaufschlag</p>
                  <p className="text-sm tabular-nums">
                    {managedRole ? `${Number(managedRole.markup_percent)} %` : "—"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled={managedIsAdmin && managedIsSelf}
                  title={
                    managedIsAdmin && managedIsSelf
                      ? "Du kannst dir nicht selbst die Admin-Rolle entziehen."
                      : undefined
                  }
                  onClick={() => setAdminTarget({ user: managed, grant: !managedIsAdmin })}
                >
                  {managedIsAdmin ? (
                    <>
                      <ShieldOff /> Admin entziehen
                    </>
                  ) : (
                    <>
                      <ShieldCheck /> Zu Admin machen
                    </>
                  )}
                </Button>
              </section>

              <section className="space-y-3 border-b border-border pb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Login</h3>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor="username-required" className="text-sm font-medium leading-snug">
                      Telegram Benutzername beim nächsten Login erforderlich
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Der Benutzer muss beim nächsten Login einen Telegram Benutzernamen eingeben bzw. bestätigen,
                      bevor er PEPTIX weiter nutzen kann.
                    </p>
                    <p className="text-xs font-medium">
                      Status: {managed.usernameRequiredOnNextLogin ? "Erforderlich" : "Nicht erforderlich"}
                    </p>
                  </div>
                  <Switch
                    id="username-required"
                    checked={managed.usernameRequiredOnNextLogin}
                    disabled={flagLoading}
                    onCheckedChange={(checked) => void handleUsernameRequired(managed, checked)}
                  />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</h3>
                <Button
                  variant="destructive"
                  className="w-full sm:w-auto"
                  disabled={managedIsSelf}
                  title={managedIsSelf ? "Du kannst deinen eigenen Account nicht löschen." : undefined}
                  onClick={() => setDeleteTarget(managed)}
                >
                  Benutzer dauerhaft entfernen
                </Button>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!adminTarget}
        onOpenChange={(open) => !open && setAdminTarget(null)}
        title={adminTarget?.grant ? "Admin-Rolle vergeben?" : "Admin-Rolle entziehen?"}
        description={
          adminTarget?.grant
            ? `${telegramHandleLabel(adminTarget.user.username)} erhält vollen Zugriff auf Produktverwaltung, Importe und Benutzerrollen.`
            : `${telegramHandleLabel(adminTarget?.user.username)} verliert den Zugriff auf den Admin-Bereich.`
        }
        confirmLabel={adminTarget?.grant ? "Admin machen" : "Rolle entziehen"}
        variant={adminTarget?.grant ? "default" : "destructive"}
        loading={adminLoading}
        onConfirm={handleAdminConfirm}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !deleteLoading && setDeleteTarget(null)}
        title="Benutzer dauerhaft entfernen?"
        description={
          <div className="space-y-2">
            <p>Möchtest du diesen Benutzer wirklich dauerhaft entfernen?</p>
            <p>
              Telegram Benutzername:{" "}
              <span className="font-medium text-foreground">{telegramHandleLabel(deleteTarget?.username)}</span>
            </p>
            <p>
              Der bestehende Account wird gelöscht. Der Benutzer muss sich anschließend neu registrieren. Historische
              Bestellungen bleiben erhalten.
            </p>
          </div>
        }
        confirmLabel="Dauerhaft entfernen"
        cancelLabel="Abbrechen"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
    </div>
  );
}
