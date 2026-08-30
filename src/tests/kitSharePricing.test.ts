import { describe, expect, it } from "vitest";

import { applyRoleMarkup } from "@/lib/money";
import {
  catalogPackSize,
  kitShareBulkApplies,
  kitShareCartLineUsd,
  kitShareCatalogUnitUsd,
  kitShareKitCatalogTotalUsd,
  kitShareParticipantBaseUsd,
  kitShareParticipantPriceUsd,
  kitShareSellingUnitUsd,
  productUsesKitUnitPricing,
} from "@/lib/shop/kitSharePricing";

const MARKUP = 25;

/** Generic peptide row: price_usd = catalog price for one 10-vial kit. */
const KIT_PRICE_100 = {
  category: "PEPTIDES",
  price_usd: 100,
};

/** Production catalog rows for 5-amino-1mq injectable variants (verified audit). */
const AMINO_5MG = {
  code: "5AM",
  name: "5-amino-1mq",
  category: "PEPTIDES",
  price_usd: 38,
  bulk_price_usd: 35,
  bulk_price_min_quantity: 10,
};

const AMINO_10MG = {
  code: "10AM",
  name: "5-amino-1mq",
  category: "PEPTIDES",
  price_usd: 55,
  bulk_price_usd: 50,
  bulk_price_min_quantity: 10,
};

const AMINO_50MG = {
  code: "50AM",
  name: "5-amino-1mq",
  category: "PEPTIDES",
  price_usd: 75,
  bulk_price_usd: 70,
  bulk_price_min_quantity: 10,
};

const ORAL_AMQ50 = {
  code: "AMQ50",
  name: "5-amino-1mq (oral)",
  category: "ORALS",
  price_usd: 35,
  bulk_price_usd: 33,
  bulk_price_min_quantity: 10,
};

describe("official regression tests TEST 1–8", () => {
  const product = KIT_PRICE_100;
  const kitSize = 10;
  const allocated = 10;
  const markup = 25;

  it("TEST 1: kit_price=100, kit_size=10, qty=6 → 60", () => {
    expect(kitShareParticipantBaseUsd(product, kitSize, allocated, 6)).toBe(60);
    expect(kitShareParticipantBaseUsd(product, kitSize, allocated, 6)).not.toBe(600);
    expect(kitShareParticipantBaseUsd(product, kitSize, allocated, 6)).not.toBe(6000);
  });

  it("TEST 2: kit_price=100, kit_size=10, qty=4 → 40", () => {
    expect(kitShareParticipantBaseUsd(product, kitSize, allocated, 4)).toBe(40);
  });

  it("TEST 3: 6 + 4 → 100 catalog total", () => {
    const a = kitShareParticipantBaseUsd(product, kitSize, allocated, 6);
    const b = kitShareParticipantBaseUsd(product, kitSize, allocated, 4);
    expect(a + b).toBe(100);
  });

  it("TEST 4: markup 25% → 75 and 50", () => {
    expect(kitShareParticipantPriceUsd(product, kitSize, allocated, 6, markup)).toBe(75);
    expect(kitShareParticipantPriceUsd(product, kitSize, allocated, 4, markup)).toBe(50);
  });

  it("TEST 5: bulk 350/10 vials → 210 + 140", () => {
    const bulkProduct = {
      category: "PEPTIDES",
      price_usd: 380,
      bulk_price_usd: 350,
      bulk_price_min_quantity: 1,
    };
    expect(kitShareParticipantBaseUsd(bulkProduct, kitSize, allocated, 6)).toBe(210);
    expect(kitShareParticipantBaseUsd(bulkProduct, kitSize, allocated, 4)).toBe(140);
  });

  it("TEST 6: 20er kit, kit_total=200, qty=6 → 60", () => {
    expect(kitShareKitCatalogTotalUsd(product, 20, 20)).toBe(200);
    expect(kitShareParticipantBaseUsd(product, 20, 20, 6)).toBe(60);
  });

  it("TEST 7: 30er kit, kit_total=300, qty=10 → 100", () => {
    expect(kitShareKitCatalogTotalUsd(product, 30, 30)).toBe(300);
    expect(kitShareParticipantBaseUsd(product, 30, 30, 10)).toBe(100);
  });

  it("TEST 8: cart quantity = participant_quantity, unit = per-vial price", () => {
    const line = kitShareCartLineUsd(product, kitSize, allocated, 6, markup);
    expect(line.quantity).toBe(6);
    expect(line.quantity).not.toBe(kitSize);
    expect(line.catalogUnitPrice).toBe(10);
    expect(line.unitPriceUsd).toBe(12.5);
    expect(line.lineTotalUsd).toBe(75);
    expect(line.participantFinalPriceUsd).toBe(75);
    expect(line.quantity * line.unitPriceUsd).toBe(75);
  });
});

