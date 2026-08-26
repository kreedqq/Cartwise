/**
 * Turns extracted PDF (or pasted) text into candidate product rows.
 *
 * Two strategies, in order of reliability:
 *
 *  1. Column layout (preferred). If a table header can be found, every data
 *     row is aligned against the header's x coordinates, so each cell lands in
 *     the column it visually sits under. This handles the eight-column price
 *     list (code, name, dosage, normal price, bulk price, threshold, category,
 *     status) that a single regex could never separate reliably.
 *  2. Positional fallback. Without a header the line is split on wide
 *     whitespace runs: first cell is the code, trailing numeric cells are
 *     prices, the rest is the name. Anything ambiguous becomes a warning.
 *
 * Neither strategy ever guesses a price: every row keeps its raw text and a
 * quality flag so the mandatory admin review (see docs/KONZEPT.md, PDF-Import)
 * catches mistakes before anything reaches the database.
 */

import {
  buildImportRow,
  flagDuplicateCodes,
  looksLikeHeaderRow,
  matchImportField,
  parsePriceToken,
  unparsableImportRow,
  type ImportField,
  type ImportRecord,
  type ParsedProductImportRow,
} from "@/lib/productImportRow";
import type { PdfCell, PdfRow } from "@/pdf/parsePdf";

export type { ParsedProductImportRow } from "@/lib/productImportRow";
export { flagDuplicateCodes };

export interface DetectedColumn {
  field: ImportField;
  xStart: number;
  xEnd: number;
}

export interface ColumnLayout {
  columns: DetectedColumn[];
  /** Index into the rows array of the header row itself. */
  headerRowIndex: number;
}

/** How many rows from the top are searched for a table header. */
const HEADER_SEARCH_DEPTH = 40;

/**
 * Looks for a table header row. A row qualifies when at least three of its
 * cells map onto known product fields and an article-code column is among
 * them - without a code column an import could not be keyed at all.
 */
export function detectColumnLayout(rows: PdfRow[]): ColumnLayout | null {
  const limit = Math.min(rows.length, HEADER_SEARCH_DEPTH);

  for (let index = 0; index < limit; index++) {
    const row = rows[index];
    const matched: DetectedColumn[] = [];
    const seen = new Set<ImportField>();

    for (const cell of row.cells) {
      const field = matchImportField(cell.text);
      if (field && !seen.has(field)) {
        seen.add(field);
        matched.push({ field, xStart: cell.x, xEnd: cell.xEnd });
      }
    }

    if (matched.length >= 3 && seen.has("code")) {
      return {
        columns: matched.sort((a, b) => a.xStart - b.xStart),
        headerRowIndex: index,
      };
    }
  }

  return null;
}

/**
 * Assigns a cell to a column by comparing the cell's horizontal centre against
 * the midpoints between neighbouring header columns. Centres (rather than left
 * edges) keep right-aligned number columns in the right band.
 */
function columnForCell(cell: PdfCell, columns: DetectedColumn[]): ImportField | null {
  if (columns.length === 0) return null;
  const centre = (cell.x + cell.xEnd) / 2;

  for (let i = 0; i < columns.length; i++) {
    const upperBound =
      i === columns.length - 1
        ? Number.POSITIVE_INFINITY
        : (columns[i].xEnd + columns[i + 1].xStart) / 2;
    if (centre < upperBound) return columns[i].field;
  }
  return columns[columns.length - 1].field;
}

/**
 * Parses positioned PDF rows using the detected table header. Rows that carry
 * no recognisable product data at all (page numbers, footers, repeated
 * headers) are dropped rather than shown as errors; anything that looks like a
 * product but is incomplete is kept so the admin can fix it in the preview.
 */
