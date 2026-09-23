import { describe, expect, it } from "vitest";

import { buildPeptixOrderSummaryPdf, planPeptixOrderSummaryPages, ORDER_ROWS_PER_PAGE } from "@/lib/pdf/peptixOrderSummaryPdf";
import { buildChinaPurchaseSummary, buildProcessingOrderSummary } from "@/lib/orderSummary";
import { buildProcessingOrderSummaryPdf } from "@/lib/orderSummaryExport";
import type { KitShareOrderContext } from "@/lib/kitOrderSummary";
import type { Tables } from "@/types/database";

function makeOrder(overrides: Partial<Tables<"orders">> = {}): Tables<"orders"> {
  return {
    id: "order-1",
    order_number: "CN-2026-000034",
    status: "processing",
    user_id: "user-1",
    telegram_username_snapshot: "EddiB",
    shop_area: "group_buy_1",
    created_at: new Date().toISOString(),
    ...overrides,
  } as Tables<"orders">;
}

function makeItem(overrides: Partial<Tables<"order_items">> = {}): Tables<"order_items"> {
  return {
    id: "item-1",
    order_id: "order-1",
    product_id: "prod-selank",
    product_code_snapshot: "SK10",
    product_name_snapshot: "Selank",
    dosage_vial_snapshot: "10mg/vial x10vials",
    quantity: 5,
    normal_price_usd_snapshot: 60,
    unit_price_usd_snapshot: 75,
    line_total_usd: 30,
    ...overrides,
  } as Tables<"order_items">;
}

/** Realistic mixed batch: shared kits, bulk oil, orals, duplicate codes across users, long username. */
function mixedFinalSummary() {
  const kitContext: KitShareOrderContext = {
    kits: [{ id: "kit-sk", product_id: "prod-selank", kit_size_vials: 10 }],
    participants: [
      { kit_share_id: "kit-sk", user_id: "user-mel", quantity: 5, order_id: "order-mel" },
      { kit_share_id: "kit-sk", user_id: "user-olgi", quantity: 5, order_id: "order-olgi" },
    ],
  };
  const catalog = [
    { id: "prod-selank", code: "SK10", name: "Selank", category: "PEPTIDES", price_usd: 60 },
    { id: "prod-cu50", code: "CU50", name: "GHK-Cu", category: "PEPTIDES", price_usd: 30 },
    { id: "prod-slu5", code: "SLU5", name: "Oral", category: "ORALS", price_usd: 40 },
    { id: "prod-oxo", code: "OXO50", name: "Oil", category: "INJECTABLE OILS", price_usd: 18, bulk_price_usd: 160, bulk_price_min_quantity: 10 },
  ];
  const mel = makeOrder({
    id: "order-mel",
    user_id: "user-mel",
    telegram_username_snapshot: "MelissaWithVeryLongTelegramUsernameForPdfQa",
  });
  const olgi = makeOrder({ id: "order-olgi", user_id: "user-olgi", telegram_username_snapshot: "Olgi" });
  const eddi = makeOrder({ id: "order-eddi", user_id: "user-eddi", telegram_username_snapshot: "EddiB" });
  const items = [
    makeItem({ id: "i1", order_id: mel.id, quantity: 5 }),
    makeItem({ id: "i2", order_id: olgi.id, quantity: 5 }),
    makeItem({
      id: "i3",
      order_id: eddi.id,
      product_id: "prod-cu50",
      product_code_snapshot: "CU50",
      product_name_snapshot: "GHK-Cu",
      quantity: 5,
      normal_price_usd_snapshot: 30,
      line_total_usd: 187.5,
    }),
    makeItem({
      id: "i4",
      order_id: olgi.id,
      product_id: "prod-cu50",
      product_code_snapshot: "CU50",
      product_name_snapshot: "GHK-Cu",
      quantity: 6,
      normal_price_usd_snapshot: 30,
      line_total_usd: 225,
    }),
    makeItem({
      id: "i5",
      order_id: eddi.id,
      product_id: "prod-slu5",
      product_code_snapshot: "SLU5",
      product_name_snapshot: "Oral",
      quantity: 1,
      normal_price_usd_snapshot: 40,
      line_total_usd: 50,
    }),
    makeItem({
      id: "i6",
      order_id: mel.id,
      product_id: "prod-oxo",
      product_code_snapshot: "OXO50",
      product_name_snapshot: "Oil",
      quantity: 10,
      normal_price_usd_snapshot: 18,
      bulk_price_usd_snapshot: 160,
      bulk_price_min_quantity_snapshot: 10,
      line_total_usd: 200,
    }),
  ];
  return buildProcessingOrderSummary([mel, olgi, eddi], items, catalog, kitContext);
}

