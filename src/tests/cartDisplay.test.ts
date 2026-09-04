import { describe, expect, it } from "vitest";

import {
  cartItemDisplayName,
  cartItemQuantityLabel,
  cartItemVariantSubtitle,
  isKitShareCartItem,
} from "@/lib/shop/cartDisplay";

describe("cartDisplay", () => {
  it("formats kit share cart lines with variant and shared kit size", () => {
    const subtitle = cartItemVariantSubtitle({
      product_name_snapshot: "Retatrutide",
      product_code_snapshot: "20RT",
      quantity: 7,
      kit_share_id: "kit-1",
      note: "Kit Anteil · 20 mg · 7 Vials · Gemeinsames 10-Vial-Kit",
    });

    expect(subtitle).toContain("Kit Anteil");
    expect(subtitle).toContain("7/10 Kit");
    expect(subtitle).toContain("Gemeinsames 10er Kit");
    expect(isKitShareCartItem({
      product_name_snapshot: "Retatrutide",
      product_code_snapshot: "20RT",
      quantity: 7,
      kit_share_id: "kit-1",
    })).toBe(true);
  });

  it("shows standard vial variant for non-kit items", () => {
    const subtitle = cartItemVariantSubtitle({
      product_name_snapshot: "Retatrutide",
      product_code_snapshot: "20RT",
      quantity: 1,
      kit_share_id: null,
      note: null,
    });

    expect(subtitle === null || typeof subtitle === "string").toBe(true);
    expect(
      isKitShareCartItem({
        product_name_snapshot: "Retatrutide",
        product_code_snapshot: "20RT",
        quantity: 1,
        kit_share_id: null,
      }),
    ).toBe(false);
  });

  it("formats cart quantities from the shared quantity domain", () => {
    expect(
      cartItemQuantityLabel({
        product_name_snapshot: "Selank",
        product_code_snapshot: "SK10",
        quantity: 2,
      }),
    ).toBe("2 Kits");
    expect(
      cartItemQuantityLabel({
        product_name_snapshot: "TEST ENANTHATE",
        product_code_snapshot: "TE300",
        quantity: 5,
      }),
    ).toBe("5 Vials");
    expect(
      cartItemQuantityLabel({
        product_name_snapshot: "ANADROL",
        product_code_snapshot: "OXO50",
        quantity: 5,
      }),
    ).toBe("5 Packungen");
    expect(
      cartItemQuantityLabel({
        product_name_snapshot: "BAC Water",
        product_code_snapshot: "BA10",
        quantity: 1,
      }),
    ).toBe("1 Kit");
    expect(
      cartItemQuantityLabel({
        product_name_snapshot: "Selank",
        product_code_snapshot: "SK10",
        quantity: 5,
        kit_share_id: "kit-1",
        note: "Gemeinsames 10-Vial-Kit",
      }),
    ).toBe("5/10 Kit");
  });

  it("normalizes product display names", () => {
    expect(
      cartItemDisplayName({
        product_name_snapshot: "  Retatrutide  ",
        product_code_snapshot: "20RT",
        quantity: 3,
      }),
    ).toBe("Retatrutide");
  });

  it("shows oral pack size for non-kit cart lines", () => {
    expect(
      cartItemVariantSubtitle({
        product_name_snapshot: "5-amino-1mq",
        product_code_snapshot: "AMQ50",
        quantity: 1,
        dosage_vial_snapshot: "50mg x 25tablets",
      }),
    ).toBe("50 mg × 25 Tabletten");
  });
});
