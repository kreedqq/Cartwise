import { describe, expect, it } from "vitest";

import {
  buildImportRow,
  flagDuplicateCodes,
  looksLikeHeaderRow,
  matchImportField,
  normalizeHeader,
  parseBooleanToken,
  parsePriceToken,
  parseProductTable,
  parseQuantityToken,
  revalidateImportRow,
} from "@/lib/productImportRow";

describe("normalizeHeader / matchImportField", () => {
  it("folds case, spacing, punctuation and umlauts", () => {
    expect(normalizeHeader("Mengenpreis ab")).toBe("mengenpreisab");
    expect(normalizeHeader("MENGENPREIS_AB")).toBe("mengenpreisab");
    expect(normalizeHeader("Dosage / Vial")).toBe("dosagevial");
    expect(normalizeHeader("Stärke")).toBe("staerke");
  });

  it("recognises the machine-readable export headers", () => {
    expect(matchImportField("code")).toBe("code");
    expect(matchImportField("price_usd")).toBe("priceUsd");
    expect(matchImportField("bulk_price_usd")).toBe("bulkPriceUsd");
    expect(matchImportField("bulk_price_min_quantity")).toBe("bulkPriceMinQuantity");
    expect(matchImportField("dosage_vial")).toBe("dosageVial");
    expect(matchImportField("is_active")).toBe("isActive");
  });

  it("recognises German column titles from a supplier price list", () => {
    expect(matchImportField("Artikelcode")).toBe("code");
    expect(matchImportField("Bezeichnung")).toBe("name");
    expect(matchImportField("Normalpreis")).toBe("priceUsd");
    expect(matchImportField("Mengenpreis")).toBe("bulkPriceUsd");
    expect(matchImportField("Mengenpreis ab")).toBe("bulkPriceMinQuantity");
    expect(matchImportField("Kategorie")).toBe("category");
    expect(matchImportField("Status")).toBe("isActive");
  });

  it("returns null for an unknown column instead of guessing", () => {
    expect(matchImportField("Lieferant")).toBeNull();
    expect(matchImportField("")).toBeNull();
  });

  it("does not confuse the normal price with the bulk price", () => {
    expect(matchImportField("Mengenpreis")).not.toBe("priceUsd");
    expect(matchImportField("Preis")).not.toBe("bulkPriceUsd");
  });
});

describe("looksLikeHeaderRow", () => {
  it("detects a header row by the number of recognised columns", () => {
    expect(looksLikeHeaderRow(["Artikelcode", "Name", "Normalpreis"])).toBe(true);
    expect(looksLikeHeaderRow(["ART-1001", "Beispiel", "60"])).toBe(false);
  });
});

describe("parsePriceToken", () => {
  it("strips currency decoration", () => {
    expect(parsePriceToken("$60").value).toBe(60);
    expect(parsePriceToken("60.00 USD").value).toBe(60);
    expect(parsePriceToken(" 55,50 ").value).toBe(55.5);
  });

  it("uses the last separator as the decimal separator", () => {
    expect(parsePriceToken("1.299,00").value).toBe(1299);
    expect(parsePriceToken("1,299.00").value).toBe(1299);
  });

  it("reports an empty cell as absent, not invalid", () => {
    expect(parsePriceToken("")).toEqual({ value: null, invalid: false });
    expect(parsePriceToken(null)).toEqual({ value: null, invalid: false });
  });

  it("reports unreadable content as invalid instead of guessing a number", () => {
    expect(parsePriceToken("auf Anfrage").invalid).toBe(true);
    expect(parsePriceToken("60-70").invalid).toBe(true);
    expect(parsePriceToken("4K").invalid).toBe(true);
    expect(parsePriceToken(",").invalid).toBe(true);
  });

  it("accepts a number that is still being typed", () => {
    expect(parsePriceToken("55,").value).toBe(55);
    expect(parsePriceToken("55.").value).toBe(55);
  });
});

describe("parseQuantityToken", () => {
  it("tolerates the decoration a price list puts around a threshold", () => {
    expect(parseQuantityToken("ab 10").value).toBe(10);
    expect(parseQuantityToken(">= 10").value).toBe(10);
    expect(parseQuantityToken("10+").value).toBe(10);
    expect(parseQuantityToken("10 Stk.").value).toBe(10);
    expect(parseQuantityToken("2,5").value).toBe(2.5);
  });

  it("reports a cell with no number at all as invalid", () => {
    expect(parseQuantityToken("ab Anfrage").invalid).toBe(true);
  });
});