describe("peptide catalog kit scaling (price_usd per 10 vials)", () => {
  const peptide50 = { category: "PEPTIDES", price_usd: 50 };

  it("10/20/30 vial kits share 5 USD/vial", () => {
    expect(kitShareCatalogUnitUsd(peptide50, 10, 10)).toBe(5);
    expect(kitShareCatalogUnitUsd(peptide50, 20, 20)).toBe(5);
    expect(kitShareCatalogUnitUsd(peptide50, 30, 30)).toBe(5);
    expect(kitShareKitCatalogTotalUsd(peptide50, 10, 10)).toBe(50);
    expect(kitShareKitCatalogTotalUsd(peptide50, 20, 20)).toBe(100);
    expect(kitShareKitCatalogTotalUsd(peptide50, 30, 30)).toBe(150);
  });

  it("6 vials of 10er kit at 50 USD → 30 USD before markup", () => {
    expect(kitShareParticipantBaseUsd(peptide50, 10, 10, 6)).toBe(30);
  });
});

describe("5-amino-1mq production values must not regress", () => {
  it("5AM must not produce 43.75 unit or 437.50 line for qty 10", () => {
    const line = kitShareCartLineUsd(AMINO_5MG, 10, 10, 10, MARKUP);
    expect(line.unitPriceUsd).not.toBeCloseTo(43.75, 2);
    expect(line.lineTotalUsd).not.toBeCloseTo(437.5, 2);
    expect(line.lineTotalUsd).toBe(47.5);
  });

  it("10AM must not produce 62.50 unit for qty 5 in full 10 kit", () => {
    const line = kitShareCartLineUsd(AMINO_10MG, 10, 10, 5, MARKUP);
    expect(line.unitPriceUsd).not.toBeCloseTo(62.5, 2);
    expect(line.lineTotalUsd).toBe(34.38);
  });

  it("variants stay isolated by product row", () => {
    expect(kitShareCatalogUnitUsd(AMINO_5MG, 10, 10)).toBe(3.8);
    expect(kitShareCatalogUnitUsd(AMINO_10MG, 10, 10)).toBe(5.5);
    expect(kitShareCatalogUnitUsd(AMINO_50MG, 10, 10)).toBe(7.5);
  });
});

describe("distribution change 6→7 and 4→3 recalculates cart lines", () => {
  const product = KIT_PRICE_100;
  const kitSize = 10;

  it("updates quantities and prices after rebalance", () => {
    const beforeA = kitShareCartLineUsd(product, kitSize, kitSize, 6, MARKUP);
    const beforeB = kitShareCartLineUsd(product, kitSize, kitSize, 4, MARKUP);
    const afterA = kitShareCartLineUsd(product, kitSize, kitSize, 7, MARKUP);
    const afterB = kitShareCartLineUsd(product, kitSize, kitSize, 3, MARKUP);

    expect(beforeA.quantity).toBe(6);
    expect(beforeB.quantity).toBe(4);
    expect(afterA.quantity).toBe(7);
    expect(afterB.quantity).toBe(3);
    expect(afterA.quantity + afterB.quantity).toBe(kitSize);
    expect(afterA.participantFinalPriceUsd).toBe(87.5);
    expect(afterB.participantFinalPriceUsd).toBe(37.5);
  });
});

