import * as React from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/common/ErrorState";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { formatDateTime, formatUsd } from "@/lib/money";
import {
  useApplyHistoricalKitRecovery,
  useHistoricalKitRecoveryPreview,
} from "@/hooks/useHistoricalKitRecovery";
import { toast } from "@/components/ui/toaster";
import type { HistoricalKitRecoveryPreview } from "@/services/adminHistoricalKitRecovery";

const DEFAULT_REASON = "Historische Kit Sync Lücke";

function statusLabel(preview: HistoricalKitRecoveryPreview | undefined): string {
  if (!preview) return "—";
  switch (preview.status) {
    case "recovery_verified":
      return "Recovery Verified";
    case "recovery_blocked":
      return "Recovery Blocked";
    case "recovery_already_applied":
      return "Recovery Already Applied";
    case "recovery_candidate":
      return "Recovery Candidate";
    default:
      return preview.status;
  }
}

export function AdminHistoricalKitRecoveryDialog({
  open,
  onOpenChange,
  orderId,
  kitShareId,
  kitLabel,
  revisionNumber,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  kitShareId: string;
  kitLabel: string;
  revisionNumber: number;
  onApplied?: () => void;
}) {
  const [step, setStep] = React.useState<"preview" | "confirm">("preview");
  const [reason, setReason] = React.useState(DEFAULT_REASON);
  const previewQuery = useHistoricalKitRecoveryPreview(orderId, kitShareId, open);
  const applyMutation = useApplyHistoricalKitRecovery(orderId);

  const preview = previewQuery.data;
  const canApply = preview?.status === "recovery_verified";

  async function handleApply() {
    if (!preview || !canApply) return;
    try {
      await applyMutation.mutateAsync({
        kitShareId,
        expectedRevision: preview.expectedRevision ?? revisionNumber,
        reason: reason.trim(),
      });
      onApplied?.();
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Korrektur fehlgeschlagen.";
      toast.error(message);
    }
  }

  return (
    <>
      <Dialog
        open={open && step === "preview"}
        onOpenChange={(next) => {
          if (!next) onOpenChange(false);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Historische Kit-Sync-Lücke</DialogTitle>
            <DialogDescription>
              Serverseitige Prüfung und Vorschau — Preise werden aus historischen Snapshots rekonstruiert,
              nicht aus dem aktuellen Shop.
            </DialogDescription>
          </DialogHeader>

          {previewQuery.isLoading ? (
            <FullScreenSpinner label="Recovery-Vorschau …" />
          ) : previewQuery.isError ? (
            <ErrorState message="Vorschau konnte nicht geladen werden." onRetry={() => previewQuery.refetch()} />
          ) : preview ? (
            <div className="space-y-4 text-sm">
              <p className="rounded-md border border-border bg-secondary/20 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Status: {statusLabel(preview)}
              </p>
              {preview.reason && preview.status !== "recovery_verified" ? (
                <p className="text-destructive">{preview.reason}</p>
              ) : null}
              {preview.status === "recovery_verified" ? (
                <>
                  <div className="grid gap-1">
                    <p>
                      <span className="text-muted-foreground">Bestellung: </span>
                      {preview.orderNumber}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Kit: </span>
                      {preview.productCode} · {kitLabel}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Kit-Größe: </span>
                      {preview.kitSizeVials}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Anteil: </span>
                      {preview.participantQuantity} Vials
                    </p>
                    <p>
                      <span className="text-muted-foreground">Vollständig seit: </span>
                      {preview.kitCompletedAt ? formatDateTime(preview.kitCompletedAt) : "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Checkout: </span>
                      {preview.checkoutAt ? formatDateTime(preview.checkoutAt) : "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Historischer Preis: </span>
                      {formatUsd(preview.historicalUnitPriceUsd ?? 0)} / Vial
                    </p>
                    <p>
                      <span className="text-muted-foreground">Fehlender Betrag: </span>
                      {formatUsd(preview.missingLineTotalUsd ?? 0)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Aktueller Order Total: </span>
                      {formatUsd(preview.currentOrderTotalUsd ?? 0)}
                    </p>
                    <p className="font-medium">
                      <span className="text-muted-foreground">Neuer Order Total: </span>
                      {formatUsd(preview.newOrderTotalUsd ?? 0)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">{preview.recoveryReason}</p>
                  <div className="space-y-1">
                    <Label htmlFor="recovery-reason" className="text-xs">
                      Korrekturgrund
                    </Label>
                    <Textarea
                      id="recovery-reason"
                      rows={2}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              disabled={!canApply || reason.trim().length < 3}
              onClick={() => setStep("confirm")}
            >
              Weiter …
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={open && step === "confirm"}
        onOpenChange={(next) => {
          if (!next) setStep("preview");
        }}
        title="Historische Bestellung korrigieren?"
        description={
          preview && canApply ? (
            <div className="space-y-2 text-left text-sm">
              <p className="font-medium">ALT</p>
              <p>Summe: {formatUsd(preview.currentOrderTotalUsd ?? 0)}</p>
              <p className="font-medium">NEU</p>
              <p>
                + {preview.productCode} ×{preview.participantQuantity} (
                {formatUsd(preview.missingLineTotalUsd ?? 0)})
              </p>
              <p>Summe: {formatUsd(preview.newOrderTotalUsd ?? 0)}</p>
              <p className="font-medium">
                Differenz: +{formatUsd(preview.missingLineTotalUsd ?? 0)}
              </p>
            </div>
          ) : (
            "Recovery ist nicht verifiziert."
          )
        }
        confirmLabel="Korrektur anwenden"
        cancelLabel="Abbrechen"
        loading={applyMutation.isPending}
        onConfirm={handleApply}
      />
    </>
  );
}