describe("order summary PDF finalization", () => {
  it("admin export uses buildPeptixOrderSummaryPdf via orderSummaryExport", () => {
    const summary = mixedFinalSummary();
    const fromExport = buildProcessingOrderSummaryPdf(summary, "now");
    const direct = buildPeptixOrderSummaryPdf(summary, "now");
    expect(fromExport.length).toBe(direct.length);
    expect(fromExport).toEqual(direct);
  });

  it("page 1 keeps per-user shared kit shares; page 2 aggregates SK10 once", () => {
    const summary = mixedFinalSummary();
    const melLines = summary.personLines.filter((l) => l.name.includes("Melissa"));
    const olgiSk = summary.personLines.find((l) => l.name === "Olgi" && l.code === "SK10");
    expect(melLines.some((l) => l.code === "SK10" && l.quantityLabel === "5/10 Kit")).toBe(true);
    expect(olgiSk?.quantityLabel).toBe("5/10 Kit");
    expect(summary.personLines.every((l) => !l.name.includes(" + "))).toBe(true);

    const skChina = summary.chinaPurchase.lines.filter((l) => l.code === "SK10");
    expect(skChina).toHaveLength(1);
    expect(skChina[0]?.quantityLabel).toBe("1 Kit");

    const cuChina = summary.chinaPurchase.lines.find((l) => l.code === "CU50");
    expect(cuChina?.quantity).toBe(11);
    expect(cuChina?.quantityLabel).toBe("11 Kits");
  });

  it("stats show PERSONEN, POSITIONEN, PRODUKTE — not a mixed-unit GESAMTMENGE", () => {
    const summary = mixedFinalSummary();
    expect(summary.personDistinctProductCount).toBe(
      new Set(summary.personLines.map((l) => l.code)).size,
    );
    const bytes = buildPeptixOrderSummaryPdf(summary, "23.09.2026, 12:00");
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text).toContain("PRODUKTE");
    expect(text).not.toContain("GESAMTMENGE");
  });

  it("bulk oil totals 160 USD once; china overview counts units separately", () => {
    const summary = mixedFinalSummary();
    const oxo = summary.chinaPurchase.lines.find((l) => l.code === "OXO50");
    expect(oxo?.totalUsd).toBe(160);
    expect(oxo?.quantityLabel).toBe("10 Vials");
    expect(summary.chinaPurchase.distinctProducts).toBe(summary.chinaPurchase.lines.length);
    expect(summary.chinaPurchase.totalUsd).toBe(
      summary.chinaPurchase.lines.reduce((s, l) => s + l.totalUsd, 0),
    );
  });

  it("normal batch is two PDF pages; large person list adds continuation pages only", () => {
    const summary = mixedFinalSummary();
    expect(planPeptixOrderSummaryPages(summary)).toEqual(["BESTELLUNGEN", "CHINA BESTELLUNG"]);
    const manyPersonLines = Array.from({ length: ORDER_ROWS_PER_PAGE + 3 }, (_, i) => ({
      name: `User${i}`,
      code: `C${i}`,
      quantity: 1,
      quantityLabel: "1 Kit",
      dose: "10 mg",
      article: "X",
    }));
    const big = { ...summary, personLines: manyPersonLines, personCount: manyPersonLines.length, positionCount: manyPersonLines.length };
    expect(planPeptixOrderSummaryPages(big as typeof summary).filter((p) => p === "BESTELLUNGEN").length).toBe(2);
  });

  it("PDF has no category pages and copy-friendly china columns", () => {
    const text = new TextDecoder("latin1").decode(buildPeptixOrderSummaryPdf(mixedFinalSummary(), "now"));
    expect(text).not.toMatch(/PEPTIDE BESTELL/i);
    expect(text).not.toContain("HÄNDLER GESAMTÜBERSICHT");
    expect(text).toContain("NUTZERNAME");
    expect(text).toContain("CHINA BESTELLUNG");
    expect(text).toContain("GESAMT CHINA BESTELLUNG");
    expect(text).toContain("BERSICHT");
    expect(text).toContain("VERSCHIEDENE PRODUKTE");
    expect(text).toContain("KITS:");
  });
});
