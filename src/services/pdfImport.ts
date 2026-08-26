import { supabase } from "@/lib/supabaseClient";
import { PDF_IMPORT_BUCKET } from "@/lib/constants";
import type { ParsedImportRow } from "@/pdf/parseProductLines";
import type { ImportRowAction, Tables } from "@/types/database";

export interface ReviewedImportRow extends ParsedImportRow {
  action: ImportRowAction;
  targetProductId: string | null;
}

export interface ApplyImportResult {
  importId: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

/** Uploads the raw PDF to the private admin-only storage bucket for auditability. */
export async function uploadImportFile(file: File): Promise<string> {
  const path = `admin-uploads/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from(PDF_IMPORT_BUCKET).upload(path, file, {
    contentType: file.type || "application/pdf",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Applies a reviewed batch (rows the admin has already inspected/edited and
 * assigned an action to) as one database transaction via the
 * apply_pdf_import RPC (see supabase/migrations/0009_import_rpc.sql).
 */
export async function applyImport(params: {
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  hasTextLayer: boolean | null;
  rows: ReviewedImportRow[];
}): Promise<ApplyImportResult> {
  const { data, error } = await supabase.rpc("apply_pdf_import", {
    _file_path: params.filePath,
    _file_name: params.fileName,
    _file_size_bytes: params.fileSizeBytes,
    _has_text_layer: params.hasTextLayer,
    _rows: params.rows.map((r) => ({
      row_number: r.rowNumber,
      raw_text: r.rawText,
      parsed_code: r.parsedCode,
      parsed_name: r.parsedName,
      parsed_price_usd: r.parsedPriceUsd,
      quality: r.quality,
      quality_reason: r.qualityReason,
      action: r.action,
      target_product_id: r.targetProductId,
    })),
  });
  if (error) throw error;
  const result = data as { importId: string; created: number; updated: number; skipped: number; failed: number };
  return {
    importId: result.importId,
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    failed: result.failed,
  };
}

export async function listImportHistory(): Promise<Tables<"pdf_imports">[]> {
  const { data, error } = await supabase.from("pdf_imports").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getImportRows(importId: string): Promise<Tables<"pdf_import_rows">[]> {
  const { data, error } = await supabase
    .from("pdf_import_rows")
    .select("*")
    .eq("import_id", importId)
    .order("row_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
