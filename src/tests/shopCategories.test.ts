import { describe, expect, it } from "vitest";

import {
  countProductsByShopCategory,
  isReconstitutionWaterProduct,
  isShopCategoryId,
  productInShopCategory,
  shopCategoryIdFor,
  SHOP_CATEGORIES,
} from "@/lib/shopCategories";

describe("shop category mapping", () => {
  it("maps the live catalog into four groups without dropping rows", () => {
    const catalog = [
      ...Array.from({ length: 165 }, (_, i) => ({ category: "PEPTIDES", code: `P-${i}`, name: "Peptide" })),
      ...Array.from({ length: 51 }, (_, i) => ({ category: "INJECTABLES-OILS", code: `O-${i}`, name: "Oil" })),
      ...Array.from({ length: 79 }, (_, i) => ({ category: "ORALS", code: `R-${i}`, name: "Oral" })),
      { category: "INJECTABLES-OILS", code: "AA10", name: "AA Water" },
      { category: "INJECTABLES-OILS", code: "BA03", name: "BAC Water" },
      { category: "INJECTABLES-OILS", code: "BA10", name: "BAC Water" },
    ];
    const counts = countProductsByShopCategory(catalog);
    expect(counts.peptides).toBe(165);
    expect(counts["injectable-oils"]).toBe(51);
    expect(counts.orals).toBe(79);
    expect(counts["reconstitution-water"]).toBe(3);
    expect(Object.values(counts).reduce((sum, n) => sum + n, 0)).toBe(298);
  });

  it("keeps Peptides, Injectable Oils, Orals and Reconstitution Water disjoint", () => {
    const peptide = { category: "PEPTIDES", name: "RET", code: "RET" };
    const oil = { category: "INJECTABLES-OILS", name: "Test Oil", code: "TO" };
    const oral = { category: "ORALS", name: "Tab", code: "TAB" };
    const bac = { category: "INJECTABLES-OILS", name: "BAC Water", code: "BA10" };
    expect(productInShopCategory(peptide, "peptides")).toBe(true);
    expect(productInShopCategory(oil, "injectable-oils")).toBe(true);
    expect(productInShopCategory(oral, "orals")).toBe(true);
    expect(productInShopCategory(bac, "reconstitution-water")).toBe(true);
    expect(productInShopCategory(bac, "injectable-oils")).toBe(false);
    expect(shopCategoryIdFor(peptide)).toBe("peptides");
  });

  it("assigns BAC Water and AA Water to Reconstitution Water even before the DB category update", () => {
    expect(shopCategoryIdFor({ category: "INJECTABLES-OILS", name: "BAC Water", code: "BA03" })).toBe(
      "reconstitution-water",
    );
    expect(shopCategoryIdFor({ category: "INJECTABLES-OILS", name: "AA Water", code: "AA10" })).toBe(
      "reconstitution-water",
    );
    expect(shopCategoryIdFor({ category: "RECONSTITUTION-WATER", name: "BAC Water", code: "BA10" })).toBe(
      "reconstitution-water",
    );
    expect(isReconstitutionWaterProduct({ name: "BAC Water", code: "BA03" })).toBe(true);
    expect(isReconstitutionWaterProduct({ name: "AA Water", code: "AA10" })).toBe(true);
  });

  it("does not treat other water injectables as reconstitution water", () => {
    expect(
      shopCategoryIdFor({
        category: "INJECTABLES-OILS",
        name: "STANOZOLOL (Water) winstrol",
        code: "SW100",
      }),
    ).toBe("injectable-oils");
  });

  it("never places BPC, BPC157, or BPC 157 in reconstitution water", () => {
    const bpcOral = { category: "ORALS", name: "BPC", code: "BC500" };
    const bpc157Oral = { category: "ORALS", name: "BPC157", code: "B157" };
    const bpcPeptide = { category: "PEPTIDES", name: "BPC 157", code: "BC5" };
    const mislabeled = { category: "RECONSTITUTION-WATER", name: "BPC", code: "BC500" };
    for (const product of [bpcOral, bpc157Oral, bpcPeptide, mislabeled]) {
      expect(isReconstitutionWaterProduct(product)).toBe(false);
      expect(shopCategoryIdFor(product)).not.toBe("reconstitution-water");
      expect(productInShopCategory(product, "reconstitution-water")).toBe(false);
    }
    expect(shopCategoryIdFor(bpcOral)).toBe("orals");
    expect(shopCategoryIdFor(bpc157Oral)).toBe("orals");
    expect(shopCategoryIdFor(bpcPeptide)).toBe("peptides");
    expect(shopCategoryIdFor(mislabeled)).toBe("peptides");
  });

  it("never hides an unmapped product from the storefront", () => {
    expect(shopCategoryIdFor({ category: null, name: "Unknown", code: "X" })).toBe("peptides");
    expect(SHOP_CATEGORIES).toHaveLength(4);
    expect(SHOP_CATEGORIES.map((c) => c.id)).toEqual([
      "peptides",
      "injectable-oils",
      "orals",
      "reconstitution-water",
    ]);
    expect(isShopCategoryId("peptides")).toBe(true);
    expect(isShopCategoryId("reconstitution-water")).toBe(true);
    expect(isShopCategoryId("all")).toBe(false);
  });
});
