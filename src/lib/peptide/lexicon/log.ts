import type { PublicLexiconFallback, PublicLexiconSource } from "@/lib/peptide/lexicon/types";

const SECRET_PATTERN = /service_role|anon_key|jwt|bearer\s+[a-z0-9._-]+|password|token/i;

function sanitize(value: string): string {
  return SECRET_PATTERN.test(value) ? "[redacted]" : value;
}

/** Explicit exclusive-fallback log. Never mixes Postgres with legacy fields. */
export function logPublicLexiconFallback(fallback: PublicLexiconFallback): void {
  console.warn("[peptide-public-lexicon]", {
    source: "peptide-public-lexicon",
    event: "exclusive-legacy-fallback",
    kind: fallback.kind,
    message: sanitize(fallback.message).slice(0, 200),
  });
}

export function logPublicLexiconRead(source: PublicLexiconSource, substanceCount: number): void {
  console.info("[peptide-public-lexicon]", {
    source: "peptide-public-lexicon",
    event: "read",
    displaySource: source,
    substanceCount,
  });
}
