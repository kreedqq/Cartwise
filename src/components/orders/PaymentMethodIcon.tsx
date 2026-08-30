import { Building2 } from "lucide-react";

import type { PaymentMethod } from "@/lib/shop/paymentMethod";

/** Shared payment-method glyph, reused by the checkout selector, the customer
 * order detail, and the admin order views so all three stay visually consistent. */
export function PaymentMethodIcon({ method, className }: { method: PaymentMethod; className?: string }) {
  if (method === "crypto") {
    return (
      <span className={className ?? "text-lg font-semibold leading-none"} aria-hidden="true">
        ₿
      </span>
    );
  }
  if (method === "paypal") {
    return (
      <svg viewBox="0 0 24 24" className={className ?? "h-5 w-5"} aria-hidden="true">
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
  return <Building2 className={className ?? "h-5 w-5"} aria-hidden="true" />;
}
