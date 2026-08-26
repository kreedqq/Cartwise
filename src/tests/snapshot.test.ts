import { describe, expect, it } from "vitest";

import { buildPriceUpdateDiff, buildSnapshot } from "@/lib/snapshot";

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
});

describe("buildPriceUpdateDiff", () => {
  const baseItem = {
    id: "item-1",
    quantity: 2,
    unit_price_usd_snapshot: 100,
    exchange_rate_snapshot: 0.9,
    eur_value_snapshot: 180,
    product_code_snapshot: "ART-1001",
  };

  it("reports changed = false and no diff when nothing changed", () => {
    const diff = buildPriceUpdateDiff(baseItem, 100, 0.9);
    expect(diff.changed).toBe(false);
    expect(diff.diffUsd).toBe(0);
    expect(diff.diffEur).toBe(0);
  });

  it("computes old vs new totals and the difference when the price increased", () => {
    const diff = buildPriceUpdateDiff(baseItem, 110, 0.9);
    expect(diff.changed).toBe(true);
    expect(diff.oldTotalUsd).toBe(200);
    expect(diff.newTotalUsd).toBe(220);
    expect(diff.diffUsd).toBe(20);
  });

  it("computes the difference when only the exchange rate changed", () => {
    const diff = buildPriceUpdateDiff(baseItem, 100, 0.95);
    expect(diff.changed).toBe(true);
    expect(diff.oldTotalEur).toBe(180);
    expect(diff.newTotalEur).toBe(190);
    expect(diff.diffEur).toBe(10);
  });

  it("never fabricates a EUR diff when no current rate is available", () => {
    const diff = buildPriceUpdateDiff(baseItem, 110, null);
    expect(diff.newTotalEur).toBeNull();
    expect(diff.diffEur).toBeNull();
  });
});
