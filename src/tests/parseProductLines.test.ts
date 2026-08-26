import { describe, expect, it } from "vitest";

import {
  detectColumnLayout,
  flagDuplicateCodes,
  parseAllLines,
  parsePdfRows,
  parseProductLine,
} from "@/pdf/parseProductLines";
import { groupItemsIntoCells, type PdfRow } from "@/pdf/parsePdf";

/** Builds a positioned PDF row from [text, x, xEnd] tuples. */
function row(...cells: [string, number, number][]): PdfRow {
  return {
    text: cells.map(([text]) => text).join(" "),
    cells: cells.map(([text, x, xEnd]) => ({ text, x, xEnd })),
  };
}

const HEADER_ROW = row(
  ["CODE", 50, 90],
  ["Name", 120, 170],
  ["Dosage / Vial", 240, 310],
  ["Normalpreis", 360, 430],
  ["Mengenpreis", 460, 530],
  ["Mengenpreis ab", 560, 650],
  ["Kategorie", 680, 740],
  ["Status", 770, 810],
);

const DATA_ROW = row(
  ["ART-5001", 50, 100],
  ["Präparat A", 120, 190],
  ["10 mg / Vial", 240, 320],
  ["60.00", 395, 430],
  ["55.00", 495, 530],
  ["10", 630, 650],
  ["Präparate", 680, 735],
  ["aktiv", 770, 805],
);

describe("parseProductLine (positional fallback)", () => {
  it("parses a well-formed 'code name price' line with $ prefix", () => {
    const parsed = parseProductLine("ART-1001   Bürostuhl ergonomisch   $189.90", 1);
    expect(parsed.parsedCode).toBe("ART-1001");
    expect(parsed.parsedName).toBe("Bürostuhl ergonomisch");
    expect(parsed.parsedPriceUsd).toBe(189.9);
    expect(parsed.quality).toBe("ok");
  });

  it("parses semicolon-separated CSV-style rows", () => {
    const parsed = parseProductLine("ART-2002;Monitor 27 4K;349.00", 1);
    expect(parsed.parsedCode).toBe("ART-2002");
    expect(parsed.parsedPriceUsd).toBe(349);
  });

  it("handles European decimal comma prices", () => {
    expect(parseProductLine("ART-3001   Kopierpapier A4   24,99", 1).parsedPriceUsd).toBe(24.99);
  });

  it("handles thousands-separated prices with a decimal comma", () => {
    expect(parseProductLine("ART-4001   Konferenzraum-Kamera   1.299,00", 1).parsedPriceUsd).toBe(1299);
  });

  it("flags an empty line as an error", () => {
    expect(parseProductLine("", 1).quality).toBe("error");
  });

  it("flags an unrecognizable line as an error instead of guessing", () => {
    const parsed = parseProductLine("Dies ist nur ein Freitext-Kommentar ohne Struktur", 1);
    expect(parsed.quality).toBe("error");
    expect(parsed.parsedPriceUsd).toBeNull();
  });

  it("flags a likely table header row as an error", () => {
    expect(parseProductLine("Artikelcode Name Preis", 1).quality).toBe("error");
  });

  it("reads three trailing numbers as normal price, bulk price and threshold - but warns", () => {
    const parsed = parseProductLine("ART-5001   Präparat A   60.00   55.00   10", 1);
    expect(parsed.parsedPriceUsd).toBe(60);
    expect(parsed.parsedBulkPriceUsd).toBe(55);
    expect(parsed.parsedBulkPriceMinQuantity).toBe(10);
    expect(parsed.quality).toBe("warning");
    expect(parsed.qualityReason).toContain("bitte prüfen");
  });

  it("never guesses a bulk tier from a single extra number", () => {
    const parsed = parseProductLine("ART-5001   Präparat A   60.00   55.00", 1);
    expect(parsed.parsedPriceUsd).toBe(60);
    expect(parsed.parsedBulkPriceUsd).toBeNull();
    expect(parsed.parsedBulkPriceMinQuantity).toBeNull();
    expect(parsed.quality).toBe("warning");
    expect(parsed.qualityReason).toContain("Zusätzliche Zahlenspalte");
  });

  it("keeps a name that contains digits intact", () => {
    const parsed = parseProductLine("ART-2002;Monitor 27 4K;349.00", 1);
    expect(parsed.parsedName).toBe("Monitor 27 4K");
  });
});

describe("detectColumnLayout", () => {
  it("finds the header row and orders the columns left to right", () => {
    const layout = detectColumnLayout([row(["Preisliste 2026", 50, 200]), HEADER_ROW, DATA_ROW]);
    expect(layout?.headerRowIndex).toBe(1);
    expect(layout?.columns.map((c) => c.field)).toEqual([
      "code",
      "name",
      "dosageVial",
      "priceUsd",
      "bulkPriceUsd",
      "bulkPriceMinQuantity",
      "category",
      "isActive",
    ]);
  });

  it("returns null when there is no header to align against", () => {
    expect(detectColumnLayout([DATA_ROW])).toBeNull();
  });

  it("requires an article-code column - without a key an import is impossible", () => {
    const noCode = row(["Bezeichnung", 50, 120], ["Normalpreis", 200, 270], ["Kategorie", 320, 390]);
    expect(detectColumnLayout([noCode])).toBeNull();
  });
});

