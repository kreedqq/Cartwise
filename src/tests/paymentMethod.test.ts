import { describe, expect, it } from "vitest";

import {
  formatPaymentMethodNote,
  isPaymentMethod,
  PAYMENT_METHOD_REQUIRED_MESSAGE,
  PAYMENT_METHODS,
  PAYMENT_METHODS_UNAVAILABLE_MESSAGE,
  resolveEnabledPaymentMethods,
} from "@/lib/shop/paymentMethod";

describe("paymentMethod", () => {
  it("recognizes supported methods", () => {
    for (const method of PAYMENT_METHODS) {
      expect(isPaymentMethod(method)).toBe(true);
    }
    expect(isPaymentMethod("cash")).toBe(false);
    expect(isPaymentMethod(null)).toBe(false);
  });

  it("formats order note with selected payment method", () => {
    expect(formatPaymentMethodNote("crypto", null)).toBe("Zahlungsmethode: Krypto");
    expect(formatPaymentMethodNote("paypal", "Bitte schnell liefern")).toBe(
      "Zahlungsmethode: PayPal\n\nBitte schnell liefern",
    );
  });

  it("lists payment methods in checkout order", () => {
    expect(PAYMENT_METHODS).toEqual(["crypto", "paypal", "bank_transfer"]);
  });

  it("exposes required validation message", () => {
    expect(PAYMENT_METHOD_REQUIRED_MESSAGE).toContain("Zahlungsmethode");
  });

  it("fails closed when settings cannot be loaded", () => {
    expect(resolveEnabledPaymentMethods({ loadFailed: true, flags: { crypto: true, paypal: true, bank_transfer: true } })).toEqual([]);
    expect(resolveEnabledPaymentMethods({ loadFailed: false, flags: null })).toEqual(PAYMENT_METHODS);
    expect(resolveEnabledPaymentMethods({
      loadFailed: false,
      flags: { crypto: true, paypal: false, bank_transfer: true },
    })).toEqual(["crypto", "bank_transfer"]);
    expect(resolveEnabledPaymentMethods({
      loadFailed: false,
      flags: { crypto: false, paypal: false, bank_transfer: false },
    })).toEqual([]);
    expect(PAYMENT_METHODS_UNAVAILABLE_MESSAGE).toContain("keine Zahlungsmethoden");
  });
});