describe("parseBooleanToken", () => {
  it("reads German and English status wording", () => {
    expect(parseBooleanToken("aktiv").value).toBe(true);
    expect(parseBooleanToken("Ja").value).toBe(true);
    expect(parseBooleanToken("true").value).toBe(true);
    expect(parseBooleanToken("1").value).toBe(true);
    expect(parseBooleanToken("inaktiv").value).toBe(false);
    expect(parseBooleanToken("Nein").value).toBe(false);
    expect(parseBooleanToken("0").value).toBe(false);
  });

  it("leaves an empty cell as 'unchanged' and rejects nonsense", () => {
    expect(parseBooleanToken("")).toEqual({ value: null, invalid: false });
    expect(parseBooleanToken("vielleicht").invalid).toBe(true);
  });
});

describe("buildImportRow", () => {
  const complete = {
    code: "art-5001",
    name: "Beispielpräparat A",
    dosageVial: "10 mg / Vial",
    priceUsd: "60",
    bulkPriceUsd: "55",
    bulkPriceMinQuantity: "10",
    category: "Präparate",
    isActive: "aktiv",
  };

  it("keeps every field and normalises the code", () => {
    const row = buildImportRow(complete, 1, "raw");
    expect(row.quality).toBe("ok");
    expect(row.parsedCode).toBe("ART-5001");
    expect(row.parsedName).toBe("Beispielpräparat A");
    expect(row.parsedDosageVial).toBe("10 mg / Vial");
    expect(row.parsedPriceUsd).toBe(60);
    expect(row.parsedBulkPriceUsd).toBe(55);
    expect(row.parsedBulkPriceMinQuantity).toBe(10);
    expect(row.parsedCategory).toBe("Präparate");
    expect(row.parsedIsActive).toBe(true);
  });

  it("accepts a row without a bulk tier", () => {
    const row = buildImportRow({ code: "ART-1", name: "Ohne Staffel", priceUsd: "42" }, 1, "raw");
    expect(row.quality).toBe("ok");
    expect(row.parsedBulkPriceUsd).toBeNull();
    expect(row.parsedBulkPriceMinQuantity).toBeNull();
  });

  it("rejects a bulk price without a threshold (invalid bulk price)", () => {
    const row = buildImportRow({ ...complete, bulkPriceMinQuantity: "" }, 1, "raw");
    expect(row.quality).toBe("error");
    expect(row.qualityReason).toContain("Mengenpreis ab");
  });

  it("rejects a threshold without a bulk price (invalid threshold)", () => {
    const row = buildImportRow({ ...complete, bulkPriceUsd: "" }, 1, "raw");
    expect(row.quality).toBe("error");
    expect(row.qualityReason).toContain("ohne Mengenpreis");
  });

  it("rejects a threshold of 0 or below", () => {
    expect(buildImportRow({ ...complete, bulkPriceMinQuantity: "0" }, 1, "r").quality).toBe("error");
    expect(buildImportRow({ ...complete, bulkPriceMinQuantity: "-5" }, 1, "r").quality).toBe("error");
  });

  it("rejects a negative bulk price and a negative normal price", () => {
    expect(buildImportRow({ ...complete, bulkPriceUsd: "-1" }, 1, "r").quality).toBe("error");
    expect(buildImportRow({ ...complete, priceUsd: "-1" }, 1, "r").quality).toBe("error");
  });

  it("rejects a missing code, name or normal price", () => {
    expect(buildImportRow({ ...complete, code: "" }, 1, "r").qualityReason).toContain("Artikelcode fehlt");
    expect(buildImportRow({ ...complete, name: "" }, 1, "r").qualityReason).toContain("Name fehlt");
    expect(buildImportRow({ ...complete, priceUsd: "" }, 1, "r").qualityReason).toContain("Normalpreis fehlt");
  });

  it("never turns an unreadable price into null silently", () => {
    const row = buildImportRow({ ...complete, priceUsd: "auf Anfrage" }, 1, "r");
    expect(row.quality).toBe("error");
    expect(row.parsedPriceUsd).toBeNull();
    expect(row.qualityReason).toContain("Normalpreis konnte nicht");
  });

  it("warns - but still imports - when the tier looks implausible", () => {
    const alwaysBulk = buildImportRow({ ...complete, bulkPriceMinQuantity: "1" }, 1, "r");
    expect(alwaysBulk.quality).toBe("warning");

    const higherBulk = buildImportRow({ ...complete, bulkPriceUsd: "70" }, 1, "r");
    expect(higherBulk.quality).toBe("warning");
    expect(higherBulk.qualityReason).toContain("höher als der Normalpreis");
  });

  it("keeps the raw text for the audit trail", () => {
    expect(buildImportRow(complete, 4, "ART-5001 | 60 | 55").rawText).toBe("ART-5001 | 60 | 55");
  });
});

