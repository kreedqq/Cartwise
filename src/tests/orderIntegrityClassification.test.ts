import { describe, expect, it } from "vitest";

import {
  classifyKitCartMissingLink,
  classifyLegacyZeroLinkedOrder,
} from "@/lib/orderIntegrityClassification";

describe("orderIntegrityClassification", () => {
  it("classifies 12 legacy zero-link orders as valid legacy state", () => {
    expect(
      classifyLegacyZeroLinkedOrder({
        orderNumber: "CW-2026-000023",
        orderItemCount: 9,
        linesLinked: 0,
        linesUnlinked: 9,
        shopArea: null,
      }),
    ).toBe("valid_legacy_state");
  });

  it("classifies provable kit cart missing link when participant order matches", () => {
    expect(
      classifyKitCartMissingLink({
        submittedOrderId: null,
        participantOrderId: "order-1",
        participantOrderedAt: "2026-09-01T00:00:00Z",
        orderNumber: "CW-2026-000030",
        quantityMatches: true,
      }),
    ).toBe("provable_missing_link");
  });

  it("classifies peptixx-style rows as ambiguous when ordered_at but no order id", () => {
    expect(
      classifyKitCartMissingLink({
        submittedOrderId: null,
        participantOrderId: null,
        participantOrderedAt: "2026-08-30T00:00:00Z",
        orderNumber: null,
        quantityMatches: true,
      }),
    ).toBe("ambiguous");
  });
});
