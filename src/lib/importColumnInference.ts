import type { ConfidenceLevel } from "@/lib/importConfidence";
import { confidenceFromScore } from "@/lib/importConfidence";
import { parsePriceToken, parseQuantityToken } from "@/lib/productImportRow";
import {
  IMPORT_FIELDS,
  matchImportField,
  normalizeHeader,
  type ImportField,
} from "@/lib/productImportRow";

export interface ColumnInference {
  columnIndex: number;
  headerLabel: string;
  assignedField: ImportField | null;
  confidence: ConfidenceLevel;
  /** Competing field if ambiguous. */
  alternateField: ImportField | null;
}

export interface SheetInferenceResult {
  columns: ColumnInference[];
  unrecognizedHeaders: string[];
  mapping: (ImportField | null)[];
}

const CODE_CELL = /^[A-Z0-9][A-Z0-9._-]{1,15}$/i;
const VARIANT_CELL = /\d+\s*(mg|mcg|ml|iu).*(vial|tablet|\*|×|x)/i;

function headerScore(header: string, field: ImportField): number {
  const direct = matchImportField(header);
  if (direct === field) return 1;
  const norm = normalizeHeader(header);
  if (field === "priceUsd" && /preis.*10er|10erkit|kit.*preis|pro10/.test(norm)) return 0.85;
  if (field === "code" && /sku|artikelnummer|abkuerzung|productcode|productcode/.test(norm)) return 0.8;
  if (field === "name" && /produktname|produkt|peptide|artikel|^product$/.test(norm)) return 0.75;
  if (field === "dosageVial" && /variant|dosage|specification|mg.*vial|vial/.test(norm)) return 0.75;
  if (field === "priceUsd" && /^price$|normalpreis/.test(norm)) return 0.8;
  return 0;
}

function sampleScore(samples: string[], field: ImportField): number {
  if (samples.length === 0) return 0;
  let hits = 0;
  for (const raw of samples) {
    const cell = (raw ?? "").trim();
    if (!cell) continue;
    if (field === "code" && CODE_CELL.test(cell)) hits++;
    if (field === "priceUsd" || field === "bulkPriceUsd") {
      const p = parsePriceToken(cell);
      if (p.value != null && !p.invalid) hits++;
    }
    if (field === "dosageVial" && (VARIANT_CELL.test(cell) || cell.includes("*"))) hits++;
    if (field === "name" && cell.length > 2 && !parsePriceToken(cell).value) hits++;
    if (field === "bulkPriceMinQuantity") {
      const q = parseQuantityToken(cell);
      if (q.value != null) hits++;
    }
  }
  return hits / samples.length;
}

/**
 * Infer column → field mapping from header row + sample data rows.
 */
export function inferSheetColumns(headers: string[], sampleRows: string[][]): SheetInferenceResult {
  const columns: ColumnInference[] = [];
  const mapping: (ImportField | null)[] = [];

  headers.forEach((headerLabel, columnIndex) => {
    const samples = sampleRows.map((row) => row[columnIndex] ?? "").filter((c) => c.trim() !== "");
    const scores = IMPORT_FIELDS.map((field) => {
      const h = headerScore(headerLabel, field);
      const s = sampleScore(samples, field);
      return { field, score: h * 0.65 + s * 0.35 };
    }).sort((a, b) => b.score - a.score);

    const best = scores[0];
    const second = scores[1];
    const gap = best && second ? best.score - second.score : best?.score ?? 0;
    let assigned: ImportField | null = null;
    let confidence: ConfidenceLevel = "low";
    let alternate: ImportField | null = null;

    if (best && best.score >= 0.35) {
      const headerOnly = headerScore(headerLabel, best.field);
      // Sample-only guesses (e.g. vendor name in an unknown column) need stronger signal.
      if (headerOnly > 0 || best.score >= 0.5) {
        assigned = best.field;
        confidence = confidenceFromScore(best.score);
        if (gap < 0.12 && second && second.score >= 0.35) {
          confidence = "medium";
          alternate = second.field;
        }
      }
    }

    columns.push({
      columnIndex,
      headerLabel: headerLabel.trim() || `(Spalte ${columnIndex + 1})`,
      assignedField: assigned,
      confidence,
      alternateField: alternate,
    });
    mapping[columnIndex] = assigned;
  });

  const fieldBest = new Map<ImportField, { columnIndex: number; score: number }>();
  columns.forEach((col) => {
    if (!col.assignedField) return;
    const samples = sampleRows.map((row) => row[col.columnIndex] ?? "").filter((c) => c.trim() !== "");
    const h = headerScore(col.headerLabel, col.assignedField);
    const s = sampleScore(samples, col.assignedField);
    const score = h * 0.65 + s * 0.35;
    const prev = fieldBest.get(col.assignedField);
    if (!prev || score > prev.score) {
      fieldBest.set(col.assignedField, { columnIndex: col.columnIndex, score });
    }
  });
  columns.forEach((col) => {
    if (!col.assignedField) return;
    const winner = fieldBest.get(col.assignedField);
    if (winner && winner.columnIndex !== col.columnIndex) {
      col.assignedField = null;
      col.confidence = "low";
      col.alternateField = null;
      mapping[col.columnIndex] = null;
    }
  });

  const unrecognizedHeaders = columns
    .filter((c) => c.assignedField === null)
    .map((c) => c.headerLabel);

  return { columns, unrecognizedHeaders, mapping };
}

export function inferenceSummary(columns: ColumnInference[]) {
  const recognized = columns.filter((c) => c.assignedField);
  const needsReview = columns.filter((c) => c.confidence === "medium" || c.confidence === "low");
  return {
    totalColumns: columns.length,
    recognizedFields: recognized.length,
    reviewColumns: needsReview.length,
  };
}
