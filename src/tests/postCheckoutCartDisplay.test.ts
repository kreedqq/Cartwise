import { describe, expect, it } from "vitest";

import { buildPostCheckoutCartLines } from "@/lib/postCheckoutCartDisplay";

const SUBMITTED_AT = "2026-09-15T08:31:47.699Z";
const ORDER_ID = "order-063";

describe("postCheckoutCartDisplay HeyAnna5 / CW-2026-000063", () => {
  it("separates omitted incomplete kit from post-checkout cart add", () => {
    const lines = buildPostCheckoutCartLines({
      orderId: ORDER_ID,
      orderSubmittedAt: SUBMITTED_AT,
      cartLines: [
        {
          productCode: "KP10",
          productName: "KPV",
          createdAt: "2026-09-12T12:08:03.710Z",
          dosageVial: null,
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
          productName: "BAC Water",
          createdAt: "2026-09-12T12:13:34.704Z",
          dosageVial: null,
          quantity: 2,
          kitShareId: null,
          submittedOrderId: ORDER_ID,
          kitStatus: null,
          kitAllocated: null,
          kitSizeVials: null,
          eurValue: 10.78,
        },
        {
          productCode: "CGL5",
          productName: "Cagrilintide",
          createdAt: "2026-09-12T19:30:43.929Z",
          dosageVial: null,
          quantity: 2,
          kitShareId: "kit-cgl",
          submittedOrderId: ORDER_ID,
          kitStatus: "ordered",
          kitAllocated: 10,
          kitSizeVials: 10,
          eurValue: 21.41,
        },
        {
          productCode: "2S10",
          productName: "SS-31",
          createdAt: "2026-09-15T12:31:05.637Z",
          dosageVial: null,
          quantity: 5,
          kitShareId: "kit-ss31",
          submittedOrderId: null,
          kitStatus: "full",
          kitAllocated: 10,
          kitSizeVials: 10,
          eurValue: 44.02,
        },
      ],
    });

    expect(lines).toHaveLength(2);
    const kpv = lines.find((l) => l.productCode === "KP10");
    const ss31 = lines.find((l) => l.productCode === "2S10");
    expect(kpv).toMatchObject({
      quantityLabel: "5/10 Kit",
      evidence: "CHECKOUT_OMITTED",
    });
    expect(kpv?.hint).toContain("unvollständig");
    expect(ss31).toMatchObject({
      quantityLabel: "5/10 Kit",
      evidence: "ADDED_AFTER_CHECKOUT",
    });
    expect(ss31?.hint).toContain("Nach dem Checkout");
  });
});

describe("postCheckoutCartDisplay legacy orders", () => {
  it("marks remaining lines unknown when no submitted_order_id links exist", () => {
    const lines = buildPostCheckoutCartLines({
      orderId: "order-legacy",
      orderSubmittedAt: "2026-09-01T10:00:00.000Z",
      cartLines: [
        {
          productCode: "SK10",
          productName: "Selank",
          createdAt: "2026-08-30T10:00:00.000Z",
          dosageVial: null,
          quantity: 5,
          kitShareId: null,
          submittedOrderId: null,
          kitStatus: null,
          kitAllocated: null,
          kitSizeVials: null,
          eurValue: null,
        },
      ],
    });
    expect(lines[0]?.evidence).toBe("HISTORICAL_LINK_UNKNOWN");
  });
});
