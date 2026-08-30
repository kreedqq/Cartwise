import { describe, expect, it } from "vitest";

import {
  formatVialVariant,
  isKitShareableProduct,
  kitShareableVariants,
  kitSizeVialsForProduct,
  parseVariantColumn,
  shopProductTitle,
  vialStrengthForProduct,
  variantMetaForCode,
  variantStrengthLabel,
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

describe("formatVialVariant", () => {
  it("formats vial kit labels as 10x [strength] Vials", () => {
    expect(formatVialVariant({ code: "RT10", name: "Retatrutide", dosage_vial: "10 mg" })).toBe(
      "10x 10 mg Vials",
    );
    expect(formatVialVariant({ code: "RT20", name: "Retatrutide", dosage_vial: "20 mg" })).toBe(
      "10x 20 mg Vials",
    );
    expect(formatVialVariant({ code: "10AD", name: "AOD9604", dosage_vial: null })).toMatch(/^10x .+ Vials$/);
  });

  it("handles IU and ml units when kit size is known", () => {
    expect(formatVialVariant({ code: "H10", name: "HGH", dosage_vial: null })).toMatch(/^10x .+ Vials$/i);
  });

  it("returns strength only when no kit size is known", () => {
    expect(formatVialVariant({ code: "D100", name: "Mast P (DP)", dosage_vial: null })).toBe("100 mg");
  });
});

describe("shopProductTitle", () => {
  it("shows inline variant label for single-variant products", () => {
    expect(
      shopProductTitle("Mast P (DP)", { code: "D100", name: "Mast P (DP)", dosage_vial: null }, false),
    ).toBe("Mast P (DP) 100 mg");
  });

  it("shows kit variant label for single-variant peptide kits", () => {
    expect(
      shopProductTitle("AOD9604", { code: "10AD", name: "AOD9604", dosage_vial: null }, false),
    ).toMatch(/^AOD9604 10x .+ Vials$/);
  });

  it("keeps name only when multiple variants use dropdown", () => {
    expect(
      shopProductTitle("Retatrutide", { code: "RT10", name: "Retatrutide", dosage_vial: "10 mg" }, true),
    ).toBe("Retatrutide");
  });
});

describe("kitShareableVariants", () => {
  it("returns only variants with explicit kit sizes from coverage data", () => {
    const variants = [
      { id: "a", code: "10AD", name: "AOD9604" },
      { id: "b", code: "D100", name: "Mast P" },
    ];
    expect(kitShareableVariants(variants).map((v) => v.code)).toEqual(["10AD"]);
  });

  it("keeps Retatrutide strength variants separate by product row", () => {
    const variants = [
      { id: "rt10", code: "RT10", name: "Retatrutide", dosage_vial: "10 mg" },
      { id: "rt20", code: "RT20", name: "Retatrutide", dosage_vial: "20 mg" },
      { id: "rt30", code: "RT30", name: "Retatrutide", dosage_vial: "30 mg" },
    ];
    expect(kitShareableVariants(variants)).toHaveLength(3);
    expect(variantStrengthLabel(variants[0])).toBe("10x 10 mg Vials");
    expect(variantStrengthLabel(variants[1])).toBe("10x 20 mg Vials");
    expect(variantStrengthLabel(variants[2])).toBe("10x 30 mg Vials");
    expect(kitSizeVialsForProduct(variants[0])).toBe(10);
    expect(kitSizeVialsForProduct(variants[1])).toBe(10);
    expect(kitSizeVialsForProduct(variants[2])).toBe(10);
  });
});
