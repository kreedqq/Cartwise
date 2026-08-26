import Papa from "papaparse";

import {
  IMPORT_FIELDS,
  IMPORT_HEADER_LABELS,
  parseProductTable,
  type ImportField,
  type ProductTableParseResult,
} from "@/lib/productImportRow";
import type { Tables } from "@/types/database";

/** The header row written by the export and understood by the import. */
export const CSV_HEADERS: string[] = IMPORT_FIELDS.map((field) => IMPORT_HEADER_LABELS[field]);

/**
 * Parses a product CSV. The header row is matched against the alias table in
 * lib/productImportRow, so both the machine-readable export headers
 * (code,name,dosage_vial,price_usd,bulk_price_usd,bulk_price_min_quantity,
 * category,description,is_active) and German titles from a supplier price list
 * ("Artikelcode", "Mengenpreis ab", ...) are accepted in any column order.
 *
 * Every recognised column ends up in the returned rows - and therefore in the
 * import payload. Nothing is parsed and then dropped.
 */
export function parseProductCsv(text: string): ProductTableParseResult {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  return parseProductTable(result.data as string[][]);
}

function exportValue(product: Tables<"products">, field: ImportField): string | number | boolean {
  switch (field) {
    case "code":
      return product.code;
    case "name":
      return product.name;
    case "dosageVial":
      return product.dosage_vial ?? "";
    case "priceUsd":
      return product.price_usd;
    case "bulkPriceUsd":
      return product.bulk_price_usd ?? "";
    case "bulkPriceMinQuantity":
      return product.bulk_price_min_quantity ?? "";
    case "category":
      return product.category ?? "";
    case "description":
      return product.description ?? "";
    case "isActive":
      return product.is_active;
  }
}

/** Exports the full catalog in exactly the shape the importer reads back in. */
export function exportProductsToCsv(products: Tables<"products">[]): string {
  return Papa.unparse({
    fields: CSV_HEADERS,
    data: products.map((product) => IMPORT_FIELDS.map((field) => exportValue(product, field))),
  });
}

/**
 * The header row plus one filled example line, as a starting point for an
 * import. The example doubles as documentation of the expected value format
 * (plain decimal prices, a bulk pair, true/false status).
 */
export function buildProductCsvTemplate(): string {
  return Papa.unparse({
    fields: CSV_HEADERS,
    data: [
      ["ART-1001", "Beispielartikel", "10 mg / Vial", "60", "55", "10", "Beispielkategorie", "", "true"],
    ],
  });
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
