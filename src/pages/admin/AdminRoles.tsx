import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { toast } from "@/components/ui/toaster";
import { listUsersWithRoles } from "@/services/profiles";
import {
  assignCustomerRole,
  deleteCustomerRole,
  listCustomerRoles,
  listUserCustomerRoles,
  upsertCustomerRole,
} from "@/services/customerRoles";

export default function AdminRolesPage() {
  const queryClient = useQueryClient();
  const rolesQuery = useQuery({ queryKey: ["customer-roles"], queryFn: listCustomerRoles });
  const assignmentsQuery = useQuery({ queryKey: ["user-customer-roles"], queryFn: listUserCustomerRoles });
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: listUsersWithRoles });

  const [name, setName] = React.useState("");
  const [markup, setMarkup] = React.useState("25");
  const [active, setActive] = React.useState(true);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const roles = rolesQuery.data ?? [];
  const assignmentByUser = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const row of assignmentsQuery.data ?? []) map.set(row.user_id, row.role_id);
    return map;
  }, [assignmentsQuery.data]);

  function resetForm() {
    setName("");
    setMarkup("25");
    setActive(true);
    setEditingId(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const markupPercent = Number(markup.replace(",", "."));
    if (!name.trim() || !Number.isFinite(markupPercent)) {
      toast.error("Bitte Name und einen gültigen Aufschlag in % angeben.");
      return;
    }
    setSaving(true);
    try {
      await upsertCustomerRole({ id: editingId, name: name.trim(), markupPercent, isActive: active });
      toast.success(editingId ? "Rolle gespeichert." : "Rolle erstellt.");
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["customer-roles"] });
    } catch (error) {
      console.error("Rolle speichern fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Rolle konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteCustomerRole(deleteId);
      toast.success("Rolle gelöscht.");
      setDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: ["customer-roles"] });
    } catch (error) {
      console.error("Rolle löschen fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Rolle konnte nicht gelöscht werden.");
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

  if (rolesQuery.isLoading) return <Skeleton className="h-64 w-full" />;
  if (rolesQuery.isError) {
    return <ErrorState message="Rollen konnten nicht geladen werden." onRetry={() => rolesQuery.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? "Rolle bearbeiten" : "Neue Rolle"}</CardTitle>
          <CardDescription>
            Aufschlag gilt automatisch für Shop, Warenkorb und neue Bestellungen – ohne Codeänderung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="role-name">Rollenname</Label>
              <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. VIP" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="role-markup">Aufschlag %</Label>
              <Input id="role-markup" value={markup} onChange={(e) => setMarkup(e.target.value)} className="w-28" />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Checkbox id="role-active" checked={active} onCheckedChange={(v) => setActive(v === true)} />
              <Label htmlFor="role-active" className="font-normal">
                Aktiv
              </Label>
            </div>
            <Button type="submit" loading={saving}>
              <Plus /> Speichern
            </Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={resetForm}>
                Abbrechen
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rolle</TableHead>
            <TableHead>Aufschlag</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role.id}>
              <TableCell className="font-medium">
                {role.name}
                {role.is_default && (
                  <Badge variant="secondary" className="ml-2">
                    Standard
                  </Badge>
                )}
              </TableCell>
              <TableCell className="tabular-nums">{Number(role.markup_percent)} %</TableCell>
              <TableCell>{role.is_active ? "Aktiv" : "Inaktiv"}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  className="mr-2"
                  onClick={() => {
                    setEditingId(role.id);
                    setName(role.name);
                    setMarkup(String(role.markup_percent));
                    setActive(role.is_active);
                  }}
                >
                  Bearbeiten
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={role.is_default}
                  onClick={() => setDeleteId(role.id)}
                  aria-label="Rolle löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Benutzer zuweisen</CardTitle>
          <CardDescription>Die neue Rolle gilt sofort für zukünftige Preise und den Checkout.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Benutzer</TableHead>
                <TableHead>Kundenrolle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(usersQuery.data ?? []).map((user) => {
                const current = assignmentByUser.get(user.id) ?? roles.find((r) => r.is_default)?.id ?? "";
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{user.displayName}</p>
                      {user.roles.includes("admin") && (
                        <p className="text-xs text-muted-foreground">Admin</p>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <Select value={current} onValueChange={(roleId) => handleAssign(user.id, roleId)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.filter((r) => r.is_active || r.id === current).map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Rolle löschen?"
        description="Nur möglich, wenn niemand diese Rolle zugewiesen hat. Die Standardrolle kann nicht gelöscht werden."
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
