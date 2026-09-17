import { inferSheetColumns, type SheetInferenceResult } from "@/lib/importColumnInference";
import { parseVariantPackString } from "@/lib/importVariantParse";
import {
  findProductTableHeaderIndex,
  parseProductTableWithColumnMapping,
  type ImportCellValue,
  type ProductTableParseResult,
} from "@/lib/productImportRow";

function cellToText(value: ImportCellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

export interface IntelligentParseResult extends ProductTableParseResult {
  inference: SheetInferenceResult;
  headerIndex: number;
  headerCells: string[];
}

export interface IntelligentParseOptions {
  /** When true, normalize mg*vials strings for global catalog import. */
  normalizeVariantDisplay?: boolean;
}

export function parseProductTableIntelligent(
  table: ImportCellValue[][],
  options: IntelligentParseOptions = {},
): IntelligentParseResult {
  const normalizeVariantDisplay = options.normalizeVariantDisplay !== false;
  const located = findProductTableHeaderIndex(table);
  if (!located) {
    return {
      rows: [],
      recognizedFields: [],
      unknownHeaders: [],
      inference: { columns: [], unrecognizedHeaders: [], mapping: [] },
      headerIndex: -1,
      headerCells: [],
    };
  }

  const { headerIndex, headerCells } = located;
  const sampleRows = table
    .slice(headerIndex + 1, headerIndex + 8)
    .map((row) => (row ?? []).map(cellToText));

  const inference = inferSheetColumns(headerCells, sampleRows);
  const parsed = parseProductTableWithColumnMapping(table, headerIndex, headerCells, inference.mapping);

  const rows = normalizeVariantDisplay
    ? parsed.rows.map((row) => {
        if (!row.parsedDosageVial) return row;
        const variant = parseVariantPackString(row.parsedDosageVial);
        if (!variant.dosageVial) return row;
        return { ...row, parsedDosageVial: variant.dosageVial };
      })
    : parsed.rows;

  return {
    ...parsed,
    rows,
    inference,
    headerIndex,
    headerCells,
  };
}
