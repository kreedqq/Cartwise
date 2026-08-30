import { Badge } from "@/components/ui/badge";
import { PaymentMethodIcon } from "@/components/orders/PaymentMethodIcon";
import { isPaymentMethod, PAYMENT_METHOD_LABELS } from "@/lib/shop/paymentMethod";

/**
 * Renders the order's stored `payment_method`. Older orders created before
 * payment method was tracked (or any unexpected/legacy value) have
 * `payment_method === null` — that must never be invented, so it renders a
 * plain "Nicht angegeben" badge instead of guessing a method.
 */
export function PaymentMethodBadge({ paymentMethod }: { paymentMethod: string | null }) {
  if (!isPaymentMethod(paymentMethod)) {
    return <Badge variant="outline">Nicht angegeben</Badge>;
  }
  return (
    <Badge variant="outline" className="gap-1.5">
      <PaymentMethodIcon method={paymentMethod} className="h-3.5 w-3.5" />
      {PAYMENT_METHOD_LABELS[paymentMethod]}
    </Badge>
  );
}
