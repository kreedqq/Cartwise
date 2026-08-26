import Papa from "papaparse";

import { normalizeProductCode } from "@/lib/money";
import type { Tables } from "@/types/database";

export interface CsvProductRow {
  rowNumber: number;
  code: string | null;
  name: string | null;
  description: string | null;
  category: string | null;
  priceUsd: number | null;
  isActive: boolean;
  error: string | null;
}

const EXPECTED_HEADERS = ["code", "name", "description", "category", "price_usd", "is_active"];

/**
 * Parses a product CSV export/import file. Expected header row:
 * code,name,description,category,price_usd,is_active
 */
export function parseProductCsv(text: string): CsvProductRow[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  return result.data.map((raw, index) => {
    const code = raw.code?.trim() ? normalizeProductCode(raw.code) : null;
    const name = raw.name?.trim() || null;
    const priceRaw = raw.price_usd?.trim().replace(",", ".");
    const priceUsd = priceRaw ? Number(priceRaw) : null;
    const isActive = raw.is_active == null || raw.is_active.trim() === "" ? true : parseBoolean(raw.is_active);

    let error: string | null = null;
    if (!code) error = "Artikelcode fehlt.";
    else if (!name) error = "Name fehlt.";
    else if (priceUsd == null || !Number.isFinite(priceUsd) || priceUsd < 0) error = "Preis ist ungültig.";

    return {
      rowNumber: index + 1,
      code,
      name,
      description: raw.description?.trim() || null,
      category: raw.category?.trim() || null,
      priceUsd,
      isActive,
      error,
    };
  });
}

function parseBoolean(value: string): boolean {
  return ["true", "1", "yes", "ja", "aktiv"].includes(value.trim().toLowerCase());
}

export function exportProductsToCsv(products: Tables<"products">[]): string {
  return Papa.unparse({
    fields: EXPECTED_HEADERS,
    data: products.map((p) => [p.code, p.name, p.description ?? "", p.category ?? "", p.price_usd, p.is_active]),
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
