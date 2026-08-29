import { Building2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  PAYMENT_FEE_DISCLAIMER,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/shop/paymentMethod";

interface PaymentMethodSelectorProps {
  value: PaymentMethod | null;
  onChange: (method: PaymentMethod) => void;
  error?: string | null;
}

function PaymentMethodIcon({ method }: { method: PaymentMethod }) {
  if (method === "crypto") {
    return <span className="text-lg font-semibold leading-none" aria-hidden="true">₿</span>;
  }
  if (method === "paypal") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          fill="currentColor"
          d="M7.39 19.5h2.05l.64-4.07h2.58c2.66 0 4.74-1.08 5.19-4.22.22-1.42-.05-2.52-.78-3.24-.77-.76-2.01-1.14-3.68-1.14H8.17L7.39 19.5zm1.1-10.18h2.18c1.28 0 2.02.23 2.28 1.01.18.54.12 1.22-.18 1.94-.42 1.02-1.35 1.4-2.67 1.4H9.03l.46-4.35z"
        />
        <path
          fill="currentColor"
          d="M18.74 3.5H9.86c-.62 0-1.15.45-1.24 1.06L6.5 17.44c-.07.44.27.84.72.84h2.05l.52-3.28h2.58c2.66 0 4.74-1.08 5.19-4.22.47-3.01-1.05-4.68-3.82-4.68z"
          opacity="0.75"
        />
      </svg>
    );
  }
  return <Building2 className="h-5 w-5" aria-hidden="true" />;
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
