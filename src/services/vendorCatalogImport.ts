/**
 * Parses a dealer file for one shop area using the shared intelligent analysis layer.
 * Does not write to the database.
 */

import { VENDOR_CATALOG_ANALYZE } from "@/lib/importAnalyze";
import type { SheetInferenceResult } from "@/lib/importColumnInference";
import { VENDOR_PDF_UNREADABLE } from "@/lib/shop/vendorCatalog";
import type { ImportField, ParsedProductImportRow } from "@/lib/productImportRow";
import { extractPdfText } from "@/pdf/parsePdf";
import { parsePdfRows } from "@/pdf/parseProductLines";
import { parseProductCsv } from "@/services/csvProducts";
import { detectImportSourceKind, type ImportSourceKind } from "@/services/productImportSource";
import { parseProductXlsx } from "@/services/xlsxProducts";

export interface VendorFileParseResult {
  kind: ImportSourceKind;
  rows: ParsedProductImportRow[];
  recognizedFields: ImportField[];
  unknownHeaders: string[];
  inference: SheetInferenceResult;
}

export async function parseVendorCatalogFile(file: File): Promise<VendorFileParseResult> {
  const kind = detectImportSourceKind(file.name);
  if (!kind) {
    throw new Error("Nicht unterstütztes Format. Erlaubt sind CSV, Excel (XLSX/XLS) und PDF.");
  }

  if (kind === "pdf") {
    const extracted = await extractPdfText(file);
    if (!extracted.hasTextLayer || extracted.rows.length === 0) {
      throw new Error(VENDOR_PDF_UNREADABLE);
    }
    const rows = parsePdfRows(extracted.rows);
    const withCode = rows.filter((row) => row.parsedCode);
    if (withCode.length === 0) {
      throw new Error(VENDOR_PDF_UNREADABLE);
    }
    return {
      kind,
      rows,
      recognizedFields: [],
      unknownHeaders: [],
      inference: { columns: [], unrecognizedHeaders: [], mapping: [] },
    };
  }

  if (kind === "csv") {
    const parsed = parseProductCsv(await file.text(), VENDOR_CATALOG_ANALYZE);
    if (parsed.rows.length === 0) {
      throw new Error("Keine Datenzeilen erkannt. Die Datei braucht eine Kopfzeile mit Artikelcode und Preis.");
    }
    return {
      kind,
      rows: parsed.rows,
      recognizedFields: parsed.recognizedFields,
      unknownHeaders: parsed.unknownHeaders,
      inference: parsed.inference,
    };
  }

  const parsed = await parseProductXlsx(file, VENDOR_CATALOG_ANALYZE);
  if (parsed.rows.length === 0) {
    throw new Error(
      kind === "xls"
        ? "Die XLS-Datei konnte nicht gelesen werden. Bitte als XLSX oder CSV speichern."
        : "Keine Datenzeilen erkannt. Die Datei braucht eine Kopfzeile mit Artikelcode und Preis.",
    );
  }
  return {
    kind,
    rows: parsed.rows,
    recognizedFields: parsed.recognizedFields,
    unknownHeaders: parsed.unknownHeaders,
    inference: parsed.inference,
  };
}