describe("10-unit kit splits", () => {
  const kitSize = 10;
  const allocated = 10;

  it.each([
    [6, 4],
    [7, 3],
    [3, 7],
  ] as const)("split %i + %i sums to kit total", (aQty, bQty) => {
    const a = kitShareParticipantBaseUsd(KIT_PRICE_100, kitSize, allocated, aQty);
    const b = kitShareParticipantBaseUsd(KIT_PRICE_100, kitSize, allocated, bQty);
    expect(a + b).toBe(100);
  });

  it("2 + 3 + 5 across three participants sums to 100", () => {
    const total =
      kitShareParticipantBaseUsd(KIT_PRICE_100, kitSize, allocated, 2) +
      kitShareParticipantBaseUsd(KIT_PRICE_100, kitSize, allocated, 3) +
      kitShareParticipantBaseUsd(KIT_PRICE_100, kitSize, allocated, 5);
    expect(total).toBe(100);
  });
});

describe("20-unit kit splits", () => {
  const kitSize = 20;
  const allocated = 20;
  const product = KIT_PRICE_100;

  it("6 + 14 = 200 catalog total", () => {
    const a = kitShareParticipantBaseUsd(product, kitSize, allocated, 6);
    const b = kitShareParticipantBaseUsd(product, kitSize, allocated, 14);
    expect(a).toBe(60);
    expect(b).toBe(140);
    expect(a + b).toBe(200);
  });

  it("10 + 10 = 200", () => {
    const a = kitShareParticipantBaseUsd(product, kitSize, allocated, 10);
    const b = kitShareParticipantBaseUsd(product, kitSize, allocated, 10);
    expect(a + b).toBe(200);
  });

  it("7 + 13 = 200", () => {
    const a = kitShareParticipantBaseUsd(product, kitSize, allocated, 7);
    const b = kitShareParticipantBaseUsd(product, kitSize, allocated, 13);
    expect(a + b).toBe(200);
  });
});

describe("30-unit kit splits", () => {
  const kitSize = 30;
  const allocated = 30;
  const product = KIT_PRICE_100;

  it("10 + 20 = 300", () => {
    expect(kitShareParticipantBaseUsd(product, kitSize, allocated, 10)).toBe(100);
    expect(kitShareParticipantBaseUsd(product, kitSize, allocated, 20)).toBe(200);
  });

  it("15 + 15 = 300", () => {
    const a = kitShareParticipantBaseUsd(product, kitSize, allocated, 15);
    const b = kitShareParticipantBaseUsd(product, kitSize, allocated, 15);
    expect(a + b).toBe(300);
  });

  it("20 + 10 = 300", () => {
    const a = kitShareParticipantBaseUsd(product, kitSize, allocated, 20);
    const b = kitShareParticipantBaseUsd(product, kitSize, allocated, 10);
    expect(a + b).toBe(300);
  });
});

describe("kit share product pricing model", () => {
  it("classifies peptide variants as kit-priced (10 vials per price row)", () => {
    expect(productUsesKitUnitPricing(AMINO_5MG)).toBe(true);
    expect(catalogPackSize(AMINO_5MG)).toBe(10);
    expect(productUsesKitUnitPricing(ORAL_AMQ50)).toBe(false);
    expect(catalogPackSize(ORAL_AMQ50)).toBe(1);
  });

  it("does not apply peptide bulk tier for a 10-vial shared kit (1 catalog kit)", () => {
    expect(kitShareBulkApplies(AMINO_5MG, 10)).toBe(false);
    expect(kitShareBulkApplies(AMINO_10MG, 10)).toBe(false);
    expect(kitShareBulkApplies(AMINO_50MG, 3)).toBe(false);
  });

  it("applies peptide bulk tier only when shared allocation reaches bulk_min catalog kits", () => {
    expect(kitShareBulkApplies(AMINO_5MG, 100)).toBe(true);
    expect(kitShareBulkApplies(AMINO_5MG, 90)).toBe(false);
  });

  it("applies oral bulk tier when shared allocation reaches 10 pieces", () => {
    expect(kitShareBulkApplies(ORAL_AMQ50, 10)).toBe(true);
    expect(kitShareBulkApplies(ORAL_AMQ50, 9)).toBe(false);
  });
});

