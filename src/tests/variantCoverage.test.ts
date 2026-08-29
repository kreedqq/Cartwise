import { describe, expect, it } from "vitest";

import {
  isKitShareableProduct,
  kitSizeVialsForProduct,
  parseVariantColumn,
  shopProductTitle,
  vialStrengthForProduct,
  variantMetaForCode,
} from "@/lib/shop/variantCoverage";

describe("parseVariantColumn", () => {
  it("parses vial strength and kit size from peptide variant strings", () => {
    expect(parseVariantColumn("10mg/vial x10vials")).toEqual({
      vialStrength: "10 mg",
      kitSizeVials: 10,
    });
    expect(parseVariantColumn("10mg/vial x 10vials")).toEqual({
      vialStrength: "10 mg",
      kitSizeVials: 10,
    });
  });

  it("parses oil strengths without kit size", () => {
    expect(parseVariantColumn("100mg")).toEqual({
      vialStrength: "100 mg",
      kitSizeVials: null,
    });
    expect(parseVariantColumn("200mg")).toEqual({
      vialStrength: "200 mg",
      kitSizeVials: null,
    });
  });

  it("does not treat capsule packs as vial kits", () => {
    expect(parseVariantColumn("100mg x 60capsule").kitSizeVials).toBeNull();
  });
});

describe("variantMetaForCode from uploaded product file", () => {
  it("uses Mast P 100 mg from file, not product code D100", () => {
    const meta = variantMetaForCode("D100");
    expect(meta?.vialStrength).toBe("100 mg");
    expect(meta?.kitSizeVials).toBeNull();
  });

  it("uses Mast E 200 mg from file", () => {
    const meta = variantMetaForCode("D200");
    expect(meta?.vialStrength).toBe("200 mg");
  });

  it("detects 10-vial kits for AOD9604 from file", () => {
    expect(kitSizeVialsForProduct({ code: "10AD" })).toBe(10);
    expect(isKitShareableProduct({ code: "10AD" })).toBe(true);
  });
});

describe("vialStrengthForProduct", () => {
  it("prefers dosage_vial from database over file", () => {
    expect(
      vialStrengthForProduct({ code: "D100", name: "Mast P (DP)", dosage_vial: "100 mg / Vial" }),
    ).toBe("100 mg / Vial");
  });

  it("falls back to uploaded file when dosage_vial is empty", () => {
    expect(vialStrengthForProduct({ code: "D100", name: "Mast P (DP)", dosage_vial: null })).toBe("100 mg");
  });

  it("does not guess strength from product codes", () => {
    expect(vialStrengthForProduct({ code: "ZZ999", name: "Unknown Product", dosage_vial: null })).toBeNull();
  });
});

describe("shopProductTitle", () => {
  it("shows inline strength for single-variant products", () => {
    expect(
      shopProductTitle("Mast P (DP)", { code: "D100", name: "Mast P (DP)", dosage_vial: null }, false),
    ).toBe("Mast P (DP) 100 mg");
  });

  it("keeps name only when multiple variants use dropdown", () => {
    expect(
      shopProductTitle("Retatrutide", { code: "RT10", name: "Retatrutide", dosage_vial: "10 mg" }, true),
    ).toBe("Retatrutide");
  });
});
