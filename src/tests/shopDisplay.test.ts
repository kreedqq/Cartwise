import { describe, expect, it } from "vitest";

import { LIVE_SHOP_PRODUCTS } from "@/lib/peptide/persistence/liveShopProducts";
import {
  groupAndSortShopProducts,
  lexiconHrefForShopProduct,
  normalizeShopDisplayName,
  productMatchesShopSearch,
} from "@/lib/shop/display";
import type { Tables } from "@/types/database";

function shopRow(code: string, name: string, overrides: Partial<Tables<"products">> = {}): Tables<"products"> {
  return {
    id: code,
    code,
    name,
    description: null,
    dosage_vial: null,
    category: null,
    price_usd: 10,
    bulk_price_usd: null,
    bulk_price_min_quantity: null,
    currency: "USD",
    is_active: true,
    last_price_change_at: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("normalizeShopDisplayName", () => {
  it("strips trailing strength from peptide names", () => {
    expect(normalizeShopDisplayName("Tesamorelin 10mg")).toBe("Tesamorelin");
    expect(normalizeShopDisplayName("Finasteride 1mg")).toBe("Finasteride");
  });

  it("keeps canonical catalog names without invented merges", () => {
    expect(normalizeShopDisplayName("Retatrutide")).toBe("Retatrutide");
    expect(normalizeShopDisplayName("Semaglutide")).toBe("Semaglutide");
    expect(normalizeShopDisplayName("TriTren 225mg")).toBe("TriTren 225");
  });

  it("shows blend short names from parenthetical prefix", () => {
    expect(
      normalizeShopDisplayName("(KLOW) GHK-CU 50mg+TB500 10mg+BPC157 10mg+TB500 10mg Blend"),
    ).toBe("KLOW");
    expect(normalizeShopDisplayName("(GLOW) GHK-CU 50mg+TB500 10mg+BPC157 10mg Blend")).toBe("GLOW");
  });

  it("normalizes nandromix to base name", () => {
    expect(normalizeShopDisplayName("NANDROMIX 300mg")).toBe("NANDROMIX");
  });
});

describe("groupAndSortShopProducts", () => {
  it("groups retatrutide variants and sorts alphabetically", () => {
    const products = [
      shopRow("TZ10", "Tirzepatide"),
      shopRow("RT20", "Retatrutide", { dosage_vial: "20 mg" }),
      shopRow("RT10", "Retatrutide", { dosage_vial: "10 mg" }),
      shopRow("SM10", "Semaglutide"),
    ];

    const groups = groupAndSortShopProducts(products);
    expect(groups.map((group) => group.displayName)).toEqual(["Retatrutide", "Semaglutide", "Tirzepatide"]);
    expect(groups[0]?.variants.map((variant) => variant.code)).toEqual(["RT10", "RT20"]);
  });

  it("sorts case-insensitively with stable slug tie-break", () => {
    const products = LIVE_SHOP_PRODUCTS.slice(0, 40).map((row) => shopRow(row.code, row.name));
    const groups = groupAndSortShopProducts(products);
    const names = groups.map((group) => group.sortKey);
    expect([...names].sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }))).toEqual(names);
  });
});

describe("lexiconHrefForShopProduct", () => {
  it("links known substances to public lexicon profiles", () => {
    expect(lexiconHrefForShopProduct({ code: "RT10", name: "Retatrutide" })).toBe("/peptide/lexikon/retatrutide");
    expect(lexiconHrefForShopProduct({ code: "SM10", name: "Semaglutide" })).toBe("/peptide/lexikon/semaglutide");
    expect(lexiconHrefForShopProduct({ code: "KL80", name: "(KLOW) GHK-CU 50mg+TB500 10mg+BPC157 10mg+TB500 10mg Blend" })).toBe(
      "/peptide/lexikon/klow-blend",
    );
    expect(lexiconHrefForShopProduct({ code: "GHK10", name: "GHK-CU" })).toBe("/peptide/lexikon/ghk-cu");
  });

  it("does not link review-required or water products", () => {
    expect(lexiconHrefForShopProduct({ code: "BW10", name: "BAC Water" })).toBeNull();
  });
});

describe("productMatchesShopSearch", () => {
  it("matches normalized display names", () => {
    expect(productMatchesShopSearch({ code: "RT10", name: "Retatrutide" }, "retatrut")).toBe(true);
    expect(productMatchesShopSearch({ code: "KL80", name: "(KLOW) GHK-CU 50mg+TB500 10mg+BPC157 10mg+TB500 10mg Blend" }, "klow")).toBe(
      true,
    );
  });
});
