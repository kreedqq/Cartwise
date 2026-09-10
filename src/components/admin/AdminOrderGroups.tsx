import * as React from "react";
import { ChevronDown, Plus } from "lucide-react";

import { AdminSection } from "@/components/admin/AdminSection";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import {
  useAssignOrdersToGroup,
  useCreateOrderGroup,
  useDeleteOrderGroup,
  useRemoveOrdersFromGroup,
  useUpdateOrderGroup,
} from "@/hooks/useOrderGroups";
import {
  countOrderItems,
  orderIdsForGroup,
  summarizeOrderGroupMoney,
  summarizeOrderGroupStatus,
} from "@/lib/orderGroups";
import { formatDateTime, formatUsd } from "@/lib/money";
import { summarizeRoleSurcharges } from "@/lib/roleSurcharge";
import {
  ORDER_STATUS_LABELS,
  formatOrderTelegramSnapshot,
} from "@/services/orders";
import type { OrderGroup } from "@/services/orderGroups";
import type { Tables } from "@/types/database";
import type { RoleSurchargeSnapshotLine } from "@/lib/roleSurcharge";
import { cn } from "@/lib/utils";

interface AdminOrderGroupsProps {
  groups: OrderGroup[];
  memberships: Array<{ group_id: string; order_id: string }>;
  orders: Tables<"orders">[];
  items: Tables<"order_items">[];
  surchargeLines: RoleSurchargeSnapshotLine[];
  selectedIds: Set<string>;
  onToggle: (orderId: string, checked: boolean) => void;
  onAssigned?: () => void;
}

