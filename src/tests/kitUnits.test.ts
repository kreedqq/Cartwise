import { describe, expect, it } from "vitest";

import {
  formatKitQuantity,
  isValidKitSize,
  KIT_SIZE_OPTIONS,
  kitQuantityUnitLabel,
} from "@/lib/shop/kitUnits";

describe("kitUnits", () => {
  it("uses Kit for peptides and water", () => {
    expect(kitQuantityUnitLabel({ category: "PEPTIDES", name: "Retatrutide", code: "RT20" })).toBe("Kit");
    expect(kitQuantityUnitLabel({ category: "RECONSTITUTION WATER", name: "BAC Water", code: "BA10" })).toBe("Kit");
  });

  it("uses Vial for oils and Packung for orals", () => {
    expect(kitQuantityUnitLabel({ category: "INJECTABLE OILS", name: "Mast P", code: "D100" })).toBe("Vial");
    expect(kitQuantityUnitLabel({ category: "ORALS", name: "Product", code: "O100" })).toBe("Packung");
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

  it("formats allocated kit quantities with the category unit", () => {
    expect(formatKitQuantity(3, "peptides")).toBe("3 Kits");
    expect(formatKitQuantity(1, "peptides")).toBe("1 Kit");
    expect(formatKitQuantity(5, "peptides", 10)).toBe("5/10 Kit");
    expect(formatKitQuantity(10, "peptides", 10)).toBe("1 Kit");
    expect(formatKitQuantity(5, "injectable-oils")).toBe("5 Vials");
    expect(formatKitQuantity(2, "orals")).toBe("2 Packungen");
  });
});