describe("5-amino-1mq variant catalog unit prices", () => {
  it("5 mg: per-vial catalog unit is price_usd / 10, not full kit bulk price", () => {
    expect(kitShareCatalogUnitUsd(AMINO_5MG, 10, 10)).toBe(3.8);
    expect(kitShareCatalogUnitUsd(AMINO_5MG, 10, 3)).toBe(3.8);
  });

  it("10 mg: per-vial catalog unit stays variant-specific", () => {
    expect(kitShareCatalogUnitUsd(AMINO_10MG, 10, 10)).toBe(5.5);
    expect(kitShareCatalogUnitUsd(AMINO_10MG, 10, 5)).toBe(5.5);
  });

  it("50 mg: per-vial catalog unit stays variant-specific", () => {
    expect(kitShareCatalogUnitUsd(AMINO_50MG, 10, 10)).toBe(7.5);
    expect(kitShareCatalogUnitUsd(AMINO_50MG, 10, 3)).toBe(7.5);
  });

  it("variants never cross-use each other's prices", () => {
    const unit5 = kitShareCatalogUnitUsd(AMINO_5MG, 10, 10);
    const unit10 = kitShareCatalogUnitUsd(AMINO_10MG, 10, 10);
    const unit50 = kitShareCatalogUnitUsd(AMINO_50MG, 10, 10);
    expect(unit5).not.toBe(unit10);
    expect(unit10).not.toBe(unit50);
    expect(unit5).not.toBe(unit50);
  });
});

describe("5-amino-1mq shared 10-vial kit — production bug regression", () => {
  it("5 mg qty 10 must not use bulk kit price 35 as per-vial unit", () => {
    const unit = kitShareSellingUnitUsd(AMINO_5MG, 10, 10, MARKUP);
    expect(unit).toBeCloseTo(4.75, 4);
    expect(unit).not.toBeCloseTo(43.75, 2);
    expect(kitShareParticipantPriceUsd(AMINO_5MG, 10, 10, 10, MARKUP)).toBe(47.5);
  });

  it("10 mg qty 5 must not use bulk kit price 50 as per-vial unit", () => {
    const unit = kitShareSellingUnitUsd(AMINO_10MG, 10, 10, MARKUP);
    expect(unit).toBeCloseTo(6.875, 4);
    expect(unit).not.toBeCloseTo(62.5, 2);
    expect(kitShareParticipantPriceUsd(AMINO_10MG, 10, 10, 5, MARKUP)).toBe(34.38);
  });

  it("50 mg qty 3 keeps correct per-vial rate (was already correct in production)", () => {
    const unit = kitShareSellingUnitUsd(AMINO_50MG, 10, 3, MARKUP);
    expect(unit).toBeCloseTo(9.375, 4);
    expect(kitShareParticipantPriceUsd(AMINO_50MG, 10, 3, 3, MARKUP)).toBe(28.13);
  });

  it("3 + 7 split on 10-vial 5 mg kit sums to full kit catalog with markup", () => {
    const kitSize = 10;
    const allocated = 10;
    const a = kitShareParticipantPriceUsd(AMINO_5MG, kitSize, allocated, 3, MARKUP);
    const b = kitShareParticipantPriceUsd(AMINO_5MG, kitSize, allocated, 7, MARKUP);
    expect(a).toBe(14.25);
    expect(b).toBe(33.25);
    expect(a + b).toBeCloseTo(applyRoleMarkup(38, MARKUP), 2);
  });

  it("all participants share the same catalog unit before markup", () => {
    const kitSize = 10;
    const allocated = 10;
    const unit = kitShareCatalogUnitUsd(AMINO_5MG, kitSize, allocated);
    expect(kitShareParticipantBaseUsd(AMINO_5MG, kitSize, allocated, 3)).toBeCloseTo(unit * 3, 4);
    expect(kitShareParticipantBaseUsd(AMINO_5MG, kitSize, allocated, 7)).toBeCloseTo(unit * 7, 4);
  });
});

