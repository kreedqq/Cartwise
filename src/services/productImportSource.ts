/**
 * Which kinds of file the product import accepts, and how each maps onto a
 * parser and a storage content type. Keeping this in one place means the file
 * picker, the upload and the storage bucket's MIME allowlist (migration 0014)
 * can never drift apart.
 */

export type ImportSourceKind = "pdf" | "csv" | "xlsx";

interface SourceDefinition {
  kind: ImportSourceKind;
  extension: string;
  contentType: string;
  label: string;
}

const SOURCES: SourceDefinition[] = [
  { kind: "pdf", extension: ".pdf", contentType: "application/pdf", label: "PDF" },
  { kind: "csv", extension: ".csv", contentType: "text/csv", label: "CSV" },
  {
    kind: "xlsx",
    extension: ".xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    label: "Excel (XLSX)",
  },
];

/** Value for an <input type="file" accept="..."> attribute. */
export const ACCEPTED_IMPORT_ACCEPT = SOURCES.map((s) => s.extension).join(",");

export const ACCEPTED_IMPORT_LABEL = SOURCES.map((s) => s.label).join(", ");

/**
 * Detects the source kind from the file extension rather than file.type:
 * browsers report XLSX inconsistently (and sometimes as an empty string),
 * while the extension is what the admin actually chose.
 */
export function detectImportSourceKind(fileName: string): ImportSourceKind | null {
  const lower = fileName.toLowerCase();
  return SOURCES.find((s) => lower.endsWith(s.extension))?.kind ?? null;
}

/**
 * The content type to upload with. Set explicitly so the bucket's MIME
 * allowlist stays tight instead of having to permit application/octet-stream.
 */
export function contentTypeForImportFile(fileName: string): string {
  const kind = detectImportSourceKind(fileName);
  return SOURCES.find((s) => s.kind === kind)?.contentType ?? "application/octet-stream";
}
