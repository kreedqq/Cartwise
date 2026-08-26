import { describe, expect, it } from "vitest";

import {
  applyRowEdit,
  resolvedAction,
  summarizeReviewRows,
  toApplyPayload,
  toReviewRow,
  toReviewRows,
} from "@/lib/importReview";
import { buildImportRow } from "@/lib/productImportRow";

const CATALOG = new Map([["ART-EXISTING", "product-1"]]);

function parsed(code: string, overrides: Record<string, string> = {}) {
  return buildImportRow({ code, name: "Testartikel", priceUsd: "60", ...overrides }, 1, `${code} 60`);
}

describe("toReviewRow", () => {
  it("marks an unknown code as a new article", () => {
    const review = toReviewRow(parsed("ART-NEW"), CATALOG);
    expect(review.targetProductId).toBeNull();
    expect(resolvedAction(review)).toBe("create");
  });

  it("matches a known code by article code alone - no manual selection", () => {
    const review = toReviewRow(parsed("ART-EXISTING"), CATALOG);
    expect(review.targetProductId).toBe("product-1");
    expect(resolvedAction(review)).toBe("update");
  });

  it("pre-selects skip for a row that cannot be imported", () => {
    const review = toReviewRow(parsed("ART-NEW", { priceUsd: "" }), CATALOG);
    expect(review.action).toBe("skip");
    expect(resolvedAction(review)).toBe("error");
  });

  it("seeds the numeric drafts from the parsed values", () => {
    const review = toReviewRow(parsed("ART-NEW", { bulkPriceUsd: "55", bulkPriceMinQuantity: "10" }), CATALOG);
    expect(review.priceDraft).toBe("60");
    expect(review.bulkPriceDraft).toBe("55");
    expect(review.bulkMinDraft).toBe("10");
  });
});

describe("applyRowEdit", () => {
  it("re-resolves the match when the code is corrected", () => {
    const review = toReviewRow(parsed("ART-TYPO"), CATALOG);
    const edited = applyRowEdit(review, { parsedCode: "art-existing" }, CATALOG);
    expect(edited.parsedCode).toBe("ART-EXISTING");
    expect(resolvedAction(edited)).toBe("update");
  });

  it("re-validates after an edit turns the row invalid", () => {
    const review = toReviewRow(parsed("ART-NEW"), CATALOG);
    const edited = applyRowEdit(review, { bulkPriceDraft: "55" }, CATALOG);
    expect(edited.quality).toBe("error");
    expect(resolvedAction(edited)).toBe("error");
  });

  it("re-validates after an edit repairs the row", () => {
    const broken = applyRowEdit(toReviewRow(parsed("ART-NEW"), CATALOG), { bulkPriceDraft: "55" }, CATALOG);
    const repaired = applyRowEdit(broken, { bulkMinDraft: "10" }, CATALOG);
    expect(repaired.quality).toBe("ok");
    expect(repaired.parsedBulkPriceUsd).toBe(55);
    expect(repaired.parsedBulkPriceMinQuantity).toBe(10);
  });

  it("keeps a half-typed number visible instead of rewriting the input", () => {
    const review = toReviewRow(parsed("ART-NEW"), CATALOG);
    const typing = applyRowEdit(review, { priceDraft: "55," }, CATALOG);
    expect(typing.priceDraft).toBe("55,");
    expect(typing.parsedPriceUsd).toBe(55);
  });

  it("flags an unreadable number instead of dropping it to null unnoticed", () => {
    const review = toReviewRow(parsed("ART-NEW"), CATALOG);
    const edited = applyRowEdit(review, { priceDraft: "auf Anfrage" }, CATALOG);
    expect(edited.quality).toBe("error");
    expect(edited.parsedPriceUsd).toBeNull();
  });

  it("keeps an explicit status choice across further edits", () => {
    const review = toReviewRow(parsed("ART-NEW"), CATALOG);
    const deactivated = applyRowEdit(review, { parsedIsActive: false }, CATALOG);
    const renamed = applyRowEdit(deactivated, { parsedName: "Neuer Name" }, CATALOG);
    expect(renamed.parsedIsActive).toBe(false);
    expect(renamed.parsedName).toBe("Neuer Name");
  });
});

describe("summarizeReviewRows", () => {
  it("counts create, update, skip and error separately", () => {
    const rows = toReviewRows(
      [
        buildImportRow({ code: "ART-NEW", name: "Neues Präparat", priceUsd: "1" }, 1, "a"),
        buildImportRow({ code: "ART-EXISTING", name: "Bekanntes Präparat", priceUsd: "2" }, 2, "b"),
        buildImportRow({ code: "", name: "Ohne Code", priceUsd: "3" }, 3, "c"),
      ],
      CATALOG,
    );
    const withSkip = [...rows, { ...rows[0], rowNumber: 4, action: "skip" as const }];

    const summary = summarizeReviewRows(withSkip);
    expect(summary).toMatchObject({ total: 4, create: 1, update: 1, skip: 1, error: 1, applicable: 2 });
  });
});

describe("toApplyPayload", () => {
  it("sends importable rows as 'auto' so the server decides by article code", () => {
    const payload = toApplyPayload(toReviewRows([parsed("ART-EXISTING")], CATALOG));
    expect(payload[0].action).toBe("auto");
  });

  it("sends error rows as explicit skips so the import history records them", () => {
    const payload = toApplyPayload(toReviewRows([parsed("ART-NEW", { priceUsd: "" })], CATALOG));
    expect(payload[0].action).toBe("skip");
    expect(payload).toHaveLength(1);
  });

  it("carries the matched product id along as a server-side hint", () => {
    const payload = toApplyPayload(toReviewRows([parsed("ART-EXISTING")], CATALOG));
    expect(payload[0].targetProductId).toBe("product-1");
  });
});
