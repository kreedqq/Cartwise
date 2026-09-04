import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OrderProgressTracker } from "@/components/orders/OrderProgressTracker";
import {
  ORDER_PROGRESS_TEMPLATES,
  clampProgressPercent,
  orderProgressPreviewFromDraft,
  type OrderProgressStatusKey,
} from "@/lib/orderProgress";

export interface OrderProgressDraft {
  statusKey: OrderProgressStatusKey;
  title: string;
  description: string;
  percent: string;
}

export function OrderProgressFormFields({
  draft,
  onChange,
  disabled,
}: {
  draft: OrderProgressDraft;
  onChange: (patch: Partial<OrderProgressDraft>) => void;
  disabled?: boolean;
}) {
  const previewPercent = clampProgressPercent(draft.percent);
  const [templateKey, setTemplateKey] = React.useState(0);

  function applyTemplate(id: string) {
    const template = ORDER_PROGRESS_TEMPLATES.find((item) => item.id === id);
    if (!template) return;
    onChange({
      statusKey: template.statusKey,
      title: template.title,
      description: template.description,
      percent: String(template.percent),
    });
    setTemplateKey((value) => value + 1);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="order-progress-template">Vorlage verwenden</Label>
        <Select key={templateKey} onValueChange={applyTemplate} disabled={disabled}>
          <SelectTrigger id="order-progress-template" className="w-full">
            <SelectValue placeholder="Vorlage auswählen — danach frei bearbeitbar" />
          </SelectTrigger>
          <SelectContent>
            {ORDER_PROGRESS_TEMPLATES.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Vorlagen füllen die Felder nur aus. Überschrift, Text und Prozentwert bleiben danach frei editierbar.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="order-progress-title">Überschrift</Label>
        <Input
          id="order-progress-title"
          value={draft.title}
          disabled={disabled}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="z. B. Bestellung wurde übermittelt"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="order-progress-description">Beschreibung</Label>
        <Textarea
          id="order-progress-description"
          value={draft.description}
          disabled={disabled}
          onChange={(event) => onChange({ description: event.target.value })}
          rows={3}
          placeholder="Ihre Bestellung wurde erfolgreich übermittelt und wird nun weiterbearbeitet."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="order-progress-percent">Fortschritt</Label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            value={previewPercent}
            disabled={disabled}
            onChange={(event) => onChange({ percent: event.target.value })}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
            aria-label="Fortschritt in Prozent"
          />
          <Input
            id="order-progress-percent"
            inputMode="numeric"
            value={draft.percent}
            disabled={disabled}
            onChange={(event) => onChange({ percent: event.target.value })}
            className="h-10 w-20 text-right tabular-nums"
            aria-label="Fortschritt Prozentwert"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>
    </div>
  );
}

export function OrderProgressLivePreview({
  draft,
  updatedAt,
  isCancelled,
}: {
  draft: OrderProgressDraft;
  updatedAt: string | null;
  isCancelled: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">Live-Vorschau</p>
      <p className="text-xs text-muted-foreground">So sieht der Kunde den Bestellfortschritt.</p>
      <OrderProgressTracker progress={orderProgressPreviewFromDraft(draft, { updatedAt, isCancelled })} />
    </div>
  );
}
