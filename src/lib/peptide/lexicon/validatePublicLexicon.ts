import { PEPTIDE_SUBSTANCES_IDENTITY } from "@/lib/peptide/catalog";
import { resolvePublicCategory } from "@/lib/peptide/lexicon/categoryOverlay";
import type { PublicLexiconBundle, PublicLexiconFallback } from "@/lib/peptide/lexicon/types";

const EXPECTED_SLUGS = PEPTIDE_SUBSTANCES_IDENTITY.map((item) => item.slug);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validatePublicLexiconBundle(
  bundle: PublicLexiconBundle,
): { ok: true } | { ok: false; fallback: PublicLexiconFallback } {
  if (!Array.isArray(bundle.substances) || !Array.isArray(bundle.claims) || !Array.isArray(bundle.evidence)) {
    return { ok: false, fallback: { kind: "invalid", message: "unexpected public lexicon schema" } };
  }

  for (const row of bundle.substances) {
    if (!isRecord(row) || typeof row.slug !== "string" || typeof row.name !== "string" || !row.slug.trim() || !row.name.trim()) {
      return { ok: false, fallback: { kind: "invalid", message: "substance row missing slug or name" } };
    }
  }

  const slugs = new Set(bundle.substances.map((row) => row.slug));
  const missing = EXPECTED_SLUGS.filter((slug) => !slugs.has(slug));
  if (missing.length > 0) {
    return {
      ok: false,
      fallback: {
        kind: "incomplete",
        message: `postgres identity incomplete: missing ${missing.join(",")}`,
      },
    };
  }

  for (const slug of EXPECTED_SLUGS) {
    const row = bundle.substances.find((item) => item.slug === slug);
    const category = resolvePublicCategory(slug, row?.category);
    if (!category.ok) {
      return {
        ok: false,
        fallback: { kind: "incomplete", message: `missing category for ${slug}` },
      };
    }
  }

  return { ok: true };
}

export function expectedPublicSubstanceCount(): number {
  return EXPECTED_SLUGS.length;
}
