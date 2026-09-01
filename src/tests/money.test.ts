import { describe, expect, it } from "vitest";

import {
  calculateCartTotals,
  calculateLineTotalUsd,
  catalogBulkUnitPriceUsd,
  convertUsdToEur,
  formatBulkTier,
  formatEur,
  formatUsd,
  getEffectiveUnitPrice,
  hasBulkTier,
  isValidQuantity,
  normalizeProductCode,
  roundCurrency,
  roundHalfUp,
  summarizeOrderCharges,
  type PricedProduct,
} from "@/lib/money";

/** The worked example from the spec: 1-9 x 60 USD, from 10 on 55 USD. */
const TIERED = { price_usd: 60, bulk_price_usd: 55, bulk_price_min_quantity: 10 };
const FLAT = { price_usd: 60, bulk_price_usd: null, bulk_price_min_quantity: null };
/** Injectable Oils catalog: pack total 160 for 10 pieces = 16 per unit. */
const OIL_PACK = { price_usd: 18, bulk_price_usd: 160, bulk_price_min_quantity: 10 };
/** Oils row that already stores a unit bulk (PA20-style). */
const OIL_UNIT_BULK = { price_usd: 110, bulk_price_usd: 100, bulk_price_min_quantity: 10 };

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

describe("getEffectiveUnitPrice", () => {
  it("uses the normal price below the bulk threshold", () => {
    expect(getEffectiveUnitPrice(TIERED, 1).unitPriceUsd).toBe(60);
    expect(getEffectiveUnitPrice(TIERED, 7).unitPriceUsd).toBe(60);
    expect(getEffectiveUnitPrice(TIERED, 9).unitPriceUsd).toBe(60);
    expect(getEffectiveUnitPrice(TIERED, 9).tier).toBe("normal");
  });

  it("uses the bulk price from the threshold onwards, for every unit", () => {
    expect(getEffectiveUnitPrice(TIERED, 10).unitPriceUsd).toBe(55);
    expect(getEffectiveUnitPrice(TIERED, 12).unitPriceUsd).toBe(55);
    expect(getEffectiveUnitPrice(TIERED, 1000).unitPriceUsd).toBe(55);
    expect(getEffectiveUnitPrice(TIERED, 10).tier).toBe("bulk");
  });

  it("computes the spec's line totals exactly", () => {
    const total = (quantity: number, product: PricedProduct = TIERED) =>
      calculateLineTotalUsd(quantity, getEffectiveUnitPrice(product, quantity).unitPriceUsd);

    expect(total(1)).toBe(60);
    expect(total(9)).toBe(540);
    expect(total(10)).toBe(550);
    expect(total(12)).toBe(660);
    // No bulk tier configured: the normal price applies at any quantity.
    expect(total(12, FLAT)).toBe(720);
  });

  it("never applies a graduated price - the bulk price replaces the whole line", () => {
    // 12 x 55 = 660, not 9 x 60 + 3 x 55 = 705.
    expect(calculateLineTotalUsd(12, getEffectiveUnitPrice(TIERED, 12).unitPriceUsd)).not.toBe(705);
  });

  it("falls back to the normal price when only half a bulk tier is present", () => {
    expect(getEffectiveUnitPrice({ price_usd: 60, bulk_price_usd: 55 }, 20).unitPriceUsd).toBe(60);
    expect(getEffectiveUnitPrice({ price_usd: 60, bulk_price_min_quantity: 10 }, 20).unitPriceUsd).toBe(60);
    expect(getEffectiveUnitPrice({ price_usd: 60, bulk_price_usd: 55, bulk_price_min_quantity: 0 }, 20).tier).toBe(
      "normal",
    );
  });

  it("accepts a bulk price of 0 (a giveaway is a valid price, unlike a missing one)", () => {
    const product = { price_usd: 60, bulk_price_usd: 0, bulk_price_min_quantity: 10 };
    expect(getEffectiveUnitPrice(product, 10).unitPriceUsd).toBe(0);
    expect(getEffectiveUnitPrice(product, 9).unitPriceUsd).toBe(60);
  });

  it("handles fractional thresholds and quantities", () => {
    const product = { price_usd: 10, bulk_price_usd: 8, bulk_price_min_quantity: 2.5 };
    expect(getEffectiveUnitPrice(product, 2.499).unitPriceUsd).toBe(10);
    expect(getEffectiveUnitPrice(product, 2.5).unitPriceUsd).toBe(8);
  });

  it("keeps the normal price when the quantity is unknown", () => {
    expect(getEffectiveUnitPrice(TIERED, null).unitPriceUsd).toBe(60);
    expect(getEffectiveUnitPrice(TIERED, NaN).unitPriceUsd).toBe(60);
  });

  it("reports the configured tier alongside the applied price", () => {
    const effective = getEffectiveUnitPrice(TIERED, 3);
    expect(effective.bulkPriceUsd).toBe(55);
    expect(effective.bulkPriceMinQuantity).toBe(10);
  });

  it("treats an oils pack-total bulk as a per-unit price, never 160 × quantity", () => {
    const total = (quantity: number) =>
      calculateLineTotalUsd(quantity, getEffectiveUnitPrice(OIL_PACK, quantity).unitPriceUsd);

    expect(getEffectiveUnitPrice(OIL_PACK, 1).unitPriceUsd).toBe(18);
    expect(getEffectiveUnitPrice(OIL_PACK, 9).unitPriceUsd).toBe(18);
    expect(getEffectiveUnitPrice(OIL_PACK, 10).unitPriceUsd).toBe(16);
    expect(getEffectiveUnitPrice(OIL_PACK, 11).unitPriceUsd).toBe(16);
    expect(getEffectiveUnitPrice(OIL_PACK, 20).unitPriceUsd).toBe(16);
    expect(getEffectiveUnitPrice(OIL_PACK, 21).unitPriceUsd).toBe(16);
    expect(getEffectiveUnitPrice(OIL_PACK, 10).bulkPriceUsd).toBe(16);

    expect(total(1)).toBe(18);
    expect(total(9)).toBe(162);
    expect(total(10)).toBe(160);
    expect(total(11)).toBe(176);
    expect(total(20)).toBe(320);
    expect(total(21)).toBe(336);
    expect(total(10)).not.toBe(1600);
  });

  it("does not divide a bulk that is already a unit price (peptides / PA20)", () => {
    expect(catalogBulkUnitPriceUsd(TIERED)).toBe(55);
    expect(getEffectiveUnitPrice(TIERED, 10).unitPriceUsd).toBe(55);
    expect(catalogBulkUnitPriceUsd(OIL_UNIT_BULK)).toBe(100);
    expect(getEffectiveUnitPrice(OIL_UNIT_BULK, 10).unitPriceUsd).toBe(100);
    expect(calculateLineTotalUsd(10, getEffectiveUnitPrice(OIL_UNIT_BULK, 10).unitPriceUsd)).toBe(1000);
  });
});

