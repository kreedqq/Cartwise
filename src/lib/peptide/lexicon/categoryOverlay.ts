import { getIdentitySubstance } from "@/lib/peptide/catalog";
import { PEPTIDE_CATEGORIES, type PeptideCategory } from "@/lib/peptide/types";

export type CategoryResolve =
  | { ok: true; category: PeptideCategory; source: "postgres" | "catalog-overlay" }
  | { ok: false };

function isPeptideCategory(value: string): value is PeptideCategory {
  return (PEPTIDE_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Categories live on `substances.category` (seeded from catalog.ts).
 * If Postgres is missing or invalid, overlay the identity catalog by slug.
 * Do not invent a category.
 */
export function resolvePublicCategory(
  slug: string,
  postgresCategory: string | null | undefined,
): CategoryResolve {
  const trimmed = (postgresCategory ?? "").trim();
  if (trimmed && isPeptideCategory(trimmed)) {
    return { ok: true, category: trimmed, source: "postgres" };
  }
  const identity = getIdentitySubstance(slug);
  if (identity?.category && isPeptideCategory(identity.category)) {
    return { ok: true, category: identity.category, source: "catalog-overlay" };
  }
  return { ok: false };
}
