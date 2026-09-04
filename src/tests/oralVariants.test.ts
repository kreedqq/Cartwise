import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { groupAndSortShopProducts } from "@/lib/shop/display";
import { cartItemVariantSubtitle } from "@/lib/shop/cartDisplay";
import { formatProductVariant, shopProductTitle } from "@/lib/shop/variantCoverage";
import type { Tables } from "@/types/database";

function shopRow(
  id: string,
  code: string,
  name: string,
  dosage_vial: string,
  price_usd = 20,
): Tables<"products"> {
  return {
    id,
    code,
    name,
    description: null,
    dosage_vial,
    category: "ORALS",
    price_usd,
    bulk_price_usd: price_usd - 2,
    bulk_price_min_quantity: 10,
    currency: "USD",
    is_active: true,
    last_price_change_at: null,
    created_at: "",
    updated_at: "",
  };
}

describe("oral variant formatting", () => {
  it("formats a single-variant oral with tablets", () => {
    const product = shopRow("amq", "AMQ50", "5-amino-1mq", "50mg x 25tablets", 35);
    expect(formatProductVariant(product)).toBe("50 mg × 25 Tabletten");
    expect(shopProductTitle("5-amino-1mq", product, false)).toBe("5-amino-1mq");
  });

  it("groups Turinabol strengths into one family with distinct product ids", () => {
    const groups = groupAndSortShopProducts([
      shopRow("ct10", "CT10", "Turinabol", "10mg x 100tablets", 25),
      shopRow("ct50", "CT50", "Turinabol", "50mg x 100tablets", 53),
      shopRow("ct25", "CT25", "Turinabol", "25mg x 100tablets", 35),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.variants.map((variant) => variant.id)).toEqual(["ct10", "ct25", "ct50"]);
    expect(groups[0]?.variants.map((variant) => formatProductVariant(variant))).toEqual([
      "10 mg × 100 Tabletten",
      "25 mg × 100 Tabletten",
      "50 mg × 100 Tabletten",
    ]);
  });

  it("keeps all seven SLU-PP-332 variants and their prices", () => {
    const slu = [
      shopRow("slu250", "SLU250", "SLU-PP-332", "250mcg x 100tablets", 20),
      shopRow("slu500", "SLU500", "SLU-PP-332", "500mcg x 100tablets", 25),
      shopRow("slu1", "SLU1000", "SLU-PP-332", "1mg x 100tablets", 30),
      shopRow("slu5", "SLU5", "SLU-PP-332", "5mg x 100tablets", 40),
      shopRow("slu20", "SLU20", "SLU-PP-332", "20mg x 100tablets", 70),
      shopRow("slu50", "SL50", "SLU-PP-332", "50mg x 100tablets", 110),
      shopRow("slu100", "SL100", "SLU-PP-332", "100mg x 60tablets", 150),
    ];
    const group = groupAndSortShopProducts(slu)[0];
    expect(group?.variants).toHaveLength(7);
    expect(group?.variants.map((variant) => formatProductVariant(variant))).toEqual([
      "250 mcg × 100 Tabletten",
      "500 mcg × 100 Tabletten",
      "1 mg × 100 Tabletten",
      "5 mg × 100 Tabletten",
      "20 mg × 100 Tabletten",
      "50 mg × 100 Tabletten",
      "100 mg × 60 Tabletten",
    ]);
    expect(group?.variants.map((variant) => variant.price_usd)).toEqual([20, 25, 30, 40, 70, 110, 150]);
    expect(group?.variants.map((variant) => variant.code)).toEqual([
      "SLU250",
      "SLU500",
      "SLU1000",
      "SLU5",
      "SLU20",
      "SL50",
      "SL100",
    ]);
  });

  it("formats both B12 bottle variants without merging prices", () => {
    const groups = groupAndSortShopProducts([
      shopRow("b1", "B1201", "B12", "10ml x 1mg/ml", 0),
      shopRow("b10", "B1210", "B12", "10ml x 10mg/ml", 0),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.variants.map((variant) => formatProductVariant(variant))).toEqual([
      "10 ml × 1 mg/ml × 1 Flasche",
      "10 ml × 10 mg/ml × 1 Flasche",
    ]);
    expect(groups[0]?.variants[0]?.id).toBe("b1");
    expect(groups[0]?.variants[1]?.id).toBe("b10");
  });

  it("formats Orforglipron Stück packs", () => {
    const groups = groupAndSortShopProducts([
      shopRow("o12", "ORF12", "Orforglipron", "12mg x 100pcs", 190),
      shopRow("o6", "ORF6", "Orforglipron", "6mg x 100pcs", 110),
    ]);
    expect(groups[0]?.variants.map((variant) => formatProductVariant(variant))).toEqual([
      "6 mg × 100 Stück",
      "12 mg × 100 Stück",
    ]);
  });

  it("preserves pack unit vocabulary from source data", () => {
    expect(formatProductVariant(shopRow("bam", "BAM50", "BAM15", "50mg x 60capsule"))).toBe(
      "50 mg × 60 Kapseln",
    );
    expect(formatProductVariant(shopRow("dha", "DHA20", "Dihexa", "20mg x 25pcs"))).toBe("20 mg × 25 Stück");
    expect(formatProductVariant(shopRow("hhb", "HHB", "HHB", "blend"))).toBe("Blend");
  });

  it("does not merge oral BPC with BPC157", () => {
    const groups = groupAndSortShopProducts([
      shopRow("bc500", "BC500", "BPC", "500mcg x 60pcs", 35),
      shopRow("b157", "B157", "BPC157", "500mcg x 100tablets", 48),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.displayName).sort()).toEqual(["BPC", "BPC157"]);
    expect(formatProductVariant(groups.find((group) => group.displayName === "BPC")!.variants[0]!)).toBe(
      "500 mcg × 60 Stück",
    );
    expect(formatProductVariant(groups.find((group) => group.displayName === "BPC157")!.variants[0]!)).toBe(
      "500 mcg × 100 Tabletten",
    );
  });

  it("does not invent a pack size when the stored value has none", () => {
    expect(formatProductVariant({ code: "ZZ1", name: "Unknown oral", dosage_vial: "10 mg" })).toBe("10 mg");
  });
});

describe("oral variant in cart and kit share display", () => {
  it("keeps the selected oral pack on a cart line via SKU coverage", () => {
    expect(
      cartItemVariantSubtitle({
        product_name_snapshot: "SLU-PP-332",
        product_code_snapshot: "SLU5",
        quantity: 1,
        kit_share_id: null,
      }),
    ).toBe("5 mg × 100 Tabletten");
  });

  it("keeps the exact oral variant on a kit-share cart line", () => {
    const subtitle = cartItemVariantSubtitle({
      product_name_snapshot: "SLU-PP-332",
      product_code_snapshot: "SLU5",
      quantity: 6,
      kit_share_id: "kit-1",
      note: "Kit Anteil · 5 mg · 6 Stück · Gemeinsames 10-Einheiten-Kit",
      dosage_vial_snapshot: "5mg x 100tablets",
    });
    expect(subtitle).toContain("5 mg × 100 Tabletten");
    expect(subtitle).toContain("6/10 Packung");
    expect(subtitle).toContain("Kit Anteil");
  });

  it("does not treat a zero catalog price as a mapping failure for B12", () => {
    const product = shopRow("b1", "B1201", "B12", "10ml x 1mg/ml", 0);
    expect(product.price_usd).toBe(0);
    expect(formatProductVariant(product)).toBe("10 ml × 1 mg/ml × 1 Flasche");
  });

  it("does not invent an SLU 10 mg pack", () => {
    const labels = [
      "250mcg x 100tablets",
      "500mcg x 100tablets",
      "1mg x 100tablets",
      "5mg x 100tablets",
      "20mg x 100tablets",
      "50mg x 100tablets",
      "100mg x 60tablets",
    ].map((dosage_vial, index) =>
      formatProductVariant({ code: `SLU${index}`, name: "SLU-PP-332", dosage_vial }),
    );
    expect(labels).not.toContain("10 mg × 100 Tabletten");
    expect(labels).toHaveLength(7);
  });
});

describe("shop unit price mapping", () => {
  it("renders catalog unit price, not bulk, as the shop unit price", () => {
    const desktop = readFileSync(resolve(process.cwd(), "src/components/shop/ShopProductsTable.tsx"), "utf8");
    const mobile = readFileSync(resolve(process.cwd(), "src/components/shop/ShopProductsMobileList.tsx"), "utf8");
    expect(desktop).toContain("formatUsd(product.price_usd)");
    expect(desktop).toContain("formatUsd(product.bulk_price_usd)");
    expect(mobile).toContain("formatUsd(product.price_usd)");
    expect(mobile).toContain("formatUsd(product.bulk_price_usd)");
    expect(desktop.indexOf("formatUsd(product.price_usd)")).toBeLessThan(desktop.indexOf("formatUsd(product.bulk_price_usd)"));
  });
});
