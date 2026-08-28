import { PEPTIDE_SUBSTANCES } from "@/lib/peptide/catalog";
import { listPublishedProfiles } from "@/lib/peptide/profiles";
import type { PublicLexiconCatalog } from "@/lib/peptide/lexicon/types";

export function legacyPublicLexiconCatalog(): PublicLexiconCatalog {
  return {
    substances: [...PEPTIDE_SUBSTANCES],
    profiles: new Map(listPublishedProfiles().map((profile) => [profile.slug, profile])),
    source: "legacy",
    fallback: null,
  };
}
