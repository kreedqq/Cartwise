import { readSheet } from "read-excel-file/browser";

import { parseProductTable, type ImportCellValue, type ProductTableParseResult } from "@/lib/productImportRow";

/**
 * Reads the first worksheet of an XLSX file and runs it through the same
 * table parser as the CSV import, so a spreadsheet and a CSV with the same
 * columns produce identical import rows.
 *
 * read-excel-file is used rather than a full spreadsheet library because the
 * import only ever needs to *read* rows: it keeps the admin bundle small and
 * avoids the parser advisories of the SheetJS releases published on npm.
 */
export async function parseProductXlsx(file: File): Promise<ProductTableParseResult> {
  const rows = await readSheet(file, 1);
  return parseProductTable(rows as ImportCellValue[][]);
}
