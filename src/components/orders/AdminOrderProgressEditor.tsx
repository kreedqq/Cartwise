import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OrderProgressTracker } from "@/components/orders/OrderProgressTracker";
import { toast } from "@/components/ui/toaster";
import {
  ORDER_PROGRESS_STATUS_OPTIONS,
  clampProgressPercent,
  orderProgressOption,
  resolveOrderProgress,
  type OrderProgressStatusKey,
} from "@/lib/orderProgress";
import { useOrderProgress, useUpsertOrderProgress } from "@/hooks/useOrderProgress";
import type { OrderStatus } from "@/types/database";

type ProgressDraft = {
  statusKey: OrderProgressStatusKey;
  percent: string;
  comment: string;
};

export function AdminOrderProgressEditor({
  orderId,
  orderStatus,
  submittedAt,
}: {
  orderId: string;
  orderStatus: OrderStatus;
  submittedAt: string;
}) {
  const progressQuery = useOrderProgress(orderId);
  const saveProgress = useUpsertOrderProgress(orderId);
  const resolved = resolveOrderProgress(orderStatus, progressQuery.data, submittedAt);
  const [draft, setDraft] = React.useState<ProgressDraft | null>(null);

  const statusKey = draft?.statusKey ?? resolved.statusKey;
  const percent = draft?.percent ?? String(resolved.progressPercent);
  const comment = draft?.comment ?? resolved.comment;

  function updateDraft(patch: Partial<ProgressDraft>) {
    setDraft({ statusKey, percent, comment, ...patch });
  }

  const previewPercent = clampProgressPercent(percent);
  const preview = {
    ...resolved,
    statusKey,
    statusLabel: orderProgressOption(statusKey).label,
    progressPercent: previewPercent,
    comment: comment.trim() || orderProgressOption(statusKey).defaultComment,
    isCustom: true,
  };

  async function handleSave() {
    try {
      await saveProgress.mutateAsync({
        statusKey,
        progressPercent: previewPercent,
        comment: comment.trim() || null,
      });
      setDraft(null);
      toast.success("Bestellfortschritt gespeichert.");
    } catch (error) {
      console.error("Bestellfortschritt speichern fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Fortschritt konnte nicht gespeichert werden.");
    }
  }

  return (
    <div className="space-y-5 px-4 py-4">
      <p className="text-xs font-medium text-muted-foreground">Vorschau — so sieht der Kunde den Fortschritt.</p>
      <OrderProgressTracker progress={preview} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="order-progress-status">Status</Label>
          <Select
            value={statusKey}
            onValueChange={(value) => {
              const next = value as OrderProgressStatusKey;
              const option = orderProgressOption(next);
              const keepComment =
                comment.trim() && comment.trim() !== orderProgressOption(statusKey).defaultComment;
              updateDraft({
                statusKey: next,
                percent: String(option.defaultPercent),
                comment: keepComment ? comment : option.defaultComment,
              });
            }}
          >
            <SelectTrigger id="order-progress-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_PROGRESS_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="order-progress-percent">Fortschritt</Label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={previewPercent}
              onChange={(event) => updateDraft({ percent: event.target.value })}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
              aria-label="Fortschritt in Prozent"
            />
            <Input
              id="order-progress-percent"
              inputMode="numeric"
              value={percent}
              onChange={(event) => updateDraft({ percent: event.target.value })}
              className="h-10 w-20 text-right tabular-nums"
              aria-label="Fortschritt Prozentwert"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="order-progress-comment">Kommentar</Label>
        <Textarea
          id="order-progress-comment"
          value={comment}
          onChange={(event) => updateDraft({ comment: event.target.value })}
          rows={3}
          placeholder="Ihre Bestellung wurde erfolgreich übermittelt und wird nun weiterbearbeitet."
        />
      </div>
      <Button onClick={() => void handleSave()} loading={saveProgress.isPending}>
        Speichern
      </Button>
    </div>
  );
}
