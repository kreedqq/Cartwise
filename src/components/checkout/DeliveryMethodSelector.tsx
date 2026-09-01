import { cn } from "@/lib/utils";
import {
  DELIVERY_METHOD_LABELS,
  DELIVERY_METHODS,
  type DeliveryMethod,
} from "@/lib/shippingAddress";

interface DeliveryMethodSelectorProps {
  value: DeliveryMethod | "";
  onChange: (method: DeliveryMethod) => void;
  error?: string | null;
}

export function DeliveryMethodSelector({ value, onChange, error }: DeliveryMethodSelectorProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold">Lieferart</p>
        <p className="text-xs text-muted-foreground">Bitte wählen, wie die Sendung zugestellt werden soll.</p>
      </div>
      <div className="space-y-2" role="radiogroup" aria-label="Lieferart">
        {DELIVERY_METHODS.map((method) => {
          const selected = value === method;
          return (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(method)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                selected ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/50",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-primary" : "border-muted-foreground",
                )}
              >
                {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
              </span>
              <span className="font-normal">{DELIVERY_METHOD_LABELS[method]}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
