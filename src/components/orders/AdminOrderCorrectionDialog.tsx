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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatHistoricalOrderItemQuantity,
  formatKitShareLabelForOrderItem,
  isKitOrderLine,
} from "@/lib/orderKitDisplay";
import { formatUsd } from "@/lib/money";
import { cartItemDisplayName } from "@/lib/shop/cartDisplay";
import type { Tables } from "@/types/database";

const REASON_PRESETS = [
  "Kit Verteilung korrigiert",
  "Fehlerhafte Menge",
  "Kundenwunsch",
  "Falsche Zuordnung",
  "Sonstiges",
] as const;

export type LineDraft = {
  orderItemId: string;
  quantity: number;
  remove: boolean;
};

function previewLineTotal(item: Tables<"order_items">, quantity: number): number {
  if (quantity <= 0) return 0;
  return Math.round(quantity * item.unit_price_usd_snapshot * 100) / 100;
}

export function AdminOrderCorrectionDialog({
  open,
  onOpenChange,
  order,
  roleLabel,
  originalTotalUsd,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Tables<"orders"> & { items: Tables<"order_items">[] };
  roleLabel: string | null;
  /** Total at first submission (before any revision). */
  originalTotalUsd: number;
  loading?: boolean;
  onConfirm: (input: {
    reason: string;
    lineChanges: { orderItemId: string; quantity?: number; remove?: boolean }[];
  }) => void | Promise<void>;
}) {
  const [step, setStep] = React.useState<"edit" | "confirm">("edit");
  const [preset, setPreset] = React.useState<string>(REASON_PRESETS[0]);
  const [customReason, setCustomReason] = React.useState("");
  const [drafts, setDrafts] = React.useState<LineDraft[]>(() =>
    order.items.map((item) => ({
      orderItemId: item.id,
      quantity: item.quantity,
      remove: false,
    })),
  );

  const reasonText =
    preset === "Sonstiges" ? customReason.trim() : preset;


  const previewTotalUsd = order.items.reduce((sum, item) => {
    const draft = drafts.find((d) => d.orderItemId === item.id);
    if (!draft || draft.remove) return sum;
    return sum + previewLineTotal(item, draft.quantity);
  }, 0);

  const diffUsd = Math.round((previewTotalUsd - order.total_usd) * 100) / 100;
  const diffFromOriginal = Math.round((previewTotalUsd - originalTotalUsd) * 100) / 100;

  const hasChanges = drafts.some((draft) => {
    const item = order.items.find((i) => i.id === draft.orderItemId);
    if (!item) return false;
    return draft.remove || draft.quantity !== item.quantity;
  });

  function setQuantity(orderItemId: string, raw: string) {
    const parsed = Number(raw.replace(",", "."));
    setDrafts((prev) =>
      prev.map((d) =>
        d.orderItemId === orderItemId
          ? { ...d, quantity: Number.isFinite(parsed) ? parsed : d.quantity, remove: false }
          : d,
      ),
    );
  }

  function toggleRemove(orderItemId: string, remove: boolean) {
    setDrafts((prev) =>
      prev.map((d) => (d.orderItemId === orderItemId ? { ...d, remove } : d)),
    );
  }

  async function handleSave() {
    if (step === "edit") {
      setStep("confirm");
      return;
    }
    const lineChanges = drafts
      .filter((draft) => {
        const item = order.items.find((i) => i.id === draft.orderItemId);
        if (!item) return false;
        return draft.remove || draft.quantity !== item.quantity;
      })
      .map((draft) =>
        draft.remove
          ? { orderItemId: draft.orderItemId, remove: true as const }
          : { orderItemId: draft.orderItemId, quantity: draft.quantity, remove: false as const },
      );

    await onConfirm({ reason: reasonText, lineChanges });
  }

  const remainingLines = drafts.filter((d) => !d.remove).length;

  return (
    <>
      <Dialog open={open && step === "edit"} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bestellung korrigieren</DialogTitle>
            <DialogDescription>
              Diese Bestellung wurde bereits abgesendet. Änderungen werden als Revision gespeichert; die
              ursprüngliche Bestellung bleibt im Änderungsverlauf erhalten.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
            <p className="font-medium text-foreground">{order.order_number}</p>
            <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <span>Status: {order.status}</span>
              <span>Rolle zum Bestellzeitpunkt: {roleLabel ?? "—"}</span>
              <span>Aktuelle Summe: {formatUsd(order.total_usd)}</span>
              <span>Originalsumme: {formatUsd(originalTotalUsd)}</span>
              <span>Revision: {order.revision_number ?? 0}</span>
            </div>
          </div>

          <div className="space-y-3">
            {order.items.map((item) => {
              const draft = drafts.find((d) => d.orderItemId === item.id);
              if (!draft) return null;
              const kitLabel = formatKitShareLabelForOrderItem(item);
              return (
                <div key={item.id} className="space-y-2 rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{cartItemDisplayName(item)}</p>
                      <p className="font-mono text-xs text-muted-foreground">{item.product_code_snapshot}</p>
                      {kitLabel ? (
                        <p className="text-xs text-muted-foreground">Kit-Anteil: {kitLabel}</p>
                      ) : null}
                    </div>
                    <p className="text-sm tabular-nums">
                      {formatUsd(item.line_total_usd)} · {formatUsd(item.unit_price_usd_snapshot)}/Einheit
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Menge</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        disabled={draft.remove || loading}
                        className="h-9 w-24 tabular-nums"
                        value={draft.quantity}
                        onChange={(e) => setQuantity(item.id, e.target.value)}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Anzeige:{" "}
                        {isKitOrderLine(item)
                          ? formatHistoricalOrderItemQuantity(item)
                          : formatHistoricalOrderItemQuantity({ ...item, quantity: draft.quantity })}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={draft.remove}
                        disabled={loading}
                        onChange={(e) => toggleRemove(item.id, e.target.checked)}
                      />
                      Position entfernen
                    </label>
                    {isKitOrderLine(item) ? (
                      <span className="text-[10px] text-muted-foreground">
                        Nur Order-Snapshot; Live-Kit wird nicht geändert.
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Korrekturgrund</Label>
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASON_PRESETS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {preset === "Sonstiges" ? (
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Freitext</Label>
                <Input
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Grund beschreiben …"
                />
              </div>
            ) : null}
          </div>

          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            <p>
              Vorschau Summe: <span className="font-semibold tabular-nums">{formatUsd(previewTotalUsd)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Δ zur aktuellen Summe: {diffUsd >= 0 ? "+" : ""}
              {formatUsd(diffUsd)} · Δ zur Originalsumme: {diffFromOriginal >= 0 ? "+" : ""}
              {formatUsd(diffFromOriginal)}
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Abbrechen
            </Button>
            <Button
              type="button"
              disabled={loading || !hasChanges || reasonText.length < 3 || remainingLines < 1}
              onClick={() => void handleSave()}
            >
              Weiter zur Bestätigung
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={open && step === "confirm"}
        onOpenChange={(next) => {
          if (!next) setStep("edit");
          else onOpenChange(next);
        }}
        title="Bestellung wirklich korrigieren?"
        description={
          <div className="space-y-3 text-left text-sm">
            <p className="font-medium">Vorher → Nachher</p>
            <ul className="space-y-2">
              {order.items.map((item) => {
                const draft = drafts.find((d) => d.orderItemId === item.id);
                if (!draft) return null;
                const changed = draft.remove || draft.quantity !== item.quantity;
                if (!changed) return null;
                return (
                  <li key={item.id} className="rounded border border-border px-2 py-1.5">
                    <span className="font-mono text-xs">{item.product_code_snapshot}</span>
                    <span className="mx-2">·</span>
                    {draft.remove ? (
                      <span>
                        {item.quantity} → <strong>entfernt</strong>
                      </span>
                    ) : (
                      <span>
                        {item.quantity} → <strong>{draft.quantity}</strong>
                      </span>
                    )}
                    <span className="mx-2">·</span>
                    <span className="tabular-nums">
                      {formatUsd(item.line_total_usd)} →{" "}
                      {draft.remove ? formatUsd(0) : formatUsd(previewLineTotal(item, draft.quantity))}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p>
              Gesamt: {formatUsd(order.total_usd)} →{" "}
              <strong className="tabular-nums">{formatUsd(previewTotalUsd)}</strong> (
              {diffUsd >= 0 ? "+" : ""}
              {formatUsd(diffUsd)})
            </p>
            <p className="text-xs text-muted-foreground">Grund: {reasonText}</p>
            <p className="text-xs text-muted-foreground">
              Preisbasis: historischer Einzelpreis (unit_price_usd_snapshot), keine aktuellen Shop- oder Rollenpreise.
            </p>
          </div>
        }
        confirmLabel="Korrektur speichern"
        cancelLabel="Zurück"
        loading={loading}
        onConfirm={() => void handleSave()}
      />
    </>
  );
}
