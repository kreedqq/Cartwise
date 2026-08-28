import {
  failingPublicSelectClient,
  fetchPublicLexicon,
  mockPublicSelectClient,
  type PublicLexiconSelectClient,
} from "@/lib/peptide/lexicon/fetchPublicLexicon";
import { legacyPublicLexiconCatalog } from "@/lib/peptide/lexicon/legacyCatalog";
import { logPublicLexiconFallback, logPublicLexiconRead } from "@/lib/peptide/lexicon/log";
import { mapPublicLexicon } from "@/lib/peptide/lexicon/mapPublicLexicon";
import type { PublicLexiconCatalog, PublicLexiconFallback } from "@/lib/peptide/lexicon/types";
import { validatePublicLexiconBundle } from "@/lib/peptide/lexicon/validatePublicLexicon";
import { lexiconUsesPostgresIdentity, researchDbMode, type ResearchDbMode } from "@/lib/peptide/persistence/researchDbMode";

function withFallback(fallback: PublicLexiconFallback): PublicLexiconCatalog {
  logPublicLexiconFallback(fallback);
  const legacy = legacyPublicLexiconCatalog();
  return { ...legacy, source: "legacy", fallback };
}

/**
 * Exclusive read: Postgres success + valid bundle, or the full legacy catalog.
 * Never mixes fields from both sources on one request.
 */
export async function resolvePublicLexicon(options: {
  client: PublicLexiconSelectClient;
  mode?: ResearchDbMode;
  timeoutMs?: number;
  env?: { VITE_RESEARCH_DB_MODE?: string };
}): Promise<PublicLexiconCatalog> {
  const mode = options.mode ?? researchDbMode(options.env);
  if (mode === "legacy" || !lexiconUsesPostgresIdentity(options.env ?? { VITE_RESEARCH_DB_MODE: mode })) {
    const catalog = legacyPublicLexiconCatalog();
    logPublicLexiconRead("legacy", catalog.substances.length);
    return catalog;
  }

  const fetched = await fetchPublicLexicon(options.client, { timeoutMs: options.timeoutMs });
  if (!fetched.ok) {
    return withFallback({ kind: fetched.kind, message: fetched.message });
  }

  const valid = validatePublicLexiconBundle(fetched.bundle);
  if (!valid.ok) {
    return withFallback(valid.fallback);
  }

  const mapped = mapPublicLexicon(fetched.bundle);
  if (mapped.substances.length !== 27) {
    return withFallback({
      kind: "incomplete",
      message: `mapped public substances ${mapped.substances.length}, expected 27`,
    });
  }

  const catalog: PublicLexiconCatalog = {
    substances: mapped.substances,
    profiles: mapped.profiles,
    source: "postgres",
    fallback: null,
  };
  logPublicLexiconRead("postgres", catalog.substances.length);
  return catalog;
}

export { failingPublicSelectClient, mockPublicSelectClient };
export type { PublicLexiconSelectClient };
