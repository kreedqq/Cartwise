import { describe, expect, it } from "vitest";

import { summarizeOrderIntegrity } from "@/lib/orderIntegrity";

describe("summarizeOrderIntegrity", () => {
  it("classifies HeyAnna5-style mixed checkout as expected remaining incomplete kits", () => {
    const orderId = "order-063";
    const summary = summarizeOrderIntegrity({
      orderId,
      orderLines: [
        { productCode: "BA3", quantity: 2, lineTotalUsd: 12.5, kitShareIdSnapshot: null },
        { productCode: "CGL5", quantity: 2, lineTotalUsd: 24.82, kitShareIdSnapshot: "kit-cgl" },
      ],
      cartLines: [
        {
          productCode: "KP10",
          quantity: 5,
          kitShareId: "kit-kpv",
          submittedOrderId: null,
          kitStatus: "open",
          kitAllocated: 5,
          kitSizeVials: 10,
          eurValue: 32.81,
        },
        {
          productCode: "BA3",
          quantity: 2,
          kitShareId: null,
          submittedOrderId: orderId,
          kitStatus: null,
          kitAllocated: null,
          kitSizeVials: null,
          eurValue: 10.78,
        },
        {
          productCode: "2S10",
          quantity: 5,
          kitShareId: "kit-ss31",
          submittedOrderId: null,
          kitStatus: "open",
          kitAllocated: 5,
          kitSizeVials: 10,
          eurValue: 44.02,
        },
        {
          productCode: "CGL5",
          quantity: 2,
          kitShareId: "kit-cgl",
          submittedOrderId: orderId,
          kitStatus: "ordered",
          kitAllocated: 10,
          kitSizeVials: 10,
          eurValue: 21.41,
        },
      ],
    });

    expect(summary.category).toBe("expected_remaining_cart");
    expect(summary.remainingIncompleteKitLines).toBe(2);
    expect(summary.cartLinesLinkedToOrder).toBe(2);
  });
});
