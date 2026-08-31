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

  it("groups oral name families without merging distinct SKUs", () => {
    const products = [
      shopRow("CT10", "Turinabol", { category: "ORALS", dosage_vial: "10mg x 100tablets", id: "ct10" }),
      shopRow("CT25", "Turinabol", { category: "ORALS", dosage_vial: "25mg x 100tablets", id: "ct25" }),
      shopRow("AMQ50", "5-amino-1mq", { category: "ORALS", dosage_vial: "50mg x 25tablets", id: "amq" }),
    ];
    const groups = groupAndSortShopProducts(products);
    const turinabol = groups.find((group) => group.displayName === "Turinabol");
    const amino = groups.find((group) => group.displayName === "5-amino-1mq");
    expect(turinabol?.variants.map((variant) => variant.id)).toEqual(["ct10", "ct25"]);
    expect(amino?.variants).toHaveLength(1);
  });

  it("does not merge oral BPC and BPC157 because they are distinct catalog names", () => {
    const groups = groupAndSortShopProducts([
      shopRow("BC500", "BPC", { category: "ORALS", dosage_vial: "500mcg x 60pcs", id: "bc500" }),
      shopRow("B157", "BPC157", { category: "ORALS", dosage_vial: "500mcg x 100tablets", id: "b157" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((group) => group.displayName === "BPC")?.variants.map((variant) => variant.id)).toEqual(["bc500"]);
    expect(groups.find((group) => group.displayName === "BPC157")?.variants.map((variant) => variant.id)).toEqual(["b157"]);
  });

  it("still groups peptide BPC 157 vial strengths by family", () => {
    const groups = groupAndSortShopProducts([
      shopRow("BC5", "BPC 157", { category: "PEPTIDES", dosage_vial: "5mg/vial x 10vials" }),
      shopRow("BC10", "BPC 157", { category: "PEPTIDES", dosage_vial: "10mg/vial x 10vials" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.variants.map((variant) => variant.code).sort()).toEqual(["BC10", "BC5"]);
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