export function AdminOrderGroups({
  groups,
  memberships,
  orders,
  items,
  surchargeLines,
  selectedIds,
  onToggle,
  onAssigned,
}: AdminOrderGroupsProps) {
  const createMutation = useCreateOrderGroup();
  const updateMutation = useUpdateOrderGroup();
  const deleteMutation = useDeleteOrderGroup();
  const assignMutation = useAssignOrdersToGroup();
  const removeMutation = useRemoveOrdersFromGroup();
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newNote, setNewNote] = React.useState("");
  const [existingId, setExistingId] = React.useState<string>("");
  const [renameId, setRenameId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [renameNote, setRenameNote] = React.useState("");
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [openIds, setOpenIds] = React.useState<Set<string>>(new Set());
  const ordersById = React.useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const selectedCount = selectedIds.size;

  async function handleAssign(event: React.FormEvent) {
    event.preventDefault();
    const orderIds = [...selectedIds];
    try {
      if (existingId) {
        await assignMutation.mutateAsync({ groupId: existingId, orderIds });
        toast.success("Bestellungen der Gruppe zugeordnet.");
      } else {
        const name = newName.trim();
        if (!name) {
          toast.error("Bitte einen Gruppennamen eingeben oder eine bestehende Gruppe wählen.");
          return;
        }
        await createMutation.mutateAsync({ name, note: newNote, orderIds });
        toast.success("Bestellgruppe erstellt.");
      }
      setAssignOpen(false);
      setNewName("");
      setNewNote("");
      setExistingId("");
      onAssigned?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Zuordnung fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-3">
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-sm font-medium">{selectedCount} ausgewählt</p>
          <Button type="button" size="sm" onClick={() => setAssignOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Zur Bestellgruppe hinzufügen
          </Button>
        </div>
      )}

      <AdminSection title="Bestellgruppen">
        {groups.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Noch keine Bestellgruppen. Bestellungen auswählen und zuordnen.</p>
        ) : (
          <div className="divide-y divide-border">
            {groups.map((group) => {
              const memberIds = orderIdsForGroup(memberships, group.id);
              const memberSet = new Set(memberIds);
              const memberOrders = memberIds.map((id) => ordersById.get(id)).filter(Boolean) as Tables<"orders">[];
              const money = summarizeOrderGroupMoney(memberOrders);
              const status = summarizeOrderGroupStatus(memberOrders);
              const itemCount = countOrderItems(items, memberSet);
              const surcharge = summarizeRoleSurcharges(surchargeLines, memberOrders, memberIds);
              const open = openIds.has(group.id);
              return (
                <div key={group.id} className="px-3 py-3 sm:px-4">
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 text-left"
                    onClick={() =>
                      setOpenIds((current) => {
                        const next = new Set(current);
                        if (next.has(group.id)) next.delete(group.id);
                        else next.add(group.id);
                        return next;
                      })
                    }
                  >
                    <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 transition-transform", open ? "rotate-0" : "-rotate-90")} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{group.name}</p>
                      {group.note ? <p className="mt-0.5 text-xs text-muted-foreground">{group.note}</p> : null}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {memberOrders.length} {memberOrders.length === 1 ? "Bestellung" : "Bestellungen"}
                        {" · "}
                        {itemCount} {itemCount === 1 ? "Position" : "Positionen"}
                        {" · "}
                        {money.grandDisplay}
                        {" · "}
                        {formatUsd(surcharge.totalSurchargeUsd)} Rollenaufschläge
                      </p>
                      <p className="text-[11px] text-muted-foreground">{status.label}</p>
                    </div>
                  </button>
                  <div className="mt-2 flex flex-wrap gap-2 pl-6">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRenameId(group.id);
                        setRenameValue(group.name);
                        setRenameNote(group.note ?? "");
                      }}
                    >
                      Bearbeiten
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => setDeleteId(group.id)}>
                      Gruppe löschen
                    </Button>
                  </div>
                  {open ? (
                    <ul className="mt-3 space-y-2 pl-6">
                      {memberOrders.map((order) => (
                        <li key={order.id} className="rounded-lg border border-border bg-background p-3">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedIds.has(order.id)}
                              onCheckedChange={(value) => onToggle(order.id, value === true)}
                              aria-label={order.order_number}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-mono text-xs font-semibold">{order.order_number}</p>
                              <p className="text-[11px] text-muted-foreground">Bestellgruppe: {group.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatOrderTelegramSnapshot(order)} · {formatDateTime(order.submitted_at)} ·{" "}
                                {ORDER_STATUS_LABELS[order.status]}
                              </p>
                              <p className="tabular-nums text-sm font-medium">{formatUsd(order.total_usd)}</p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                void removeMutation
                                  .mutateAsync([order.id])
                                  .then(() => toast.success("Bestellung aus der Gruppe entfernt."))
                                  .catch((error) => {
                                    toast.error(error instanceof Error ? error.message : "Entfernen fehlgeschlagen.");
                                  });
                              }}
                            >
                              Entfernen
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </AdminSection>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <form onSubmit={(event) => void handleAssign(event)}>
            <DialogHeader>
              <DialogTitle>Zur Bestellgruppe hinzufügen</DialogTitle>
              <DialogDescription>
                {selectedCount} Bestellung{selectedCount === 1 ? "" : "en"} einer neuen oder bestehenden Gruppe zuordnen.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-1.5">
                <Label>Bestehende Gruppe</Label>
                <Select
                  value={existingId || "new"}
                  onValueChange={(value) => setExistingId(value === "new" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Neue Gruppe erstellen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Neue Bestellgruppe erstellen</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!existingId ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="order-group-name">Name</Label>
                    <Input
                      id="order-group-name"
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      placeholder="China Bestellung 10.09.2026"
                      required
                      maxLength={160}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="order-group-note">Notiz (optional)</Label>
                    <Textarea id="order-group-note" value={newNote} onChange={(event) => setNewNote(event.target.value)} rows={3} />
                  </div>
                </>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="submit" loading={createMutation.isPending || assignMutation.isPending}>
                Speichern
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={renameId != null} onOpenChange={(open) => { if (!open) setRenameId(null); }}>
        <DialogContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!renameId) return;
              void updateMutation
                .mutateAsync({ id: renameId, input: { name: renameValue, note: renameNote } })
                .then(() => {
                  toast.success("Gruppe gespeichert.");
                  setRenameId(null);
                })
                .catch((error) => {
                  toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
                });
            }}
          >
            <DialogHeader>
              <DialogTitle>Gruppe bearbeiten</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="order-group-rename">Name</Label>
                <Input
                  id="order-group-rename"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  required
                  maxLength={160}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="order-group-rename-note">Notiz (optional)</Label>
                <Textarea
                  id="order-group-rename-note"
                  value={renameNote}
                  onChange={(event) => setRenameNote(event.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" loading={updateMutation.isPending}>
                Speichern
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId != null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Bestellgruppe löschen?"
        description="Die Gruppe wird entfernt. Die Bestellungen bleiben bestehen und sind wieder nicht gruppiert."
        confirmLabel="Gruppe löschen"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!deleteId) return;
          await deleteMutation.mutateAsync(deleteId);
          toast.success("Bestellgruppe gelöscht. Bestellungen bleiben bestehen.");
          setDeleteId(null);
        }}
      />
    </div>
  );
}
