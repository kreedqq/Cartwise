/**
 * The canonical shape of one reviewed product-import line, shared by every
 * import source (PDF text layer, CSV, XLSX). Having exactly one row type means
 * the preview table, the validation rules and the apply_pdf_import payload are
 * identical no matter which file the admin uploaded - and that no parser can
 * quietly forget a field.
 *
 * Field names mirror the pdf_import_rows columns (parsed_*) so the mapping to
 * the database stays mechanical.
 */

import type { ImportRowQuality } from "@/types/database";

export interface ParsedProductImportRow {
  rowNumber: number;
  /** The original line/cell text, kept verbatim for the audit trail. */
  rawText: string;
  parsedCode: string | null;
  parsedName: string | null;
  parsedDosageVial: string | null;
  parsedDescription: string | null;
  parsedCategory: string | null;
  parsedPriceUsd: number | null;
  parsedBulkPriceUsd: number | null;
  parsedBulkPriceMinQuantity: number | null;
  parsedIsActive: boolean | null;
  quality: ImportRowQuality;
  qualityReason: string | null;
}

/** The importable product fields, in the order the CSV/XLSX template uses. */
export const IMPORT_FIELDS = [
  "code",
  "name",
  "dosageVial",
  "priceUsd",
  "bulkPriceUsd",
  "bulkPriceMinQuantity",
  "category",
  "description",
  "isActive",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

/** A raw record keyed by canonical field, as produced by any parser. */
export type ImportRecord = Partial<Record<ImportField, string | null>>;

/** Machine-readable header names written by the CSV/XLSX export. */
export const IMPORT_HEADER_LABELS: Record<ImportField, string> = {
  code: "code",
  name: "name",
  dosageVial: "dosage_vial",
  priceUsd: "price_usd",
  bulkPriceUsd: "bulk_price_usd",
  bulkPriceMinQuantity: "bulk_price_min_quantity",
  category: "category",
  description: "description",
  isActive: "is_active",
};

/** German column titles for the preview table. */
export const IMPORT_FIELD_TITLES: Record<ImportField, string> = {
  code: "CODE",
  name: "Name",
  dosageVial: "Dosage / Vial",
  priceUsd: "Normalpreis USD",
  bulkPriceUsd: "Mengenpreis USD",
  bulkPriceMinQuantity: "Mengenpreis ab",
  category: "Kategorie",
  description: "Beschreibung",
  isActive: "Status",
};

/**
 * Accepted header spellings per field. Both the machine-readable export
 * headers and the German titles a supplier price list is likely to use are
 * recognised, so an admin does not have to rename columns by hand.
 */
const HEADER_ALIASES: Record<ImportField, string[]> = {
  code: ["code", "artikelcode", "artikelnummer", "artnr", "artikelnr", "sku", "itemcode", "articlecode", "artikel"],
  name: ["name", "bezeichnung", "produkt", "produktname", "artikelname", "productname", "item"],
  dosageVial: ["dosagevial", "dosage", "vial", "dosierung", "dosis", "strength", "staerke", "dosageprovial"],
  priceUsd: [
    "priceusd",
    "price",
    "preis",
    "preisusd",
    "normalpreis",
    "normalpreisusd",
    "normalprice",
    "einzelpreis",
    "stueckpreis",
    "unitprice",
    "listprice",
    "listenpreis",
  ],
  bulkPriceUsd: [
    "bulkpriceusd",
    "bulkprice",
    "mengenpreis",
    "mengenpreisusd",
    "staffelpreis",
    "volumeprice",
    "grosspreis",
  ],
  bulkPriceMinQuantity: [
    "bulkpriceminquantity",
    "bulkminquantity",
    "bulkminqty",
    "mengenpreisab",
    "abmenge",
    "mengeab",
    "mindestmenge",
    "minmenge",
    "staffelab",
    "minquantity",
    "minqty",
    "bulkfrom",
    "abstueck",
  ],
  category: ["category", "kategorie", "gruppe", "produktgruppe", "warengruppe"],
  description: ["description", "beschreibung", "langtext", "hinweis", "details"],
  isActive: ["isactive", "status", "aktiv", "active", "aktivstatus"],
};

const HEADER_LOOKUP: Map<string, ImportField> = (() => {
  const map = new Map<string, ImportField>();
  for (const field of IMPORT_FIELDS) {
    for (const alias of HEADER_ALIASES[field]) {
      // First alias wins, so a more specific field defined earlier is never
      // overwritten by a looser alias of a later one.
      if (!map.has(alias)) map.set(alias, field);
    }
  }
  return map;
})();

/**
 * Reduces a header cell to a comparable key: lower-cased, diacritics folded,
 * and everything that is not a letter or digit removed. "Mengenpreis ab",
 * "MENGENPREIS_AB" and "Mengenpreis-ab" therefore all match.
 */
export function normalizeHeader(raw: string): string {
  return (
    raw
      .toLowerCase()
      // German umlauts expand rather than lose their diaeresis, so "Stärke"
      // and "Staerke" both reduce to the same key. This has to happen before
      // the generic diacritic fold below, which would turn "ä" into "a".
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
  );
}

/** Maps a header cell onto a canonical field, or null when unrecognised. */
export function matchImportField(rawHeader: string): ImportField | null {
  return HEADER_LOOKUP.get(normalizeHeader(rawHeader)) ?? null;
}

/** True when a row of cells looks like a header row rather than product data. */
export function looksLikeHeaderRow(cells: (string | null)[]): boolean {
  const matched = cells.filter((c) => c && matchImportField(c) !== null).length;
  return matched >= 2;
}

/** Result of reading one optional numeric cell. */
interface NumericCell {
  value: number | null;
  /** The cell had content, but it could not be read as a number. */
  invalid: boolean;
}

const CURRENCY_NOISE = /[$€\s\u00a0]|usd|eur|dollar|euro/gi;

/**
 * Parses a price token. Handles "$60", "60.00", "60,00 USD" and
 * "1.299,00"/"1,299.00": when both separators appear, the last one is the
 * decimal separator.
 */
export function parsePriceToken(raw: string | null | undefined): NumericCell {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return { value: null, invalid: false };

  let normalized = trimmed.replace(CURRENCY_NOISE, "");
  if (normalized === "") return { value: null, invalid: true };

  if (normalized.includes(",") && normalized.includes(".")) {
    normalized =
      normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  // A trailing separator ("55,") is a number mid-typing, not an error - the
  // inline preview would otherwise flash red on every decimal the admin types.
  normalized = normalized.replace(/\.$/, "");

  if (normalized === "" || !/^-?\d*\.?\d+$/.test(normalized)) return { value: null, invalid: true };

  const value = Number(normalized);
  if (!Number.isFinite(value)) return { value: null, invalid: true };
  return { value: Math.round(value * 10000) / 10000, invalid: false };
}

/**
 * Parses a threshold quantity. Tolerates the decorations a price list uses
 * around it ("ab 10", ">= 10", "10+", "10 Stk.") by taking the first number
 * in the cell.
 */
export function parseQuantityToken(raw: string | null | undefined): NumericCell {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return { value: null, invalid: false };

  const match = trimmed.replace(/\u00a0/g, " ").match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return { value: null, invalid: true };

  const value = Number(match[0].replace(",", "."));
  if (!Number.isFinite(value)) return { value: null, invalid: true };
  return { value: Math.round(value * 1000) / 1000, invalid: false };
}

const TRUE_TOKENS = new Set(["true", "1", "yes", "y", "ja", "j", "aktiv", "active", "verfuegbar"]);
const FALSE_TOKENS = new Set([
  "false",
  "0",
  "no",
  "n",
  "nein",
  "inaktiv",
  "inactive",
  "deaktiviert",
  "gesperrt",
  "archiviert",
]);

/** Parses a status cell into is_active. Returns null when the cell is empty. */
export function parseBooleanToken(raw: string | null | undefined): { value: boolean | null; invalid: boolean } {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return { value: null, invalid: false };
  const key = normalizeHeader(trimmed);
  if (TRUE_TOKENS.has(key)) return { value: true, invalid: false };
  if (FALSE_TOKENS.has(key)) return { value: false, invalid: false };
  return { value: null, invalid: true };
}

function cleanText(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Turns a canonical record into a validated import row.
 *
 * Severity rules:
 *  - error   -> the row cannot be imported as-is (missing key field, a cell
 *               that is present but unreadable, or half a bulk-price pair).
 *  - warning -> importable, but something is worth a human look.
 * Nothing is ever guessed: an unreadable price becomes an error with the raw
 * text preserved, never a made-up number.
 */
export function buildImportRow(
  record: ImportRecord,
  rowNumber: number,
  rawText: string,
): ParsedProductImportRow {
  const code = cleanText(record.code);
  const name = cleanText(record.name);
  const price = parsePriceToken(record.priceUsd);
  const bulkPrice = parsePriceToken(record.bulkPriceUsd);
  const bulkMin = parseQuantityToken(record.bulkPriceMinQuantity);
  const isActive = parseBooleanToken(record.isActive);

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!code) errors.push("Artikelcode fehlt.");
  if (!name) errors.push("Name fehlt.");

  if (price.invalid) errors.push("Normalpreis konnte nicht als Zahl gelesen werden.");
  else if (price.value == null) errors.push("Normalpreis fehlt.");
  else if (price.value < 0) errors.push("Normalpreis darf nicht negativ sein.");

  if (bulkPrice.invalid) errors.push("Mengenpreis konnte nicht als Zahl gelesen werden.");
  if (bulkMin.invalid) errors.push('"Mengenpreis ab" konnte nicht als Zahl gelesen werden.');

  // A bulk tier is only meaningful as a pair - half a pair is rejected here
  // exactly as the database check constraint would reject it.
  if (!bulkPrice.invalid && !bulkMin.invalid) {
    if (bulkPrice.value != null && bulkMin.value == null) {
      errors.push('Mengenpreis ohne "Mengenpreis ab" - bitte beide Werte angeben.');
    } else if (bulkMin.value != null && bulkPrice.value == null) {
      errors.push('"Mengenpreis ab" ohne Mengenpreis - bitte beide Werte angeben.');
    }
    if (bulkPrice.value != null && bulkPrice.value < 0) {
      errors.push("Mengenpreis darf nicht negativ sein.");
    }
    if (bulkMin.value != null && bulkMin.value <= 0) {
      errors.push('"Mengenpreis ab" muss größer als 0 sein.');
    }
  }

  if (isActive.invalid) errors.push("Status konnte nicht als aktiv/inaktiv gelesen werden.");

  if (errors.length === 0) {
    if (name && name.length < 2) warnings.push("Artikelname wirkt sehr kurz - bitte prüfen.");
    if (bulkPrice.value != null && bulkMin.value != null) {
      if (bulkMin.value <= 1) {
        warnings.push('Mengenpreis gilt bereits ab Menge 1 - "Mengenpreis ab" prüfen.');
      }
      if (price.value != null && bulkPrice.value > price.value) {
        warnings.push("Mengenpreis ist höher als der Normalpreis - bitte prüfen.");
      }
    }
  }

  const quality: ImportRowQuality = errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ok";

  return {
    rowNumber,
    rawText,
    parsedCode: code ? code.toUpperCase() : null,
    parsedName: name,
    parsedDosageVial: cleanText(record.dosageVial),
    parsedDescription: cleanText(record.description),
    parsedCategory: cleanText(record.category),
    parsedPriceUsd: price.value,
    parsedBulkPriceUsd: bulkPrice.value,
    parsedBulkPriceMinQuantity: bulkMin.value,
    parsedIsActive: isActive.value,
    quality,
    qualityReason: [...errors, ...warnings].join(" ") || null,
  };
}

/** A row that could not be interpreted at all, kept for the preview. */
export function unparsableImportRow(
  rowNumber: number,
  rawText: string,
  reason: string,
): ParsedProductImportRow {
  return {
    rowNumber,
    rawText,
    parsedCode: null,
    parsedName: null,
    parsedDosageVial: null,
    parsedDescription: null,
    parsedCategory: null,
    parsedPriceUsd: null,
    parsedBulkPriceUsd: null,
    parsedBulkPriceMinQuantity: null,
    parsedIsActive: null,
    quality: "error",
    qualityReason: reason,
  };
}

/** Any cell value a CSV or spreadsheet parser can hand us. */
export type ImportCellValue = string | number | boolean | Date | null | undefined;

/** How many leading rows are searched for the header (title rows above it). */
const TABLE_HEADER_SEARCH_DEPTH = 10;

function cellToText(value: ImportCellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

export interface ProductTableParseResult {
  rows: ParsedProductImportRow[];
  /** Which columns were recognised, for the "was my file understood" hint. */
  recognizedFields: ImportField[];
  /** Header cells that matched nothing, so nothing is dropped unnoticed. */
  unknownHeaders: string[];
}

/**
 * Parses a tabular product list (CSV rows or spreadsheet rows) by locating the
 * header row and mapping its cells onto canonical fields. Shared by the CSV and
 * XLSX importers so both understand exactly the same columns and aliases.
 */
export function parseProductTable(table: ImportCellValue[][]): ProductTableParseResult {
  const limit = Math.min(table.length, TABLE_HEADER_SEARCH_DEPTH);
  let headerIndex = -1;
  let headerCells: string[] = [];

  for (let i = 0; i < limit; i++) {
    const cells = (table[i] ?? []).map(cellToText);
    if (!looksLikeHeaderRow(cells)) continue;
    if (!cells.some((c) => matchImportField(c) === "code")) continue;
    headerIndex = i;
    headerCells = cells;
    break;
  }

  if (headerIndex === -1) {
    return { rows: [], recognizedFields: [], unknownHeaders: [] };
  }

  const columnFields: (ImportField | null)[] = headerCells.map((c) => matchImportField(c));
  const recognizedFields = Array.from(new Set(columnFields.filter((f): f is ImportField => f !== null)));
  const unknownHeaders = headerCells.filter((c, i) => c !== "" && columnFields[i] === null);

  const rows: ParsedProductImportRow[] = [];
  let rowNumber = 0;

  for (let i = headerIndex + 1; i < table.length; i++) {
    const cells = (table[i] ?? []).map(cellToText);
    if (cells.every((c) => c === "")) continue;
    if (looksLikeHeaderRow(cells)) continue;

    const record: ImportRecord = {};
    cells.forEach((cell, columnIndex) => {
      const field = columnFields[columnIndex];
      if (!field || cell === "") return;
      record[field] = record[field] ? `${record[field]} ${cell}` : cell;
    });

    rowNumber += 1;
    rows.push(buildImportRow(record, rowNumber, cells.filter(Boolean).join(" | ")));
  }

  return { rows: flagDuplicateCodes(rows), recognizedFields, unknownHeaders };
}

/** Flags rows whose parsed code appears more than once within the same batch. */
export function flagDuplicateCodes(rows: ParsedProductImportRow[]): ParsedProductImportRow[] {
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

/**
 * Re-validates a row after the admin edited it inline in the preview, so the
 * quality flag and the "Import anwenden" button always reflect what is
 * actually on screen.
 */
export function revalidateImportRow(row: ParsedProductImportRow): ParsedProductImportRow {
  return buildImportRow(
    {
      code: row.parsedCode,
      name: row.parsedName,
      dosageVial: row.parsedDosageVial,
      description: row.parsedDescription,
      category: row.parsedCategory,
      priceUsd: row.parsedPriceUsd == null ? null : String(row.parsedPriceUsd),
      bulkPriceUsd: row.parsedBulkPriceUsd == null ? null : String(row.parsedBulkPriceUsd),
      bulkPriceMinQuantity:
        row.parsedBulkPriceMinQuantity == null ? null : String(row.parsedBulkPriceMinQuantity),
      isActive: row.parsedIsActive == null ? null : String(row.parsedIsActive),
    },
    row.rowNumber,
    row.rawText,
  );
}
