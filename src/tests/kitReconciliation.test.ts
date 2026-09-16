import { describe, expect, it } from "vitest";

import {
  kitReconcileIssueLabel,
  kitReconcileOverallLabel,
  kitReconcileParticipantStatusLabel,
  parseKitReconcileReport,
} from "@/lib/kit/kitReconciliation";

describe("parseKitReconcileReport", () => {
  it("parses HEALTHY full kit", () => {
    const report = parseKitReconcileReport({
      kitShareId: "kit-1",
      checkedAt: "2026-09-16T10:00:00.000Z",
      overallStatus: "HEALTHY",
      state: {
        status: "full",
        allocatedQuantity: 10,
        kitSize: 10,
        remainingQuantity: 0,
        isLocked: false,
        isOpenRequest: true,
      },
      participants: [
        {
          userId: "u1",
          username: "alice",
          participantQuantity: 5,
          cartQuantity: 5,
          cartLineCount: 1,
          orderId: null,
          orderSnapshotQuantity: null,
          status: "HEALTHY",
        },
      ],
      participantCount: 1,
      healthyParticipantCount: 1,
      issues: [],
      reconciliationRequired: false,
    });

    expect(report.overallStatus).toBe("HEALTHY");
    expect(report.state?.isFull).toBe(true);
    expect(report.participants[0]?.cartQuantity).toBe(5);
    expect(report.reconciliationRequired).toBe(false);
  });

  it("parses WRONG_CART_QUANTITY issue", () => {
    const report = parseKitReconcileReport({
      kitShareId: "kit-2",
      checkedAt: "2026-09-16T10:00:00.000Z",
      overallStatus: "NEEDS_ATTENTION",
      state: { status: "full", allocatedQuantity: 10, kitSize: 10, remainingQuantity: 0 },
      participants: [
        {
          userId: "u1",
          username: "bob",
          participantQuantity: 5,
          cartQuantity: 3,
          cartLineCount: 1,
          status: "WRONG_CART_QUANTITY",
        },
      ],
      participantCount: 1,
      healthyParticipantCount: 0,
      issues: [
        {
          code: "WRONG_CART_QUANTITY",
          severity: "warning",
          participantQuantity: 5,
          cartQuantity: 3,
        },
      ],
      reconciliationRequired: true,
    });

    expect(report.reconciliationRequired).toBe(true);
    expect(kitReconcileIssueLabel("WRONG_CART_QUANTITY")).toContain("Warenkorb");
    expect(kitReconcileParticipantStatusLabel("WRONG_CART_QUANTITY")).toBeTruthy();
    expect(kitReconcileOverallLabel("NEEDS_ATTENTION")).toContain("Abweichung");
  });

  it("parses MISSING_CART_LINE and DUPLICATE_CART_LINE", () => {
    const report = parseKitReconcileReport({
      kitShareId: "kit-3",
      overallStatus: "NEEDS_ATTENTION",
      participants: [
        {
          userId: "u1",
          participantQuantity: 5,
          cartQuantity: 0,
          cartLineCount: 0,
          status: "MISSING_CART_LINE",
        },
        {
          userId: "u2",
          participantQuantity: 5,
          cartQuantity: 5,
          cartLineCount: 2,
          status: "DUPLICATE_CART_LINE",
        },
      ],
      issues: [
        { code: "MISSING_CART_LINE", severity: "warning" },
        { code: "DUPLICATE_CART_LINE", severity: "warning" },
      ],
      reconciliationRequired: true,
    });

    expect(report.participants).toHaveLength(2);
    expect(kitReconcileIssueLabel("MISSING_CART_LINE")).toContain("fehlt");
    expect(kitReconcileIssueLabel("DUPLICATE_CART_LINE")).toContain("Doppelte");
  });

  it("marks historical snapshot mismatch as info severity path", () => {
    const report = parseKitReconcileReport({
      kitShareId: "kit-4",
      overallStatus: "NEEDS_ATTENTION",
      state: { status: "ordered", allocatedQuantity: 10, kitSize: 10, isLocked: true },
      participants: [
        {
          userId: "u1",
          participantQuantity: 5,
          cartQuantity: 5,
          cartLineCount: 1,
          orderId: "ord-1",
          orderSnapshotQuantity: 5,
          status: "HEALTHY",
        },
      ],
      issues: [{ code: "ORDERED", severity: "info" }],
      reconciliationRequired: false,
    });

    expect(report.state?.isOrdered).toBe(true);
    expect(report.state?.isLocked).toBe(true);
  });
});
