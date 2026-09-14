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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { useAuth } from "@/context/AuthProvider";
import { formatDateTime } from "@/lib/money";
import { adminUserTelegramLabel, groupUsersForAdminTables } from "@/lib/adminUserGroups";
import { usernameSchema } from "@/lib/validation";
import {
  adminDeleteUser,
  adminRemoveTelegramIdentity,
  adminSetUsername,
  adminSetUsernameRequired,
  listUsersWithRoles,
  type UserWithRoles,
} from "@/services/profiles";
import { mapUsernameError } from "@/services/username";
import { assignCustomerRole, listCustomerRoles, listUserCustomerRoles } from "@/services/customerRoles";
import { setUserRole } from "@/services/roles";
import { AdminCartPriceRefresh } from "@/components/admin/AdminCartPriceRefresh";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: listUsersWithRoles });
  const rolesQuery = useQuery({ queryKey: ["customer-roles"], queryFn: listCustomerRoles });
  const assignmentsQuery = useQuery({ queryKey: ["user-customer-roles"], queryFn: listUserCustomerRoles });

  const [managed, setManaged] = React.useState<UserWithRoles | null>(null);

  React.useEffect(() => {
    if (window.location.hash !== "#rollen") return;
    const el = document.getElementById("rollen");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const [adminTarget, setAdminTarget] = React.useState<{ user: UserWithRoles; grant: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<UserWithRoles | null>(null);
  const [usernameEditTarget, setUsernameEditTarget] = React.useState<UserWithRoles | null>(null);
  const [usernameDraft, setUsernameDraft] = React.useState("");
  const [usernameEditError, setUsernameEditError] = React.useState<string | null>(null);
  const [requestTarget, setRequestTarget] = React.useState<UserWithRoles | null>(null);
  const [removeTelegramTarget, setRemoveTelegramTarget] = React.useState<UserWithRoles | null>(null);
  const [adminLoading, setAdminLoading] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [flagLoading, setFlagLoading] = React.useState(false);
  const [removeTelegramLoading, setRemoveTelegramLoading] = React.useState(false);
  const [usernameSaving, setUsernameSaving] = React.useState(false);

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

  function openUsernameEditor(user: UserWithRoles) {
    setUsernameEditTarget(user);
    setUsernameDraft(user.username ?? "");
    setUsernameEditError(null);
  }

  async function handleUsernameSave() {
    if (!usernameEditTarget) return;
    const parsed = usernameSchema.safeParse(usernameDraft.replace(/^@+/, ""));
    if (!parsed.success) {
      setUsernameEditError(parsed.error.issues[0]?.message ?? "Ungültiger Telegram Benutzername.");
      return;
    }
    setUsernameSaving(true);
    setUsernameEditError(null);
    try {
      const saved = await adminSetUsername(usernameEditTarget.id, parsed.data);
      toast.success("Telegram Benutzername gespeichert.");
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setManaged((current) =>
        current && current.id === usernameEditTarget.id
          ? { ...current, username: saved, usernameRequiredOnNextLogin: false }
          : current,
      );
      setUsernameEditTarget(null);
    } catch (error) {
      console.error("Admin Username speichern fehlgeschlagen:", error);
      setUsernameEditError(mapUsernameError(error));
    } finally {
      setUsernameSaving(false);
    }
  }

  async function handleUsernameRequired(user: UserWithRoles, required: boolean) {
    setFlagLoading(true);
    try {
      const stored = await adminSetUsernameRequired(user.id, required);
      toast.success(
        stored
          ? "Telegram Anmeldung beim nächsten Login erzwungen (in DB gespeichert)."
          : "Telegram Anmeldung-Anforderung widerrufen (in DB gespeichert).",
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setManaged((current) =>
        current && current.id === user.id ? { ...current, usernameRequiredOnNextLogin: stored } : current,
      );
      setRequestTarget(null);
    } catch (error) {
      console.error("Username-Erzwingung fehlgeschlagen:", error);
      toast.error(mapUsernameError(error) || "Einstellung konnte nicht gespeichert werden.");
    } finally {
      setFlagLoading(false);
    }
  }

  async function handleRemoveTelegramIdentity() {
    if (!removeTelegramTarget) return;
    setRemoveTelegramLoading(true);
    try {
      await adminRemoveTelegramIdentity(removeTelegramTarget.id);
      toast.success("Telegram Zuordnung entfernt.");
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setManaged((current) =>
        current && current.id === removeTelegramTarget.id
          ? {
              ...current,
              hasTelegramIdentity: false,
              hasTelegramProviderOrphan: false,
              usernameRequiredOnNextLogin: false,
            }
          : current,
      );
      setRemoveTelegramTarget(null);
    } catch (error) {
      console.error("Telegram Zuordnung entfernen fehlgeschlagen:", error);
      toast.error(mapUsernameError(error));
    } finally {
      setRemoveTelegramLoading(false);
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
  const userGroups = groupUsersForAdminTables(users, roles, assignmentByUser, defaultRoleId);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        section="Kunden & Rollen"
        subsection="Benutzer"
        title="Benutzer verwalten"
        description="Kundenkonten, Telegram-Verbindung, Username und Rollenzuweisung."
      />
      <AdminCartPriceRefresh />

      {userGroups.map((group) => (
        <AdminSection key={group.id} title={group.title} padded={false}>
          {group.users.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Keine Benutzer in dieser Rolle.</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telegram Benutzername</TableHead>
                      <TableHead>Rolle</TableHead>
                      <TableHead>Aufschlag</TableHead>
                      <TableHead>Registriert</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.users.map((u) => {
                      const role = customerRoleFor(u.id);
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="text-sm font-medium">{adminUserTelegramLabel(u.username)}</TableCell>
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
                          <TableCell className="text-sm">
                            {u.hasTelegramIdentity
                              ? "Telegram verknüpft"
                              : u.usernameRequiredOnNextLogin
                                ? "Telegram Anmeldung angefordert"
                                : u.username
                                  ? "✓ Gesperrt"
                                  : "Ohne Username"}
                          </TableCell>
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
                {group.users.map((u) => {
                  const role = customerRoleFor(u.id);
                  return (
                    <div key={u.id} className="space-y-3 rounded-lg border border-border bg-background p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{adminUserTelegramLabel(u.username)}</p>
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
                          <dt>Status</dt>
                          <dd>
                            {u.hasTelegramIdentity
                              ? "Telegram verknüpft"
                              : u.usernameRequiredOnNextLogin
                                ? "Telegram Anmeldung angefordert"
                                : u.username
                                  ? "✓ Gesperrt"
                                  : "Ohne Username"}
                          </dd>
                        </div>
                      </dl>
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setManaged(u)}>
                        Verwalten
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </AdminSection>
      ))}

      <AdminSection
        id="rollen"
        title="Rollen & Preisaufschlag"
        description="Katalog der Kundenrollen und ihrer Aufschläge."
        padded
      >
        <AdminRoleCatalog />
      </AdminSection>

      <Dialog open={!!managed} onOpenChange={(open) => !open && setManaged(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Benutzer verwalten</DialogTitle>
            <DialogDescription>Telegram Benutzername, Rolle und Account für diesen Benutzer.</DialogDescription>
          </DialogHeader>

          {managed && (
            <div className="space-y-5">
              <section className="space-y-3 border-b border-border pb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Telegram Benutzername
                </h3>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{adminUserTelegramLabel(managed.username)}</p>
                  <p className="text-xs text-muted-foreground">
                    Status:{" "}
                    {managed.hasTelegramIdentity
                      ? "Telegram verbunden"
                      : managed.hasTelegramProviderOrphan
                        ? "Telegram Metadata verwaist (Identity fehlt)"
                        : managed.usernameRequiredOnNextLogin
                          ? "Telegram Anmeldung beim nächsten Login angefordert"
                          : "Telegram nicht verbunden"}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => openUsernameEditor(managed)}>
                    {managed.username ? "Benutzername bearbeiten" : "Benutzername festlegen"}
                  </Button>
                  {managed.hasTelegramIdentity || managed.hasTelegramProviderOrphan ? (
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={removeTelegramLoading}
                        onClick={() => setRemoveTelegramTarget(managed)}
                      >
                        {managed.hasTelegramProviderOrphan
                          ? "Verwaiste Telegram-Metadaten bereinigen"
                          : "Telegram Zuordnung entfernen"}
                      </Button>
                      {managed.usernameRequiredOnNextLogin ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={flagLoading}
                          onClick={() => void handleUsernameRequired(managed, false)}
                        >
                          Veraltete Anforderung widerrufen
                        </Button>
                      ) : null}
                    </div>
                  ) : managed.usernameRequiredOnNextLogin ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={flagLoading}
                      onClick={() => void handleUsernameRequired(managed, false)}
                    >
                      Telegram Anmeldung widerrufen
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={flagLoading || !managed.username}
                      title={!managed.username ? "Zuerst einen Telegram Benutzernamen festlegen." : undefined}
                      onClick={() => setRequestTarget(managed)}
                    >
                      Telegram Anmeldung beim nächsten Login erzwingen
                    </Button>
                  )}
                </div>
              </section>

              <section className="space-y-3 border-b border-border pb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Benutzer</h3>
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

      <Dialog
        open={!!usernameEditTarget}
        onOpenChange={(open) => {
          if (!open && !usernameSaving) setUsernameEditTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Telegram Benutzername bearbeiten</DialogTitle>
            <DialogDescription>
              Admin kann den Telegram Benutzernamen direkt setzen. Offene Telegram-Anmeldungsanforderungen werden
              entfernt.
            </DialogDescription>
          </DialogHeader>
          {usernameEditTarget && (
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">Aktueller Benutzername</p>
                <p className="font-medium">{adminUserTelegramLabel(usernameEditTarget.username)}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-username">Neuer Telegram Benutzername</Label>
                <Input
                  id="admin-username"
                  value={usernameDraft}
                  invalid={!!usernameEditError}
                  onChange={(e) => setUsernameDraft(e.target.value)}
                  placeholder="@ExampleUser"
                  autoFocus
                />
                {usernameEditError ? (
                  <p className="text-xs text-destructive">{usernameEditError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">3–24 Zeichen, beginnend mit einem Buchstaben.</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={usernameSaving}
              onClick={() => setUsernameEditTarget(null)}
            >
              Abbrechen
            </Button>
            <Button type="button" loading={usernameSaving} onClick={() => void handleUsernameSave()}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!requestTarget}
        onOpenChange={(open) => !open && setRequestTarget(null)}
        title="Telegram Anmeldung erzwingen?"
        description="Beim nächsten E-Mail-Login muss sich der Benutzer mit Telegram anmelden und die Identity an dieses PEPTIX Konto verknüpfen. Gilt nur, wenn noch keine Telegram-Verknüpfung existiert. Danach ist der Benutzername gesperrt."
        confirmLabel="Erzwingen"
        cancelLabel="Abbrechen"
        loading={flagLoading}
        onConfirm={() => {
          if (requestTarget) void handleUsernameRequired(requestTarget, true);
        }}
      />

      <ConfirmDialog
        open={!!removeTelegramTarget}
        onOpenChange={(open) => !open && !removeTelegramLoading && setRemoveTelegramTarget(null)}
        title="Telegram Zuordnung entfernen?"
        description="Die Telegram Anmeldung wird von diesem PEPTIX Konto getrennt. Das Telegram Konto selbst wird nicht gelöscht. Der PEPTIX Benutzername und Bestellungen bleiben erhalten. Entfernung ist nur möglich, wenn eine weitere Anmeldemethode existiert."
        confirmLabel="Zuordnung entfernen"
        cancelLabel="Abbrechen"
        variant="destructive"
        loading={removeTelegramLoading}
        onConfirm={() => {
          void handleRemoveTelegramIdentity();
        }}
      />

      <ConfirmDialog
        open={!!adminTarget}
        onOpenChange={(open) => !open && setAdminTarget(null)}
        title={adminTarget?.grant ? "Admin-Rolle vergeben?" : "Admin-Rolle entziehen?"}
        description={
          adminTarget?.grant
            ? `${adminUserTelegramLabel(adminTarget.user.username)} erhält vollen Zugriff auf Produktverwaltung, Importe und Benutzerrollen.`
            : `${adminUserTelegramLabel(adminTarget?.user.username)} verliert den Zugriff auf den Admin-Bereich.`
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
              <span className="font-medium text-foreground">{adminUserTelegramLabel(deleteTarget?.username)}</span>
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
