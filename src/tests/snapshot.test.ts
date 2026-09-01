import { describe, expect, it } from "vitest";

import {
  buildPriceUpdateDiff,
  buildSnapshot,
  repriceForQuantity,
  snapshotToColumns,
  CLEARED_PRICE_COLUMNS,
} from "@/lib/snapshot";

/** The worked example from the spec: 1-9 x 60 USD, from 10 on 55 USD. */
const TIERED_PRODUCT = {
  code: "ART-5001",
  name: "Beispielpräparat A",
  price_usd: 60,
  bulk_price_usd: 55,
  bulk_price_min_quantity: 10,
};

const FLAT_PRODUCT = {
  code: "ART-5002",
  name: "Beispielpräparat B",
  price_usd: 60,
  bulk_price_usd: null,
  bulk_price_min_quantity: null,
};

describe("buildSnapshot", () => {
  it("captures product data, price, rate, and computed EUR total at the current moment", () => {
    const snapshot = buildSnapshot({ code: "art-1001", name: "Bürostuhl", price_usd: 100 }, 2, 0.9);
    expect(snapshot.productCodeSnapshot).toBe("art-1001");
    expect(snapshot.unitPriceUsdSnapshot).toBe(100);
    expect(snapshot.exchangeRateSnapshot).toBe(0.9);
    expect(snapshot.eurValueSnapshot).toBe(180); // 2 * 100 * 0.9
    expect(new Date(snapshot.priceSnapshotAt).getTime()).not.toBeNaN();
  });

  it("leaves eurValueSnapshot null when no rate is available (never a guessed value)", () => {
    const snapshot = buildSnapshot({ code: "art-1001", name: "Bürostuhl", price_usd: 100 }, 2, null);
    expect(snapshot.eurValueSnapshot).toBeNull();
  });

  it("snapshots the normal price and 'normal' tier below the bulk threshold", () => {
    const snapshot = buildSnapshot(TIERED_PRODUCT, 7, null);
    expect(snapshot.unitPriceUsdSnapshot).toBe(60);
    expect(snapshot.appliedPriceTier).toBe("normal");
    expect(snapshot.normalPriceUsdSnapshot).toBe(60);
  });

  it("snapshots the bulk price and 'bulk' tier at or above the threshold", () => {
    const snapshot = buildSnapshot(TIERED_PRODUCT, 12, null);
    expect(snapshot.unitPriceUsdSnapshot).toBe(55);
    expect(snapshot.appliedPriceTier).toBe("bulk");
  });

  it("freezes the whole price structure, not just the applied number", () => {
    const snapshot = buildSnapshot(TIERED_PRODUCT, 3, null);
    expect(snapshot.normalPriceUsdSnapshot).toBe(60);
    expect(snapshot.bulkPriceUsdSnapshot).toBe(55);
    expect(snapshot.bulkPriceMinQuantitySnapshot).toBe(10);
  });

  it("records no bulk tier for a product that has none", () => {
    const snapshot = buildSnapshot(FLAT_PRODUCT, 50, null);
    expect(snapshot.unitPriceUsdSnapshot).toBe(60);
    expect(snapshot.bulkPriceUsdSnapshot).toBeNull();
    expect(snapshot.bulkPriceMinQuantitySnapshot).toBeNull();
    expect(snapshot.appliedPriceTier).toBe("normal");
  });

  it("converts the *effective* USD total to EUR, not the normal-price total", () => {
    // 12 x 55 = 660 USD, at 0.9 -> 594 EUR (not 12 x 60 x 0.9 = 648).
    expect(buildSnapshot(TIERED_PRODUCT, 12, 0.9).eurValueSnapshot).toBe(594);
  });

  it("snapshots oils pack-total bulk as 16 per unit and 160 for quantity 10", () => {
    const oil = {
      code: "OXO50",
      name: "ANADROL",
      price_usd: 18,
      bulk_price_usd: 160,
      bulk_price_min_quantity: 10,
    };
    const snapshot = buildSnapshot(oil, 10, null);
    expect(snapshot.unitPriceUsdSnapshot).toBe(16);
    expect(snapshot.bulkPriceUsdSnapshot).toBe(16);
    expect(snapshot.appliedPriceTier).toBe("bulk");
  });
});