export function parsePdfRows(rows: PdfRow[]): ParsedProductImportRow[] {
  const layout = detectColumnLayout(rows);
  if (!layout) return parseAllLines(rows.map((r) => r.text));

  const parsed: ParsedProductImportRow[] = [];
  let rowNumber = 0;

  for (let index = layout.headerRowIndex + 1; index < rows.length; index++) {
    const row = rows[index];
    if (row.cells.length === 0) continue;
    // A price list repeats its header on every page.
    if (looksLikeHeaderRow(row.cells.map((c) => c.text))) continue;

    const record: ImportRecord = {};
    for (const cell of row.cells) {
      const field = columnForCell(cell, layout.columns);
      if (!field) continue;
      record[field] = record[field] ? `${record[field]} ${cell.text}` : cell.text;
    }

    const hasAnySignal = Boolean(record.code || record.name || record.priceUsd);
    if (!hasAnySignal) continue;

    rowNumber += 1;
    parsed.push(buildImportRow(record, rowNumber, row.text));
  }

  return flagDuplicateCodes(parsed);
}

/** Splits a plain text line into cells the way a table would render them. */
function splitLineIntoCells(trimmed: string): string[] {
  const wide = trimmed
    .split(/\t+|\s{2,}|;/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (wide.length >= 2) return wide;
  return trimmed.split(/\s+/).filter(Boolean);
}

const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-_./]{0,63}$/;

function isNumericCell(text: string): boolean {
  const parsed = parsePriceToken(text);
  return !parsed.invalid && parsed.value != null;
}

/**
 * Positional fallback parser for a single line of text (also used for the
 * "paste the text manually" path when a PDF has no text layer).
 *
 * Trailing numeric cells are interpreted by count, following the column order
 * of the export template:
 *   1 number  -> normal price
 *   2 numbers -> normal price + one unclaimed number (warning, never guessed
 *                into the bulk tier)
 *   3 numbers -> normal price, bulk price, bulk threshold (warning)
 */
export function parseProductLine(rawText: string, rowNumber: number): ParsedProductImportRow {
  const trimmed = rawText.trim();

  if (trimmed === "") {
    return unparsableImportRow(rowNumber, rawText, "Leere Zeile.");
  }

  const cells = splitLineIntoCells(trimmed);

  if (looksLikeHeaderRow(cells)) {
    return unparsableImportRow(
      rowNumber,
      rawText,
      "Sieht nach einer Tabellenüberschrift aus, keine Artikeldaten.",
    );
  }

  if (cells.length < 3 || !CODE_PATTERN.test(cells[0])) {
    return unparsableImportRow(
      rowNumber,
      rawText,
      "Zeile konnte nicht als Artikelcode / Name / Preis erkannt werden.",
    );
  }

  // Collect trailing numeric cells from the right.
  const numbers: string[] = [];
  let end = cells.length;
  while (end > 1 && isNumericCell(cells[end - 1])) {
    numbers.unshift(cells[end - 1]);
    end -= 1;
  }

  if (numbers.length === 0) {
    return unparsableImportRow(
      rowNumber,
      rawText,
      "Zeile konnte nicht als Artikelcode / Name / Preis erkannt werden.",
    );
  }

  const code = cells[0];
  const name = cells.slice(1, end).join(" ").trim();

  const record: ImportRecord = { code, name: name || null };
  let ambiguity: string | null = null;

  if (numbers.length === 1) {
    record.priceUsd = numbers[0];
  } else if (numbers.length === 2) {
    record.priceUsd = numbers[0];
    ambiguity = `Zusätzliche Zahlenspalte erkannt ("${numbers[1]}") - bitte Mengenpreis und "Mengenpreis ab" manuell prüfen.`;
  } else {
    record.priceUsd = numbers[numbers.length - 3];
    record.bulkPriceUsd = numbers[numbers.length - 2];
    record.bulkPriceMinQuantity = numbers[numbers.length - 1];
    ambiguity = "Mengenpreis wurde anhand der Spaltenreihenfolge erkannt - bitte prüfen.";
  }

  const row = buildImportRow(record, rowNumber, rawText);
  if (ambiguity && row.quality === "ok") {
    return { ...row, quality: "warning", qualityReason: ambiguity };
  }
  if (ambiguity && row.quality === "warning") {
    return { ...row, qualityReason: `${row.qualityReason ?? ""} ${ambiguity}`.trim() };
  }
  return row;
}

export function parseAllLines(lines: string[]): ParsedProductImportRow[] {
  return lines.map((line, i) => parseProductLine(line, i + 1));
}
