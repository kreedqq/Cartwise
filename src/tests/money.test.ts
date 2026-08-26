import { describe, expect, it } from "vitest";

import {
  calculateCartTotals,
  calculateLineTotalUsd,
  convertUsdToEur,
  formatEur,
  formatUsd,
  isValidQuantity,
  normalizeProductCode,
  roundCurrency,
  roundHalfUp,
} from "@/lib/money";

describe("roundHalfUp", () => {
  it("rounds .005 up to the next cent (round-half-up, not banker's rounding)", () => {
    expect(roundHalfUp(1.005, 2)).toBe(1.01);
    expect(roundHalfUp(2.675, 2)).toBe(2.68);
  });

  it("rounds negative numbers away from zero at the half point", () => {
    expect(roundHalfUp(-1.005, 2)).toBe(-1.01);
  });

  it("leaves already-rounded values untouched", () => {
    expect(roundHalfUp(10, 2)).toBe(10);
    expect(roundHalfUp(3.14, 2)).toBe(3.14);
  });
});

describe("roundCurrency", () => {
  it("always returns 2 decimal precision semantics", () => {
    expect(roundCurrency(19.995)).toBe(20);
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3); // classic float trap
  });
});

describe("calculateLineTotalUsd", () => {
  it("multiplies quantity by unit price and rounds to cents", () => {
    expect(calculateLineTotalUsd(3, 19.99)).toBe(59.97);
    expect(calculateLineTotalUsd(0.5, 10)).toBe(5);
  });

  it("returns null for invalid quantity or price", () => {
    expect(calculateLineTotalUsd(0, 10)).toBeNull();
    expect(calculateLineTotalUsd(-1, 10)).toBeNull();
    expect(calculateLineTotalUsd(NaN, 10)).toBeNull();
    expect(calculateLineTotalUsd(1, -5)).toBeNull();
  });
});

describe("convertUsdToEur", () => {
  it("converts using the given rate and rounds to cents", () => {
    expect(convertUsdToEur(100, 0.92)).toBe(92);
    expect(convertUsdToEur(59.97, 0.9123)).toBe(54.71);
  });

  it("never invents a value when the rate is missing or invalid", () => {
    expect(convertUsdToEur(100, null)).toBeNull();
    expect(convertUsdToEur(100, undefined)).toBeNull();
    expect(convertUsdToEur(100, 0)).toBeNull();
    expect(convertUsdToEur(100, -1)).toBeNull();
  });
});

describe("isValidQuantity", () => {
  it("accepts positive numbers within range with up to 3 decimals", () => {
    expect(isValidQuantity(1)).toBe(true);
    expect(isValidQuantity(0.001)).toBe(true);
    expect(isValidQuantity(1.5)).toBe(true);
    expect(isValidQuantity(1.234)).toBe(true);
    expect(isValidQuantity(100000)).toBe(true);
  });

  it("rejects zero, negative, too large, too precise, or non-numeric values", () => {
    expect(isValidQuantity(0)).toBe(false);
    expect(isValidQuantity(-5)).toBe(false);
    expect(isValidQuantity(100001)).toBe(false);
    expect(isValidQuantity(1.2345)).toBe(false);
    expect(isValidQuantity(NaN)).toBe(false);
    expect(isValidQuantity("5" as unknown as number)).toBe(false);
  });
});

describe("normalizeProductCode", () => {
  it("trims whitespace and upper-cases", () => {
    expect(normalizeProductCode("  art-1001 ")).toBe("ART-1001");
    expect(normalizeProductCode("Art-1001")).toBe("ART-1001");
  });
});

describe("calculateCartTotals", () => {
  it("sums USD and EUR totals across resolved lines", () => {
    const totals = calculateCartTotals([
      { quantity: 2, totalUsd: 20, totalEur: 18.4, resolutionStatus: "resolved" },
      { quantity: 1, totalUsd: 10, totalEur: 9.2, resolutionStatus: "resolved" },
    ]);
    expect(totals.totalUsd).toBe(30);
    expect(totals.totalEur).toBe(27.6);
    expect(totals.itemCount).toBe(2);
    expect(totals.totalQuantity).toBe(3);
  });

  it("returns totalEur = null (not 0, not partial) when any priced line lacks a EUR value", () => {
    const totals = calculateCartTotals([
      { quantity: 1, totalUsd: 10, totalEur: 9.2, resolutionStatus: "resolved" },
      { quantity: 1, totalUsd: 10, totalEur: null, resolutionStatus: "resolved" },
    ]);
    expect(totals.totalUsd).toBe(20);
    expect(totals.totalEur).toBeNull();
  });

  it("counts unresolved and missing-price lines without including them in totals", () => {
    const totals = calculateCartTotals([
      { quantity: 1, totalUsd: null, totalEur: null, resolutionStatus: "not_found" },
      { quantity: 2, totalUsd: 20, totalEur: 18.4, resolutionStatus: "resolved" },
    ]);
    expect(totals.totalUsd).toBe(20);
    expect(totals.unresolvedCount).toBe(1);
    expect(totals.missingPriceCount).toBe(1);
    expect(totals.itemCount).toBe(2);
  });

  it("handles an empty cart", () => {
    const totals = calculateCartTotals([]);
    expect(totals.totalUsd).toBe(0);
    expect(totals.totalEur).toBeNull();
    expect(totals.itemCount).toBe(0);
  });
});

describe("formatUsd / formatEur", () => {
  it("returns an em dash placeholder for missing values instead of $NaN or similar", () => {
    expect(formatUsd(null)).toBe("—");
    expect(formatUsd(undefined)).toBe("—");
    expect(formatEur(NaN)).toBe("—");
  });

  it("formats finite numbers as currency strings", () => {
    expect(formatUsd(19.9)).toContain("19,90");
    expect(formatEur(19.9)).toContain("19,90");
  });
});