describe("snapshotToColumns", () => {
  it("maps every snapshot value onto its cart_items column", () => {
    const columns = snapshotToColumns(buildSnapshot(TIERED_PRODUCT, 12, 0.9));
    expect(columns).toMatchObject({
      unit_price_usd_snapshot: 55,
      normal_price_usd_snapshot: 60,
      bulk_price_usd_snapshot: 55,
      bulk_price_min_quantity_snapshot: 10,
      applied_price_tier: "bulk",
      exchange_rate_snapshot: 0.9,
      eur_value_snapshot: 594,
    });
  });

  it("covers exactly the columns that CLEARED_PRICE_COLUMNS resets", () => {
    const columns = snapshotToColumns(buildSnapshot(TIERED_PRODUCT, 1, null));
    expect(Object.keys(columns).sort()).toEqual(Object.keys(CLEARED_PRICE_COLUMNS).sort());
  });
});

describe("repriceForQuantity", () => {
  /** A cart line as it looks after adding 7 units of the tiered product. */
  const lineAt7 = {
    unit_price_usd_snapshot: 60,
    normal_price_usd_snapshot: 60,
    bulk_price_usd_snapshot: 55,
    bulk_price_min_quantity_snapshot: 10,
    exchange_rate_snapshot: 0.9,
  };

  it("switches 7 -> 12 from the normal to the bulk price", () => {
    const repriced = repriceForQuantity(lineAt7, 12);
    expect(repriced?.unit_price_usd_snapshot).toBe(55);
    expect(repriced?.applied_price_tier).toBe("bulk");
    expect(repriced?.eur_value_snapshot).toBe(594); // 12 * 55 * 0.9
  });

  it("switches 12 -> 7 back to the normal price", () => {
    const lineAt12 = { ...lineAt7, unit_price_usd_snapshot: 55 };
    const repriced = repriceForQuantity(lineAt12, 7);
    expect(repriced?.unit_price_usd_snapshot).toBe(60);
    expect(repriced?.applied_price_tier).toBe("normal");
    expect(repriced?.eur_value_snapshot).toBe(378); // 7 * 60 * 0.9
  });

  it("applies the bulk price exactly at the threshold", () => {
    expect(repriceForQuantity(lineAt7, 10)?.unit_price_usd_snapshot).toBe(55);
    expect(repriceForQuantity(lineAt7, 9)?.unit_price_usd_snapshot).toBe(60);
  });

  it("reprices an oils pack-total snapshot to 16 per unit, not 1600", () => {
    const oilLine = {
      unit_price_usd_snapshot: 18,
      normal_price_usd_snapshot: 18,
      bulk_price_usd_snapshot: 160,
      bulk_price_min_quantity_snapshot: 10,
      exchange_rate_snapshot: null,
    };
    expect(repriceForQuantity(oilLine, 9)?.unit_price_usd_snapshot).toBe(18);
    expect(repriceForQuantity(oilLine, 10)?.unit_price_usd_snapshot).toBe(16);
    expect(repriceForQuantity(oilLine, 11)?.unit_price_usd_snapshot).toBe(16);
    expect(repriceForQuantity(oilLine, 20)?.unit_price_usd_snapshot).toBe(16);
  });

  it("touches the price date only when the effective price actually moved", () => {
    expect(repriceForQuantity(lineAt7, 12)?.price_snapshot_at).toBeDefined();
    // 7 -> 8 stays in the normal tier, so the snapshot must stay untouched.
    expect(repriceForQuantity(lineAt7, 8)?.price_snapshot_at).toBeUndefined();
  });

  it("keeps the normal price for a line without a bulk tier", () => {
    const flatLine = {
      unit_price_usd_snapshot: 60,
      normal_price_usd_snapshot: 60,
      bulk_price_usd_snapshot: null,
      bulk_price_min_quantity_snapshot: null,
      exchange_rate_snapshot: null,
    };
    const repriced = repriceForQuantity(flatLine, 12);
    expect(repriced?.unit_price_usd_snapshot).toBe(60);
    expect(repriced?.eur_value_snapshot).toBeNull();
  });

  it("merges 5 + 7 = 12 into the bulk price", () => {
    const mergedQuantity = 5 + 7;
    const repriced = repriceForQuantity(lineAt7, mergedQuantity);
    expect(mergedQuantity).toBe(12);
    expect(repriced?.unit_price_usd_snapshot).toBe(55);
    expect(repriced?.applied_price_tier).toBe("bulk");
  });

  it("treats a pre-migration line (no normal price stored) as normal-priced", () => {
    const legacyLine = {
      unit_price_usd_snapshot: 42,
      normal_price_usd_snapshot: null,
      bulk_price_usd_snapshot: null,
      bulk_price_min_quantity_snapshot: null,
      exchange_rate_snapshot: 1,
    };
    const repriced = repriceForQuantity(legacyLine, 30);
    expect(repriced?.unit_price_usd_snapshot).toBe(42);
    expect(repriced?.eur_value_snapshot).toBe(1260);
  });

  it("returns null for an unpriced line (unresolved code) instead of inventing a price", () => {
    expect(
      repriceForQuantity(
        {
          unit_price_usd_snapshot: null,
          normal_price_usd_snapshot: null,
          bulk_price_usd_snapshot: null,
          bulk_price_min_quantity_snapshot: null,
          exchange_rate_snapshot: null,
        },
        5,
      ),
    ).toBeNull();
  });
});