describe("catalogBulkUnitPriceUsd", () => {
  it("converts oils pack totals and leaves unit bulks unchanged", () => {
    expect(catalogBulkUnitPriceUsd(OIL_PACK)).toBe(16);
    expect(catalogBulkUnitPriceUsd(TIERED)).toBe(55);
    expect(catalogBulkUnitPriceUsd(FLAT)).toBeNull();
  });
});

describe("hasBulkTier", () => {
  it("requires both halves of the pair to be present and plausible", () => {
    expect(hasBulkTier(TIERED)).toBe(true);
    expect(hasBulkTier(FLAT)).toBe(false);
    expect(hasBulkTier({ price_usd: 60, bulk_price_usd: 55, bulk_price_min_quantity: 0 })).toBe(false);
    expect(hasBulkTier({ price_usd: 60, bulk_price_usd: -1, bulk_price_min_quantity: 10 })).toBe(false);
  });
});

describe("formatBulkTier", () => {
  it("describes the tier for the admin table", () => {
    expect(formatBulkTier(TIERED)).toContain("ab 10");
    expect(formatBulkTier(TIERED)).toContain("55,00");
  });

  it("returns null when there is no tier to describe", () => {
    expect(formatBulkTier(FLAT)).toBeNull();
  });

  it("keeps the stored oils pack total in the admin catalog label", () => {
    expect(formatBulkTier(OIL_PACK)).toContain("160,00");
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

  it("cart total for oils qty 10 is 160, never 1600", () => {
    const unit = getEffectiveUnitPrice(OIL_PACK, 10).unitPriceUsd;
    const lineTotal = calculateLineTotalUsd(10, unit);
    const totals = calculateCartTotals([
      { quantity: 10, totalUsd: lineTotal, totalEur: null, resolutionStatus: "resolved" },
    ]);
    expect(unit).toBe(16);
    expect(lineTotal).toBe(160);
    expect(totals.totalUsd).toBe(160);
    expect(totals.totalUsd).not.toBe(1600);
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

describe("summarizeOrderCharges", () => {
  it("adds same-currency shipping onto the product subtotal", () => {
    const charges = summarizeOrderCharges({
      productUsd: 100,
      productEur: null,
      chinaAmount: 20,
      chinaCurrency: "EUR",
      deAmount: 8,
      deCurrency: "EUR",
      usdToEurRate: 1,
    });
    expect(charges.usdSubtotal).toBe(120);
    expect(charges.convertedEur).toBe(120);
    expect(charges.finalEur).toBe(128);
    expect(charges.grandDisplay).toContain("128");
  });

  it("never blindly adds mixed currencies without a rate", () => {
    const charges = summarizeOrderCharges({
      productUsd: 1000,
      productEur: null,
      chinaAmount: 100,
      chinaCurrency: "USD",
      deAmount: 20,
      deCurrency: "EUR",
      usdToEurRate: null,
    });
    expect(charges.usdSubtotal).toBe(1100);
    expect(charges.convertedEur).toBeNull();
    expect(charges.leftoverEur).toBe(20);
    expect(charges.grandDisplay).toContain("1.100,00");
    expect(charges.grandDisplay).toContain("20,00");
  });

  it("converts the full USD subtotal before adding Germany EUR shipping", () => {
    const rate = 0.9;
    const charges = summarizeOrderCharges({
      productUsd: 1000,
      productEur: null,
      chinaAmount: 100,
      chinaCurrency: "USD",
      deAmount: 20,
      deCurrency: "EUR",
      usdToEurRate: rate,
    });
    expect(charges.usdSubtotal).toBe(1100);
    expect(charges.convertedEur).toBe(990);
    expect(charges.finalEur).toBe(1010);
    expect(charges.leftoverEur).toBe(0);
    expect(charges.grandDisplay).toBe(formatEur(1010));
  });

  it("matches the China USD → EUR → Germany EUR checkout example", () => {
    const rate = 440.18 / 562.5;
    const charges = summarizeOrderCharges({
      productUsd: 512.5,
      productEur: null,
      chinaAmount: 50,
      chinaCurrency: "USD",
      deAmount: 6.99,
      deCurrency: "EUR",
      usdToEurRate: rate,
    });
    expect(charges.usdSubtotal).toBe(562.5);
    expect(charges.convertedEur).toBe(440.18);
    expect(charges.finalEur).toBe(447.17);
    expect(charges.grandDisplay).toBe(formatEur(447.17));
    expect(charges.grandDisplay).not.toContain("562,50");
  });
});