describe("multi-size shared kits", () => {
  it("20-vial peptide kit uses price_usd/10 per vial (not price_usd/20)", () => {
    expect(kitShareCatalogUnitUsd(AMINO_5MG, 20, 20)).toBe(3.8);
    expect(kitShareKitCatalogTotalUsd(AMINO_5MG, 20, 20)).toBe(76);
  });

  it("30-vial peptide kit totals three catalog kits worth", () => {
    expect(kitShareKitCatalogTotalUsd(AMINO_5MG, 30, 30)).toBe(114);
  });

  it("100-vial peptide kit applies bulk per-vial rate", () => {
    expect(kitShareCatalogUnitUsd(AMINO_5MG, 100, 100)).toBe(3.5);
    expect(kitShareKitCatalogTotalUsd(AMINO_5MG, 100, 100)).toBe(350);
  });

  it("10 + 10 = 20 vial allocation on size-20 kit", () => {
    const kitSize = 20;
    const allocated = 20;
    const a = kitShareParticipantBaseUsd(AMINO_5MG, kitSize, allocated, 10);
    const b = kitShareParticipantBaseUsd(AMINO_5MG, kitSize, allocated, 10);
    expect(a + b).toBe(76);
  });

  it("7 + 13 = 20 vial allocation on size-20 kit", () => {
    const kitSize = 20;
    const allocated = 20;
    const a = kitShareParticipantBaseUsd(AMINO_5MG, kitSize, allocated, 7);
    const b = kitShareParticipantBaseUsd(AMINO_5MG, kitSize, allocated, 13);
    expect(a + b).toBe(76);
  });
});

describe("bulk pricing proportional split", () => {
  it("bulk kit price 350 for 10-vial catalog splits 6 + 4 correctly", () => {
    const product = {
      category: "PEPTIDES",
      price_usd: 380,
      bulk_price_usd: 350,
      bulk_price_min_quantity: 1,
    };
    const kitSize = 10;
    const allocated = 10;
    const a = kitShareParticipantBaseUsd(product, kitSize, allocated, 6);
    const b = kitShareParticipantBaseUsd(product, kitSize, allocated, 4);
    expect(a).toBe(210);
    expect(b).toBe(140);
    expect(a + b).toBe(350);
    expect(a).not.toBe(6 * 350);
  });
});

describe("oral kit share bulk at 10 pieces", () => {
  it("uses per-piece bulk price when shared kit has 10 tablets", () => {
    expect(kitShareCatalogUnitUsd(ORAL_AMQ50, 10, 10)).toBe(33);
    expect(kitShareParticipantBaseUsd(ORAL_AMQ50, 10, 10, 4)).toBe(132);
    expect(kitShareParticipantBaseUsd(ORAL_AMQ50, 10, 10, 6)).toBe(198);
  });

  it("oral 10-piece kit at 35 USD splits 6 + 4", () => {
    const product = { category: "ORALS", price_usd: 35 };
    const a = kitShareParticipantBaseUsd(product, 10, 10, 6);
    const b = kitShareParticipantBaseUsd(product, 10, 10, 4);
    expect(a).toBe(210);
    expect(b).toBe(140);
    expect(a).not.toBe(2100);
  });
});
