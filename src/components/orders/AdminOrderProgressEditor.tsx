import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  OrderProgressFormFields,
  OrderProgressLivePreview,
  type OrderProgressDraft,
} from "@/components/orders/OrderProgressForm";
import { toast } from "@/components/ui/toaster";
import { clampProgressPercent, resolveOrderProgress } from "@/lib/orderProgress";
import { useOrderProgress, useUpsertOrderProgress } from "@/hooks/useOrderProgress";
import type { OrderStatus } from "@/types/database";

function draftsEqual(a: OrderProgressDraft, b: OrderProgressDraft): boolean {
  return (
    a.statusKey === b.statusKey &&
    a.title === b.title &&
    a.description === b.description &&
    clampProgressPercent(a.percent) === clampProgressPercent(b.percent)
  );
}

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
  const saved: OrderProgressDraft = {
    statusKey: resolved.statusKey,
    title: progressQuery.data?.title?.trim() || (resolved.isCancelled ? "" : resolved.statusLabel),
    description: resolved.isCancelled
      ? progressQuery.data?.comment?.trim() || ""
      : resolved.comment,
    percent: String(resolved.progressPercent),
  };
  const [draft, setDraft] = React.useState<OrderProgressDraft | null>(null);
  const current = draft ?? saved;
  const dirty = Boolean(draft && !draftsEqual(draft, saved));

  function updateDraft(patch: Partial<OrderProgressDraft>) {
    setDraft({ ...current, ...patch });
  }

  async function handleSave() {
    try {
      await saveProgress.mutateAsync({
        statusKey: current.statusKey,
        progressPercent: clampProgressPercent(current.percent),
        comment: current.description.trim() || null,
        title: current.title.trim() || null,
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
      {dirty ? (
        <p className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-primary">
          Ungespeicherte Änderungen am Bestellfortschritt.
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <OrderProgressFormFields draft={current} onChange={updateDraft} disabled={saveProgress.isPending} />
        <OrderProgressLivePreview
          draft={current}
          updatedAt={resolved.updatedAt}
          isCancelled={orderStatus === "cancelled"}
        />
      </div>
      <Button onClick={() => void handleSave()} loading={saveProgress.isPending} disabled={!dirty}>
        Fortschritt speichern
      </Button>
    </div>
  );
}
