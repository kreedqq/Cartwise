import { describe, expect, it } from "vitest";

import {
  formatKitQuantity,
  isValidKitSize,
  KIT_SIZE_OPTIONS,
  kitQuantityUnitLabel,
} from "@/lib/shop/kitUnits";

describe("kitUnits", () => {
  it("uses Vials for peptides and water", () => {
    expect(kitQuantityUnitLabel({ category: "PEPTIDES", name: "Retatrutide", code: "RT20" })).toBe("Vials");
    expect(kitQuantityUnitLabel({ category: "RECONSTITUTION WATER", name: "BAC Water", code: "BA10" })).toBe(
      "Vials",
    );
  });

  it("uses Stück for oils and orals", () => {
    expect(kitQuantityUnitLabel({ category: "INJECTABLE OILS", name: "Mast P", code: "D100" })).toBe("Stück");
    expect(kitQuantityUnitLabel({ category: "ORALS", name: "Product", code: "O100" })).toBe("Stück");
  });

  it("validates kit sizes as multiples of 10", () => {
    expect(isValidKitSize(10)).toBe(true);
    expect(isValidKitSize(20)).toBe(true);
    expect(isValidKitSize(30)).toBe(true);
    expect(isValidKitSize(100)).toBe(true);
    expect(isValidKitSize(11)).toBe(false);
    expect(isValidKitSize(9)).toBe(false);
    expect(isValidKitSize(15)).toBe(false);
    expect(isValidKitSize(21)).toBe(false);
    expect(isValidKitSize(25)).toBe(false);
    expect(KIT_SIZE_OPTIONS[0]).toBe(10);
  });

  it("formats quantities with correct unit", () => {
    expect(formatKitQuantity(3, "Vials")).toBe("3 Vials");
    expect(formatKitQuantity(1, "Vials")).toBe("1 Vial");
    expect(formatKitQuantity(7, "Stück")).toBe("7 Stück");
  });
});
