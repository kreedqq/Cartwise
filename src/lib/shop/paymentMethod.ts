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

export const PAYMENT_METHOD_SETTING_KEYS = {
  crypto: "payment_crypto_enabled",
  paypal: "payment_paypal_enabled",
  bank_transfer: "payment_bank_transfer_enabled",
} as const;

export type PaymentMethodSettingKey = (typeof PAYMENT_METHOD_SETTING_KEYS)[PaymentMethod];

export const PAYMENT_METHODS_UNAVAILABLE_MESSAGE = "Aktuell sind keine Zahlungsmethoden verfügbar.";

export type PaymentMethodFlags = Record<PaymentMethod, boolean>;

/**
 * Fail-closed when settings cannot be loaded.
 * Legacy RPC without flags keeps the current three methods visible.
 */
export function resolveEnabledPaymentMethods(input: {
  loadFailed: boolean;
  flags: PaymentMethodFlags | null;
}): PaymentMethod[] {
  if (input.loadFailed) return [];
  if (input.flags == null) return [...PAYMENT_METHODS];
  return PAYMENT_METHODS.filter((method) => input.flags?.[method] === true);
}

/** Optional human-readable note; payment method is stored in orders.payment_method. */
export function formatPaymentMethodNote(method: PaymentMethod, userNote: string | null): string {
  const label = PAYMENT_METHOD_LABELS[method];
  const trimmed = userNote?.trim() ?? "";
  return trimmed ? `Zahlungsmethode: ${label}\n\n${trimmed}` : `Zahlungsmethode: ${label}`;
}
