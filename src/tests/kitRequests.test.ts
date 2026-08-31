import { describe, expect, it } from "vitest";

import {
  assertKitRequestPricePrivacy,
  isValidCreatorQuantity,
  kitRequestProgressPercent,
  kitRequestStatusLabel,
  remainingQuantityOptions,
} from "@/lib/kitRequests";

describe("kit request helpers", () => {
  it("translates canonical statuses", () => {
    expect(kitRequestStatusLabel("open")).toBe("Offen");
    expect(kitRequestStatusLabel("full")).toBe("Vollständig");
    expect(kitRequestStatusLabel("cancelled")).toBe("Storniert");
    expect(kitRequestStatusLabel("expired")).toBe("Abgelaufen");
  });

  it("computes progress from stored allocated/required values", () => {
    expect(kitRequestProgressPercent(6, 10)).toBe(60);
    expect(kitRequestProgressPercent(0, 10)).toBe(0);
    expect(kitRequestProgressPercent(10, 10)).toBe(100);
    expect(kitRequestProgressPercent(12, 10)).toBe(100);
  });

  it("builds join quantity options up to remaining", () => {
    expect(remainingQuantityOptions(3)).toEqual([1, 2, 3]);
    expect(remainingQuantityOptions(0)).toEqual([]);
    expect(remainingQuantityOptions(-1)).toEqual([]);
  });

  it("rejects a creator taking the entire kit", () => {
    expect(isValidCreatorQuantity(10, 4)).toBe(true);
    expect(isValidCreatorQuantity(10, 10)).toBe(false);
    expect(isValidCreatorQuantity(10, 0)).toBe(false);
    expect(isValidCreatorQuantity(7, 3)).toBe(false);
  });

  it("allows only the viewer's own price keys", () => {
    expect(() =>
      assertKitRequestPricePrivacy({
        myPriceUsd: 36,
        myUnitPriceUsd: 18,
        creatorUsername: "testuser",
      }),
    ).not.toThrow();
  });

  it("rejects foreign prices, emails, display_name, and roles", () => {
    expect(() => assertKitRequestPricePrivacy({ participantPriceUsd: 12 })).toThrow(/Preisfeld/);
    expect(() => assertKitRequestPricePrivacy({ markup: 1.2 })).toThrow(/Preisfeld/);
    expect(() => assertKitRequestPricePrivacy({ email: "a@b.c" })).toThrow(/unzulässiges Feld/);
    expect(() => assertKitRequestPricePrivacy({ display_name: "Test User" })).toThrow(/unzulässiges Feld/);
    expect(() => assertKitRequestPricePrivacy({ role: "admin" })).toThrow(/unzulässiges Feld/);
  });
});
