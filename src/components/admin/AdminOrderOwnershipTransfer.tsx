import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";

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
import { toast } from "@/components/ui/toaster";
import { QUERY_KEYS } from "@/lib/constants";
import { formatDateTime, formatEur } from "@/lib/money";
import { adminTransferOrders } from "@/services/adminOrderOwnership";
import { extractRpcErrorMessage } from "@/services/username";
import type { UserWithRoles } from "@/services/profiles";
import type { Tables } from "@/types/database";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromUser: UserWithRoles;
  allUsers: UserWithRoles[];
  orders: Tables<"orders">[];
};

export function AdminOrderOwnershipTransfer({
  open,
  onOpenChange,
  fromUser,
  allUsers,
  orders,
}: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [toUserId, setToUserId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const fromOrders = React.useMemo(
    () => orders.filter((o) => o.user_id === fromUser.id),
    [orders, fromUser.id],
  );

  const targetOptions = React.useMemo(
    () => allUsers.filter((u) => u.id !== fromUser.id),
    [allUsers, fromUser.id],
  );

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelected(new Set());
      setReason("");
      setToUserId("");
    }
    onOpenChange(next);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleTransfer() {
    if (!toUserId) {
      toast.error("Bitte einen Zielbenutzer wählen.");
      return;
    }
    if (selected.size === 0) {
      toast.error("Mindestens eine Bestellung auswählen.");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("Bitte einen Grund angeben (mindestens 3 Zeichen).");
      return;
    }
    setLoading(true);
    try {
      const result = await adminTransferOrders({
        fromUserId: fromUser.id,
        toUserId,
        orderIds: [...selected],
        reason: reason.trim(),
      });
      toast.success(
        `${result.count} Bestellung(en) übertragen: ${result.orderNumbers.join(", ")}`,
      );
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrders });
      handleOpenChange(false);
    } catch (error) {
      toast.error(extractRpcErrorMessage(error) ?? "Übertragung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bestellungen übertragen</DialogTitle>
          <DialogDescription>
            Nur der aktuelle Order-Owner ändert sich. Nummern, Positionen, Snapshots und Zahlungsstatus bleiben
            unverändert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <p>
              <span className="text-muted-foreground">Von:</span>{" "}
              <strong>{fromUser.username ?? fromUser.id}</strong>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transfer-target">Nach</Label>
            <Select value={toUserId || undefined} onValueChange={setToUserId}>
              <SelectTrigger id="transfer-target">
                <SelectValue placeholder="Zielbenutzer wählen …" />
              </SelectTrigger>
              <SelectContent>
                {targetOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.username ?? u.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {fromOrders.length === 0 ? (
            <p className="text-muted-foreground">Dieser Benutzer hat keine zugeordneten Bestellungen.</p>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-2">
              {fromOrders.map((o) => (
                <li key={o.id} className="flex items-start gap-2">
                  <Checkbox
                    id={`transfer-${o.id}`}
                    checked={selected.has(o.id)}
                    onCheckedChange={() => toggle(o.id)}
                  />
                  <label htmlFor={`transfer-${o.id}`} className="cursor-pointer leading-tight">
                    <span className="font-medium">{o.order_number}</span>
                    <span className="ml-2 text-muted-foreground">
                      {o.total_eur != null ? formatEur(Number(o.total_eur)) : "—"} ·{" "}
                      {o.submitted_at ? formatDateTime(o.submitted_at) : "—"}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="transfer-reason">Grund (Audit)</Label>
            <Input
              id="transfer-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="z. B. Telegram-Account-Wechsel"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={loading} onClick={() => handleOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            type="button"
            loading={loading}
            disabled={!toUserId || selected.size === 0}
            onClick={() => void handleTransfer()}
          >
            Übertragen bestätigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
