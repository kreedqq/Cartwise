import * as React from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SharedKitAdminView } from "@/lib/kitOrderSummary";

type RestoreInput = { kitShareId: string; participantUserId: string };

type Props = {
  kit: SharedKitAdminView;
  restoringUserId?: string | null;
  onRestoreCartLine?: (input: RestoreInput) => void;
  onAdminSyncNotInCartLine?: (input: RestoreInput) => void;
  onHistoricalKitRecovery?: (input: RestoreInput) => void;
};

export function SharedKitAdminCard({
  kit,
  restoringUserId,
  onRestoreCartLine,
  onAdminSyncNotInCartLine,
  onHistoricalKitRecovery,
}: Props) {
  const [syncConfirm, setSyncConfirm] = React.useState<{
    userId: string;
    label: string;
    shareLabel: string;
  } | null>(null);

  return (
    <div className="space-y-3 px-4 py-4">
      <div>
        <p className="text-sm font-semibold">{kit.productName}</p>
        <p className="text-xs text-muted-foreground">Kit Größe: {kit.kitSizeLabel}</p>
      </div>
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Teilnehmer</p>
        <ul className="space-y-2">
          {kit.participants.map((participant) => {
            const removed = participant.canRestoreCartLine;
            const restoring = restoringUserId === participant.userId;
            return (
              <li
                key={`${kit.kitShareId}-${participant.userId}`}
                className={
                  participant.isCurrentOrder
                    ? "rounded-md border border-primary/30 bg-primary/5 px-3 py-2"
                    : removed
                      ? "rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2"
                      : "rounded-md border border-border px-3 py-2"
                }
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{participant.telegramLabel}</p>
                    <p className="text-xs text-muted-foreground sm:hidden">{participant.shareLabel}</p>
                    <p
                      className={
                        removed
                          ? "text-xs font-medium text-amber-800 dark:text-amber-200 sm:hidden"
                          : "text-xs text-muted-foreground sm:hidden"
                      }
                    >
                      {participant.statusLabel}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="text-sm tabular-nums sm:inline">{participant.shareLabel}</span>
                    <span
                      className={
                        removed
                          ? "hidden text-sm font-medium text-amber-800 dark:text-amber-200 sm:inline"
                          : "hidden text-sm sm:inline"
                      }
                    >
                      {participant.statusLabel}
                    </span>
                    {participant.isCurrentOrder && (
                      <Badge variant="secondary" className="text-[10px]">
                        aktuelle Bestellung
                      </Badge>
                    )}
                    {participant.canAdminSyncNotInCartLine && onAdminSyncNotInCartLine ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full shrink-0 sm:w-auto"
                        disabled={Boolean(restoringUserId)}
                        loading={restoring}
                        onClick={() =>
                          setSyncConfirm({
                            userId: participant.userId,
                            label: participant.telegramLabel,
                            shareLabel: participant.shareLabel,
                          })
                        }
                      >
                        Anteil in Warenkorb legen
                      </Button>
                    ) : null}
                    {participant.canOfferHistoricalKitRecovery && onHistoricalKitRecovery ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="w-full shrink-0 sm:w-auto"
                        disabled={Boolean(restoringUserId)}
                        onClick={() =>
                          onHistoricalKitRecovery({
                            kitShareId: kit.kitShareId,
                            participantUserId: participant.userId,
                          })
                        }
                      >
                        Historische Bestellposition
                      </Button>
                    ) : null}
                    {participant.canRestoreCartLine && onRestoreCartLine ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full shrink-0 sm:w-auto"
                        disabled={Boolean(restoringUserId)}
                        loading={restoring}
                        onClick={() =>
                          onRestoreCartLine({
                            kitShareId: kit.kitShareId,
                            participantUserId: participant.userId,
                          })
                        }
                      >
                        Wieder in Warenkorb legen
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-sm">
        Kit Fortschritt: <span className="font-medium">{kit.progressLabel}</span>
        {kit.complete ? <span className="ml-2 font-medium text-primary">Kit vollständig</span> : null}
      </p>

      <ConfirmDialog
        open={syncConfirm != null}
        onOpenChange={(open) => {
          if (!open) setSyncConfirm(null);
        }}
        title="Kit-Anteil in den Warenkorb legen?"
        description={
          syncConfirm ? (
            <>
              <span className="font-medium">{syncConfirm.label}</span> ({syncConfirm.shareLabel}) soll den Anteil an
              diesem Kit wieder in den aktiven Warenkorb des Teilnehmers legen. Die Kit-Verteilung und bestehende
              Bestellungen bleiben unverändert.
            </>
          ) : null
        }
        confirmLabel="Anteil in Warenkorb legen"
        cancelLabel="Abbrechen"
        loading={Boolean(restoringUserId)}
        onConfirm={() => {
          if (!syncConfirm || !onAdminSyncNotInCartLine) return;
          onAdminSyncNotInCartLine({
            kitShareId: kit.kitShareId,
            participantUserId: syncConfirm.userId,
          });
          setSyncConfirm(null);
        }}
      />
    </div>
  );
}