describe("parsePdfRows (column layout)", () => {
  it("maps every cell into the column it visually sits under", () => {
    const rows = parsePdfRows([HEADER_ROW, DATA_ROW]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      parsedCode: "ART-5001",
      parsedName: "Präparat A",
      parsedDosageVial: "10 mg / Vial",
      parsedPriceUsd: 60,
      parsedBulkPriceUsd: 55,
      parsedBulkPriceMinQuantity: 10,
      parsedCategory: "Präparate",
      parsedIsActive: true,
      quality: "ok",
    });
  });

  it("assigns right-aligned number columns correctly", () => {
    const rightAligned = row(
      ["ART-6001", 50, 100],
      ["Präparat B", 120, 190],
      ["42.00", 405, 430],
    );
    const rows = parsePdfRows([HEADER_ROW, rightAligned]);
    expect(rows[0].parsedPriceUsd).toBe(42);
    expect(rows[0].parsedBulkPriceUsd).toBeNull();
    expect(rows[0].quality).toBe("ok");
  });

  it("skips the header repeated on later pages", () => {
    const rows = parsePdfRows([HEADER_ROW, DATA_ROW, HEADER_ROW, DATA_ROW]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.parsedCode === "ART-5001")).toBe(true);
  });

  it("warns about duplicate codes across pages", () => {
    const rows = parsePdfRows([HEADER_ROW, DATA_ROW, DATA_ROW]);
    expect(rows.map((r) => r.quality)).toEqual(["warning", "warning"]);
  });

  it("flags footer noise as an error rather than importing it", () => {
    const footer = row(["Seite 1 von 3", 50, 150]);
    const rows = parsePdfRows([HEADER_ROW, DATA_ROW, footer]);
    expect(rows).toHaveLength(2);
    expect(rows[1].quality).toBe("error");
  });

  it("drops rows that carry no product signal at all", () => {
    const noise = row(["Präparate", 680, 740]);
    expect(parsePdfRows([HEADER_ROW, DATA_ROW, noise])).toHaveLength(1);
  });

  it("falls back to line parsing when no header can be detected", () => {
    const rows = parsePdfRows([
      row(["ART-1001", 50, 100], ["Bürostuhl", 200, 260], ["189.90", 400, 440]),
    ]);
    expect(rows[0].parsedCode).toBe("ART-1001");
    expect(rows[0].parsedPriceUsd).toBe(189.9);
  });

  it("keeps an incomplete bulk pair as an error, never as half a tier", () => {
    const brokenPair = row(
      ["ART-7001", 50, 100],
      ["Präparat C", 120, 190],
      ["60.00", 395, 430],
      ["55.00", 495, 530],
    );
    const rows = parsePdfRows([HEADER_ROW, brokenPair]);
    expect(rows[0].quality).toBe("error");
    expect(rows[0].parsedBulkPriceUsd).toBe(55);
    expect(rows[0].parsedBulkPriceMinQuantity).toBeNull();
  });
});

describe("groupItemsIntoCells", () => {
  const item = (str: string, x: number, width: number) => ({ str, x, y: 100, width, height: 10 });

  it("splits columns on a wide gap", () => {
    const grouped = groupItemsIntoCells([item("ART-1001", 50, 40), item("60.00", 300, 30)]);
    expect(grouped.cells).toHaveLength(2);
    expect(grouped.cells[1].text).toBe("60.00");
  });

  it("keeps words of the same cell together", () => {
    const grouped = groupItemsIntoCells([item("Präparat", 120, 40), item("A", 163, 8)]);
    expect(grouped.cells).toHaveLength(1);
    expect(grouped.cells[0].text).toBe("Präparat A");
  });

  it("joins character-level items without inserting spaces", () => {
    const grouped = groupItemsIntoCells([item("A", 50, 6), item("R", 56, 6), item("T", 62, 6)]);
    expect(grouped.cells).toHaveLength(1);
    expect(grouped.cells[0].text).toBe("ART");
  });

  it("produces the flattened line text alongside the cells", () => {
    const grouped = groupItemsIntoCells([item("ART-1001", 50, 40), item("60.00", 300, 30)]);
    expect(grouped.text).toBe("ART-1001 60.00");
  });
});

describe("flagDuplicateCodes", () => {
  it("downgrades otherwise-ok rows that share a code to a warning", () => {
    const flagged = flagDuplicateCodes(parseAllLines(["ART-1001 Stuhl 10", "ART-1001 Stuhl (2) 12"]));
    expect(flagged[0].quality).toBe("warning");
    expect(flagged[1].quality).toBe("warning");
  });

  it("leaves unique codes untouched", () => {
    const flagged = flagDuplicateCodes(parseAllLines(["ART-1001 Stuhl 10", "ART-2002 Tisch 20"]));
    expect(flagged[0].quality).toBe("ok");
    expect(flagged[1].quality).toBe("ok");
  });
});