describe("buildPriceUpdateDiff", () => {
  const baseItem = {
    id: "item-1",
    quantity: 2,
    unit_price_usd_snapshot: 100,
    normal_price_usd_snapshot: 100,
    bulk_price_usd_snapshot: null,
    bulk_price_min_quantity_snapshot: null,
    applied_price_tier: "normal" as const,
    exchange_rate_snapshot: 0.9,
    eur_value_snapshot: 180,
    product_code_snapshot: "ART-1001",
  };

  const flatCatalog = { price_usd: 100, bulk_price_usd: null, bulk_price_min_quantity: null };

  it("reports changed = false and no diff when nothing changed", () => {
    const diff = buildPriceUpdateDiff(baseItem, flatCatalog, 0.9);
    expect(diff.changed).toBe(false);
    expect(diff.diffUsd).toBe(0);
    expect(diff.diffEur).toBe(0);
  });

  it("computes old vs new totals and the difference when the price increased", () => {
    const diff = buildPriceUpdateDiff(baseItem, { ...flatCatalog, price_usd: 110 }, 0.9);
    expect(diff.changed).toBe(true);
    expect(diff.oldTotalUsd).toBe(200);
    expect(diff.newTotalUsd).toBe(220);
    expect(diff.diffUsd).toBe(20);
  });

  it("computes the difference when only the exchange rate changed", () => {
    const diff = buildPriceUpdateDiff(baseItem, flatCatalog, 0.95);
    expect(diff.changed).toBe(true);
    expect(diff.oldTotalEur).toBe(180);
    expect(diff.newTotalEur).toBe(190);
    expect(diff.diffEur).toBe(10);
  });

  it("never fabricates a EUR diff when no current rate is available", () => {
    const diff = buildPriceUpdateDiff(baseItem, { ...flatCatalog, price_usd: 110 }, null);
    expect(diff.newTotalEur).toBeNull();
    expect(diff.diffEur).toBeNull();
  });

  it("previews the tier that this line's quantity will actually get", () => {
    const item = { ...baseItem, quantity: 12, unit_price_usd_snapshot: 60, normal_price_usd_snapshot: 60 };
    const diff = buildPriceUpdateDiff(item, { price_usd: 60, bulk_price_usd: 55, bulk_price_min_quantity: 10 }, null);
    expect(diff.newUnitPriceUsd).toBe(55);
    expect(diff.newPriceTier).toBe("bulk");
    expect(diff.newTotalUsd).toBe(660);
    expect(diff.changed).toBe(true);
  });

  it("flags a stale price structure even when today's effective price is unchanged", () => {
    // Threshold moved 10 -> 5 in the catalog. At quantity 12 the applied price
    // is still 55, but the line would reprice against a stale threshold.
    const item = {
      ...baseItem,
      quantity: 12,
      unit_price_usd_snapshot: 55,
      normal_price_usd_snapshot: 60,
      bulk_price_usd_snapshot: 55,
      bulk_price_min_quantity_snapshot: 10,
      applied_price_tier: "bulk" as const,
    };
    const diff = buildPriceUpdateDiff(
      item,
      { price_usd: 60, bulk_price_usd: 55, bulk_price_min_quantity: 5 },
      0.9,
    );
    expect(diff.newUnitPriceUsd).toBe(55);
    expect(diff.changed).toBe(true);
  });
});
