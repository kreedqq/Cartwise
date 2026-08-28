/** Identifier normalization for research sources/studies. No aggressive title matching. */

const HUDSON_EXCLUDED_NCTS = ["NCT07487363", "NCT07437560"] as const;

export const EXCLUDED_STUDY_NCTS: readonly string[] = HUDSON_EXCLUDED_NCTS;

export function normalizeDoi(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;
  value = value.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  value = value.replace(/^doi:\s*/i, "");
  value = value.replace(/\s+/g, "");
  if (!value) return null;
  return value.toLowerCase();
}

export function normalizePmid(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.trim().replace(/^pmid[:\s]*/i, "").replace(/[^\d]/g, "");
  if (!digits) return null;
  return digits;
}

export function normalizeNct(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const compact = raw.trim().replace(/\s+/g, "").toUpperCase();
  const match = /^NCT(\d{8})$/.exec(compact);
  return match ? `NCT${match[1]}` : null;
}

export function isExcludedNct(raw: string | null | undefined): boolean {
  const nct = normalizeNct(raw);
  return nct !== null && EXCLUDED_STUDY_NCTS.includes(nct);
}

/** Compile-script fictional/example titles — not a loose /demo/ match (that hits "Demonstrating"). */
export function isFictionalOrExampleStudyTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  return /mock study|fictional study|example of a ClinicalTrials\.gov-style/i.test(title);
}

export function inferRegulatoryAuthority(
  url: string | null | undefined,
): "fda" | "ema" | "bfarm" | "mhra" | null {
  const value = (url ?? "").toLowerCase();
  if (!value) return null;
  if (value.includes("ema.europa.eu")) return "ema";
  if (value.includes("bfarm.de")) return "bfarm";
  if (value.includes("mhra.gov") || value.includes("gov.uk/mhra") || value.includes("yellowcard")) {
    return "mhra";
  }
  if (
    value.includes("fda.gov") ||
    value.includes("dailymed.nlm.nih.gov") ||
    value.includes("accessdata.fda.gov") ||
    value.includes("open.fda.gov")
  ) {
    return "fda";
  }
  return null;
}
