import { describe, expect, it } from "vitest";

import { zeroPriceAction } from "@/lib/shop/zeroPricePolicy";

describe("zero-price deactivation policy", () => {
  it("deactivates only active 0-price SKUs that Excel marks OUT OF STOCK", () => {
    expect(
      zeroPriceAction({ priceUsd: 0, isActive: true, excelStatus: "OUT_OF_STOCK" }),
    ).toBe("deactivate");
  });

  it("does not deactivate 0-price SKUs that Excel marks AVAILABLE", () => {
    expect(zeroPriceAction({ priceUsd: 0, isActive: true, excelStatus: "AVAILABLE" })).toBe(
      "keep-blocker",
    );
  });

  it("does not deactivate 0-price SKUs that Excel cannot match", () => {
    expect(zeroPriceAction({ priceUsd: 0, isActive: true, excelStatus: "UNKNOWN" })).toBe(
      "keep-blocker",
    );
  });

  it("does not auto-deactivate positive-price SKUs even when Excel is OUT OF STOCK", () => {
    expect(
      zeroPriceAction({ priceUsd: 45, isActive: true, excelStatus: "OUT_OF_STOCK" }),
    ).toBe("keep");
  });
});
