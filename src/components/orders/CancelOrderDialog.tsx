import * as React from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CancelOrderDialog({
  open,
  onOpenChange,
  orderNumber,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  loading?: boolean;
  onConfirm: (reason: string | null) => void | Promise<void>;
}) {
  const [reason, setReason] = React.useState("");

  function handleOpenChange(next: boolean) {
    if (!next) setReason("");
    onOpenChange(next);
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Bestellung stornieren?"
      description={
        <div className="space-y-3">
          <p>
            Möchtest du die Bestellung <span className="font-mono font-semibold text-foreground">{orderNumber}</span>{" "}
            wirklich stornieren?
          </p>
          <p>Diese Aktion verändert den Bestellstatus. Die Bestellung bleibt historisch erhalten und wird nicht gelöscht.</p>
          <div className="space-y-1.5 text-left">
            <Label htmlFor="cancel-order-reason" className="text-foreground">
              Stornierungsgrund (optional)
            </Label>
            <Textarea
              id="cancel-order-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Interner Hinweis, nur für Admins sichtbar"
            />
          </div>
        </div>
      }
      confirmLabel="Bestellung stornieren"
      cancelLabel="Abbrechen"
      variant="destructive"
      loading={loading}
      onConfirm={() => onConfirm(reason.trim() || null)}
    />
  );
}
