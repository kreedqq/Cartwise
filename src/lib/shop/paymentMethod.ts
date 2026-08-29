export const PAYMENT_METHODS = ["crypto", "paypal", "bank_transfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  crypto: "Krypto",
  bank_transfer: "Überweisung",
  paypal: "PayPal",
};

export const PAYMENT_METHOD_REQUIRED_MESSAGE = "Bitte wählen Sie eine Zahlungsmethode aus.";

export const PAYMENT_FEE_DISCLAIMER =
  "Eventuell anfallende Gebühren der gewählten Zahlungsmethode trägt der Käufer.";

export function isPaymentMethod(value: string | null | undefined): value is PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod);
}

/** Optional human-readable note; payment method is stored in orders.payment_method. */
export function formatPaymentMethodNote(method: PaymentMethod, userNote: string | null): string {
  const label = PAYMENT_METHOD_LABELS[method];
  const trimmed = userNote?.trim() ?? "";
  return trimmed ? `Zahlungsmethode: ${label}\n\n${trimmed}` : `Zahlungsmethode: ${label}`;
}
