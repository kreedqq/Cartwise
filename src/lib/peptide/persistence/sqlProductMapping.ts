/** Mirrors 0024 prefix/glow plus 0029 explicit product_substances. Client mapper stays legacy. */

import {
  EXPLICIT_PRODUCT_MAPPINGS,
  UNMAP_PREFIX_CODES,
  UNRESOLVED_PRODUCT_MAPPINGS,
} from "@/lib/peptide/persistence/explicitProductMappings";

export function sqlPrefixMappingSlug(code: string): string | null {
  const value = code.trim();
  if (/^RT[0-9]/i.test(value)) return "retatrutide";
  if (/^TZ[0-9]/i.test(value)) return "tirzepatide";
  if (/^SM[0-9]/i.test(value)) return "semaglutide";
  if (/^LR[0-9]/i.test(value)) return "liraglutide";
  if (/^CJC/i.test(value)) return "cjc-1295";
  if (/^IPA/i.test(value)) return "ipamorelin";
  if (/^BPC/i.test(value)) return "bpc-157";
  if (/^TB5/i.test(value)) return "tb-500";
  if (/^GHK/i.test(value)) return "ghk-cu";
  if (/^MOT/i.test(value)) return "mots-c";
  if (/^AOD/i.test(value)) return "aod-9604";
  if (/^MT2/i.test(value)) return "melanotan-ii";
  if (/^MT[0-9]/i.test(value)) return "melanotan-ii";
  if (/^KPV/i.test(value)) return "kpv";
  if (/^IGF/i.test(value)) return "igf-1-lr3";
  return null;
}

export function sqlKlowNameMappingSlug(name: string): boolean {
  const value = name.toLowerCase();
  return value.includes("klow");
}

export function sqlGlowNameMappingSlug(name: string): boolean {
  const value = name.toLowerCase();
  if (sqlKlowNameMappingSlug(value)) return false;
  return value.includes("ghk") && value.includes("tb") && value.includes("bpc");
}

/** 0024-only prefix + glow (no explicit rows). */
export function sqlMappingSlug(product: { code?: string | null; name?: string | null }): string | null {
  const prefix = sqlPrefixMappingSlug(product.code ?? "");
  if (prefix) return prefix;
  if (sqlKlowNameMappingSlug(product.name ?? "")) return "klow-blend";
  if (sqlGlowNameMappingSlug(product.name ?? "")) return "glow-blend";
  return null;
}

/** Intended Postgres mapping after 0024 + 0029. */
export function postgresMappingSlug(product: { code?: string | null; name?: string | null }): string | null {
  const code = (product.code ?? "").trim().toUpperCase();
  if (UNMAP_PREFIX_CODES.some((row) => row.toUpperCase() === code)) return null;
  if (UNRESOLVED_PRODUCT_MAPPINGS.some((row) => row.code.toUpperCase() === code)) return null;
  const explicit = EXPLICIT_PRODUCT_MAPPINGS.find((row) => row.code.toUpperCase() === code);
  if (explicit) return explicit.slug;
  return sqlMappingSlug(product);
}

export interface ProductMappingRow {
  code: string;
  name: string;
  client: string | null;
  sql0024: string | null;
  database: string | null;
  expected: string | null;
  confidence: "high" | "unresolved" | "none";
  match: "MATCH" | "DIVERGE";
}

export function expectedMappingSlug(product: { code: string; name: string }): string | null {
  return postgresMappingSlug(product);
}

export function mappingConfidence(product: { code: string; name: string }): ProductMappingRow["confidence"] {
  const code = product.code.toUpperCase();
  if (UNRESOLVED_PRODUCT_MAPPINGS.some((row) => row.code.toUpperCase() === code)) return "unresolved";
  if (UNMAP_PREFIX_CODES.some((row) => row.toUpperCase() === code)) return "unresolved";
  if (expectedMappingSlug(product)) return "high";
  return "none";
}
