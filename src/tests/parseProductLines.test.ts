import { describe, expect, it } from "vitest";

import { flagDuplicateCodes, parseAllLines, parseProductLine } from "@/pdf/parseProductLines";

describe("parseProductLine", () => {
  it("parses a well-formed 'code name price' line with $ prefix", () => {
    const row = parseProductLine("ART-1001   Bürostuhl ergonomisch   $189.90", 1);
    expect(row.parsedCode).toBe("ART-1001");
    expect(row.parsedName).toBe("Bürostuhl ergonomisch");
    expect(row.parsedPriceUsd).toBe(189.9);
    expect(row.quality).toBe("ok");
  });

  it("parses semicolon-separated CSV-style rows", () => {
    const row = parseProductLine("ART-2002;Monitor 27 4K;349.00", 1);
    expect(row.parsedCode).toBe("ART-2002");
    expect(row.parsedPriceUsd).toBe(349);
  });

  it("handles European decimal comma prices", () => {
    const row = parseProductLine("ART-3001   Kopierpapier A4   24,99", 1);
    expect(row.parsedPriceUsd).toBe(24.99);
  });

  it("handles thousands-separated prices with a decimal comma", () => {
    const row = parseProductLine("ART-4001   Konferenzraum-Kamera   1.299,00", 1);
    expect(row.parsedPriceUsd).toBe(1299);
  });

  it("flags an empty line as an error", () => {
    expect(parseProductLine("", 1).quality).toBe("error");
  });

  it("flags an unrecognizable line as an error instead of guessing", () => {
    const row = parseProductLine("Dies ist nur ein Freitext-Kommentar ohne Struktur", 1);
    expect(row.quality).toBe("error");
    expect(row.parsedPriceUsd).toBeNull();
  });

  it("flags a likely table header row as an error", () => {
    const row = parseProductLine("Artikelcode Name Preis", 1);
    expect(row.quality).toBe("error");
  });
});

describe("flagDuplicateCodes", () => {
  it("downgrades otherwise-ok rows that share a code to a warning", () => {
    const rows = parseAllLines(["ART-1001 Stuhl 10", "ART-1001 Stuhl (2) 12"]);
    const flagged = flagDuplicateCodes(rows);
    expect(flagged[0].quality).toBe("warning");
    expect(flagged[1].quality).toBe("warning");
  });

  it("leaves unique codes untouched", () => {
    const rows = parseAllLines(["ART-1001 Stuhl 10", "ART-2002 Tisch 20"]);
    const flagged = flagDuplicateCodes(rows);
    expect(flagged[0].quality).toBe("ok");
    expect(flagged[1].quality).toBe("ok");
  });
});
