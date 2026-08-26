import { normalizeProductCode } from "@/lib/money";
import type { ImportRowQuality } from "@/types/database";

export interface ParsedImportRow {
  rowNumber: number;
  rawText: string;
  parsedCode: string | null;
  parsedName: string | null;
  parsedPriceUsd: number | null;
  quality: ImportRowQuality;
  qualityReason: string | null;
}

// Matches lines like:
//   "ART-1001   Bürostuhl ergonomisch   $189.90"
//   "ART-1001  Bürostuhl ergonomisch  189,90 USD"
//   "ART-1001;Bürostuhl ergonomisch;189.90"
const ROW_PATTERN =
  /^\s*([A-Za-z0-9][A-Za-z0-9\-_./]{1,30})[\s;,\t]+(.+?)[\s;,\t]+\$?\s*([\d.,]+)\s*(?:USD|usd|\$)?\s*$/;

const CODE_ONLY_HEADER_WORDS = new Set([
  "artikelcode",
  "code",
  "sku",
  "artikel",
  "name",
  "bezeichnung",
  "preis",
  "price",
  "menge",
  "gesamt",
]);

/**
 * Heuristic, best-effort parser for one line of extracted PDF (or pasted)
 * text into a candidate product row. This deliberately never "guesses
 * confidently" - every row keeps its raw text and a quality flag so the
 * mandatory admin review (see docs/KONZEPT.md, PDF-Import) can catch
 * mistakes before anything reaches the database.
 */
export function parseProductLine(rawText: string, rowNumber: number): ParsedImportRow {
  const trimmed = rawText.trim();

  if (trimmed === "") {
    return { rowNumber, rawText, parsedCode: null, parsedName: null, parsedPriceUsd: null, quality: "error", qualityReason: "Leere Zeile." };
  }

  const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase();
  if (firstWord && CODE_ONLY_HEADER_WORDS.has(firstWord)) {
    return {
      rowNumber,
      rawText,
      parsedCode: null,
      parsedName: null,
      parsedPriceUsd: null,
      quality: "error",
      qualityReason: "Sieht nach einer Tabellenüberschrift aus, keine Artikeldaten.",
    };
  }

  const match = trimmed.match(ROW_PATTERN);
  if (!match) {
    return {
      rowNumber,
      rawText,
      parsedCode: null,
      parsedName: null,
      parsedPriceUsd: null,
      quality: "error",
      qualityReason: "Zeile konnte nicht als Artikelcode / Name / Preis erkannt werden.",
    };
  }

  const [, rawCode, rawName, rawPrice] = match;
  const code = normalizeProductCode(rawCode);
  const name = rawName.trim();
  const price = parsePriceToken(rawPrice);

  if (price == null) {
    return {
      rowNumber,
      rawText,
      parsedCode: code,
      parsedName: name,
      parsedPriceUsd: null,
      quality: "error",
      qualityReason: "Preis konnte nicht als Zahl interpretiert werden.",
    };
  }

  if (name.length < 2) {
    return {
      rowNumber,
      rawText,
      parsedCode: code,
      parsedName: name || null,
      parsedPriceUsd: price,
      quality: "warning",
      qualityReason: "Artikelname wirkt sehr kurz - bitte prüfen.",
    };
  }

  return { rowNumber, rawText, parsedCode: code, parsedName: name, parsedPriceUsd: price, quality: "ok", qualityReason: null };
}

function parsePriceToken(raw: string): number | null {
  let normalized = raw.trim();
  // Heuristic for thousands vs. decimal separators: if both , and . appear,
  // assume the last one is the decimal separator.
  if (normalized.includes(",") && normalized.includes(".")) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (normalized.includes(",")) {
    // Only a comma: treat as decimal separator (European format).
    normalized = normalized.replace(",", ".");
  }
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 10000) / 10000 : null;
}

export function parseAllLines(lines: string[]): ParsedImportRow[] {
  return lines.map((line, i) => parseProductLine(line, i + 1));
}

/** Flags rows whose parsed code appears more than once within the same import batch. */
export function flagDuplicateCodes(rows: ParsedImportRow[]): ParsedImportRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.parsedCode) counts.set(row.parsedCode, (counts.get(row.parsedCode) ?? 0) + 1);
  }
  return rows.map((row) => {
    if (row.parsedCode && (counts.get(row.parsedCode) ?? 0) > 1 && row.quality === "ok") {
      return { ...row, quality: "warning", qualityReason: "Artikelcode kommt mehrfach in dieser Datei vor." };
    }
    return row;
  });
}
