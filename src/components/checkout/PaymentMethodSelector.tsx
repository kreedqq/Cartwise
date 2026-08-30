import { cn } from "@/lib/utils";
import {
  PAYMENT_FEE_DISCLAIMER,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/shop/paymentMethod";
import { PaymentMethodIcon } from "@/components/orders/PaymentMethodIcon";

interface PaymentMethodSelectorProps {
  value: PaymentMethod | null;
  onChange: (method: PaymentMethod) => void;
  error?: string | null;
}

export function PaymentMethodSelector({ value, onChange, error }: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold">Zahlungsmethode</p>
      </div>
      <div className="space-y-2" role="radiogroup" aria-label="Zahlungsmethode">
        {PAYMENT_METHODS.map((method) => {
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
              <PaymentMethodIcon method={method} />
              <span className="font-normal">{PAYMENT_METHOD_LABELS[method]}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{PAYMENT_FEE_DISCLAIMER}</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
