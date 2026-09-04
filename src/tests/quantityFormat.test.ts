import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { splitKitProgress } from "@/lib/kitOrderSummary";
import {
  formatCatalogQuantity,
  formatCompleteKitCount,
  formatKitSizeLabel,
  formatKitSplitQuantity,
  formatOrderItemQuantity,
  formatPartialKitQuantity,
  formatProductQuantity,
  formatUnitWord,
  productQuantityKindFor,
  resolveProductCategoryId,
} from "@/lib/quantityFormat";

describe("quantityFormat", () => {
  it("uses Kit/Kits for peptides and reconstitution water", () => {
    expect(productQuantityKindFor("peptides")).toBe("kit");
    expect(productQuantityKindFor("reconstitution-water")).toBe("kit");
    expect(formatCatalogQuantity(0, "peptides")).toBe("0 Kit");
    expect(formatCatalogQuantity(1, "peptides")).toBe("1 Kit");
    expect(formatCatalogQuantity(2, "peptides")).toBe("2 Kits");
    expect(formatCatalogQuantity(1, "reconstitution-water")).toBe("1 Kit");
    expect(formatCatalogQuantity(2, "reconstitution-water")).toBe("2 Kits");
  });

  it("uses Vial/Vials for injectable oils and never Kit", () => {
    expect(productQuantityKindFor("injectable-oils")).toBe("vial");
    expect(formatCatalogQuantity(1, "injectable-oils")).toBe("1 Vial");
    expect(formatCatalogQuantity(2, "injectable-oils")).toBe("2 Vials");
    expect(formatCatalogQuantity(5, "injectable-oils")).toBe("5 Vials");
    expect(formatProductQuantity({ quantity: 5, categoryId: "injectable-oils" })).not.toContain("Kit");
    expect(formatProductQuantity({ quantity: 5, categoryId: "injectable-oils" })).not.toContain("/");
  });

  it("uses Packung/Packungen for orals and never Kit or Vial", () => {
    expect(productQuantityKindFor("orals")).toBe("packung");
    expect(formatCatalogQuantity(1, "orals")).toBe("1 Packung");
    expect(formatCatalogQuantity(2, "orals")).toBe("2 Packungen");
    expect(formatCatalogQuantity(5, "orals")).toBe("5 Packungen");
    expect(formatCatalogQuantity(5, "orals")).not.toMatch(/Kit|Vial/);
  });

  it("pluralizes with the < 2 singular rule", () => {
    expect(formatUnitWord("kit", 0)).toBe("Kit");
    expect(formatUnitWord("kit", 1.9)).toBe("Kit");
    expect(formatUnitWord("kit", 2)).toBe("Kits");
    expect(formatUnitWord("vial", 1)).toBe("Vial");
    expect(formatUnitWord("vial", 2)).toBe("Vials");
    expect(formatUnitWord("packung", 1)).toBe("Packung");
    expect(formatUnitWord("packung", 2)).toBe("Packungen");
  });

  it("formats peptide kit shares from kit_size_vials math", () => {
    expect(formatPartialKitQuantity(5, 10, "peptides")).toBe("5/10 Kit");
    expect(formatPartialKitQuantity(7, 10, "peptides")).toBe("7/10 Kit");
    expect(formatCompleteKitCount(1, "peptides")).toBe("1 Kit");
    expect(formatCompleteKitCount(2, "peptides")).toBe("2 Kits");
    expect(formatProductQuantity({ quantity: 10, categoryId: "peptides", kitSize: 10 })).toBe("1 Kit");
    expect(formatProductQuantity({ quantity: 20, categoryId: "peptides", kitSize: 10 })).toBe("2 Kits");
    expect(formatProductQuantity({ quantity: 25, categoryId: "peptides", kitSize: 10 })).toBe("2 Kits + 5/10 Kit");
  });

  it("does not turn 15 vials of size 10 into 15 Kits", () => {
    const split = splitKitProgress(15, 10);
    expect(split).toEqual({ completeKits: 1, remainderVials: 5 });
    expect(formatKitSplitQuantity(split.completeKits, split.remainderVials, 10, "peptides")).toBe("1 Kit + 5/10 Kit");
  });

  it("keeps oils on Vials even with a real kit identity", () => {
    expect(formatProductQuantity({ quantity: 5, categoryId: "injectable-oils", kitSize: 10 })).toBe("5/10 Vial");
    expect(formatCompleteKitCount(1, "injectable-oils", 10)).toBe("10 Vials");
    expect(formatProductQuantity({ quantity: 5, name: "TEST ENANTHATE", code: "TE300" })).toBe("5 Vials");
  });

  it("formats order lines from snapshots without inventing a kit", () => {
    expect(
      formatOrderItemQuantity({
        quantity: 5,
        product_name_snapshot: "TEST ENANTHATE",
        product_code_snapshot: "TE300",
      }),
    ).toBe("5 Vials");
    expect(
      formatOrderItemQuantity(
        { quantity: 5, product_name_snapshot: "Selank", product_code_snapshot: "SK10" },
        10,
      ),
    ).toBe("5/10 Kit");
  });

  it("classifies catalog oils and orals from the product name when no category snapshot exists", () => {
    expect(resolveProductCategoryId({ name: "TEST ENANTHATE", code: "TE300" })).toBe("injectable-oils");
    expect(resolveProductCategoryId({ name: "ANADROL", code: "OXO50" })).toBe("orals");
    expect(resolveProductCategoryId({ name: "Selank", code: "SK10" })).toBe("peptides");
    expect(formatProductQuantity({ quantity: 5, name: "TEST ENANTHATE", code: "TE300" })).toBe("5 Vials");
    expect(formatProductQuantity({ quantity: 5, name: "ANADROL", code: "OXO50" })).toBe("5 Packungen");
  });

  it("formats kit size captions", () => {
    expect(formatKitSizeLabel(10, "peptides")).toBe("10er Kit");
    expect(formatKitSizeLabel(10, "injectable-oils")).toBe("10 Vials");
    expect(formatKitSizeLabel(10, "orals")).toBe("10 Packungen");
  });

  it("is the single quantity formatter used by shop, cart, orders, admin, and PDF", () => {
    const files = [
      "src/lib/orderSummary.ts",
      "src/lib/orderExport.ts",
      "src/lib/kitOrderSummary.ts",
      "src/lib/shop/kitUnits.ts",
      "src/lib/shop/cartDisplay.ts",
      "src/pages/OrderDetail.tsx",
      "src/pages/admin/AdminOrderDetail.tsx",
      "src/pages/Checkout.tsx",
      "src/components/shop/ShopProductsTable.tsx",
      "src/components/cart/CartItemsTable.tsx",
    ].map((path) => readFileSync(resolve(process.cwd(), path), "utf8"));
    const joined = files.join("\n");
    expect(joined).toContain("formatCatalogQuantity");
    expect(joined).toContain("formatOrderItemQuantity");
    expect(joined).toContain("formatProductQuantity");
    expect(joined).toContain("cartItemQuantityLabel");
    expect(joined).not.toContain("Kit/s");
    expect(readFileSync(resolve(process.cwd(), "src/lib/orderExport.ts"), "utf8")).toContain(
      "formatOrderItemQuantity",
    );
    expect(readFileSync(resolve(process.cwd(), "src/lib/orderExport.ts"), "utf8")).not.toMatch(
      /function format.*Quantity/,
    );
  });
});