describe("revalidateImportRow", () => {
  it("re-runs validation after an inline edit", () => {
    const row = buildImportRow({ code: "ART-1", name: "Test", priceUsd: "60" }, 1, "raw");
    const edited = revalidateImportRow({ ...row, parsedBulkPriceUsd: 55 });
    expect(edited.quality).toBe("error");
    expect(edited.qualityReason).toContain("Mengenpreis ab");
  });
});

describe("flagDuplicateCodes", () => {
  it("warns on codes that appear twice in the same file", () => {
    const rows = [
      buildImportRow({ code: "ART-1", name: "Präparat A", priceUsd: "1" }, 1, "a"),
      buildImportRow({ code: "art-1", name: "Präparat A (Dublette)", priceUsd: "2" }, 2, "b"),
      buildImportRow({ code: "ART-2", name: "Präparat B", priceUsd: "3" }, 3, "c"),
    ];
    const flagged = flagDuplicateCodes(rows);
    expect(flagged[0].quality).toBe("warning");
    expect(flagged[1].quality).toBe("warning");
    expect(flagged[2].quality).toBe("ok");
  });
});

describe("parseProductTable", () => {
  const header = [
    "code",
    "name",
    "dosage_vial",
    "price_usd",
    "bulk_price_usd",
    "bulk_price_min_quantity",
    "category",
    "is_active",
  ];

  it("maps a full row onto every field", () => {
    const result = parseProductTable([
      header,
      ["ART-5001", "Präparat A", "10 mg / Vial", "60", "55", "10", "Präparate", "true"],
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      parsedCode: "ART-5001",
      parsedDosageVial: "10 mg / Vial",
      parsedPriceUsd: 60,
      parsedBulkPriceUsd: 55,
      parsedBulkPriceMinQuantity: 10,
      parsedCategory: "Präparate",
      parsedIsActive: true,
      quality: "ok",
    });
  });

  it("does not care about column order", () => {
    const result = parseProductTable([
      ["Mengenpreis ab", "Artikelcode", "Normalpreis", "Bezeichnung", "Mengenpreis"],
      ["10", "ART-5001", "60", "Präparat A", "55"],
    ]);
    expect(result.rows[0]).toMatchObject({
      parsedCode: "ART-5001",
      parsedPriceUsd: 60,
      parsedBulkPriceUsd: 55,
      parsedBulkPriceMinQuantity: 10,
    });
  });

  it("skips title rows above the header", () => {
    const result = parseProductTable([
      ["Preisliste 2026"],
      [],
      header,
      ["ART-1", "A", "", "10", "", "", "", "true"],
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].parsedCode).toBe("ART-1");
  });

  it("skips a header repeated further down and fully empty rows", () => {
    const result = parseProductTable([
      header,
      ["ART-1", "A", "", "10", "", "", "", "true"],
      ["", "", "", "", "", "", "", ""],
      header,
      ["ART-2", "B", "", "20", "", "", "", "true"],
    ]);
    expect(result.rows.map((r) => r.parsedCode)).toEqual(["ART-1", "ART-2"]);
  });

  it("reports unknown columns instead of dropping them unnoticed", () => {
    const result = parseProductTable([[...header, "Lieferant"], ["ART-1", "A", "", "10", "", "", "", "true", "ACME"]]);
    expect(result.unknownHeaders).toEqual(["Lieferant"]);
    expect(result.recognizedFields).toContain("code");
  });

  it("returns nothing when there is no usable header", () => {
    expect(parseProductTable([["ART-1", "A", "10"]]).rows).toEqual([]);
  });

  it("handles native spreadsheet types (numbers, booleans)", () => {
    const result = parseProductTable([header, ["ART-1", "A", null, 60, 55, 10, null, false]]);
    expect(result.rows[0]).toMatchObject({
      parsedPriceUsd: 60,
      parsedBulkPriceUsd: 55,
      parsedBulkPriceMinQuantity: 10,
      parsedIsActive: false,
    });
  });

  it("keeps an invalid bulk pair as an error row rather than silently dropping the field", () => {
    const result = parseProductTable([header, ["ART-1", "A", "", "60", "55", "", "", "true"]]);
    expect(result.rows[0].quality).toBe("error");
  });

  it("numbers rows sequentially, independently of where the header sat", () => {
    const result = parseProductTable([
      ["Titel"],
      header,
      ["ART-1", "A", "", "1", "", "", "", "true"],
      ["ART-2", "B", "", "2", "", "", "", "true"],
    ]);
    expect(result.rows.map((r) => r.rowNumber)).toEqual([1, 2]);
  });
});
