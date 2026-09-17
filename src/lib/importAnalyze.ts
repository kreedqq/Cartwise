/**
 * Shared spreadsheet analysis for global product import and vendor area catalogs.
 * Persistence differs (apply_pdf_import vs apply_vendor_catalog); analysis does not.
 */
import {
  parseProductTableIntelligent,
  type IntelligentParseResult,
} from "@/lib/importIntelligentParse";
import type { ImportCellValue } from "@/lib/productImportRow";

export interface ImportAnalyzeOptions {
  /**
   * Global master import: normalize merchant variant strings (e.g. 10mg*10vials → display form).
   * Vendor catalogs keep the dealer file string for audit/diff.
   */
  normalizeVariantDisplay?: boolean;
}

export const GLOBAL_IMPORT_ANALYZE: ImportAnalyzeOptions = { normalizeVariantDisplay: true };
export const VENDOR_CATALOG_ANALYZE: ImportAnalyzeOptions = { normalizeVariantDisplay: false };

export function analyzeProductTable(
  table: ImportCellValue[][],
  options: ImportAnalyzeOptions = GLOBAL_IMPORT_ANALYZE,
): IntelligentParseResult {
  return parseProductTableIntelligent(table, options);
}
