import type { DualReadFallbackKind } from "@/lib/peptide/persistence/dualRead/types";
import type { PeptideSubstance } from "@/lib/peptide/types";
import type { SubstanceProfile } from "@/lib/peptide/profiles/types";

export type PublicLexiconSource = "postgres" | "legacy";

export type PublicLexiconFallbackKind = Exclude<DualReadFallbackKind, null> | "invalid" | "incomplete";

export interface PublicLexiconFallback {
  kind: PublicLexiconFallbackKind;
  message: string;
}

export interface PublicLexiconBundle {
  substances: Array<{
    id: string;
    slug: string;
    name: string;
    display_name: string;
    category: string;
    molecule_type: string | null;
    chemical_class: string | null;
    cas_number: string | null;
    identity_note: string | null;
    status: string;
    updated_at: string | null;
  }>;
  aliases: Array<{ substance_id: string; alias: string; alias_type: string }>;
  components: Array<{ blend_id: string; component_id: string; sort_order: number }>;
  sources: Array<{
    id: string;
    source_type: string;
    title: string;
    publisher: string | null;
    publication_date: string | null;
    access_date: string | null;
    url: string;
    doi: string | null;
    pmid: string | null;
    nct_id: string | null;
    legacy_ids: string[];
    review_status?: string | null;
    connector?: string | null;
  }>;
  sourceSubstances: Array<{ source_id: string; substance_id: string; legacy_source_id: string }>;
  studies: Array<{
    id: string;
    nct_id: string;
    title: string;
    sponsor: string | null;
    phase: string | null;
    status: string | null;
    enrollment: number | null;
    start_date: string | null;
    completion_date: string | null;
    last_updated: string | null;
    has_results: boolean;
    source_url: string;
    review_status?: string | null;
    intervention?: string | null;
    condition?: string | null;
  }>;
  studySubstances: Array<{ study_id: string; substance_id: string }>;
  claims: Array<{
    id: string;
    stable_key: string;
    substance_id: string;
    claim_type: string;
    statement: string;
    status: string;
    safety_category: string | null;
  }>;
  claimSources: Array<{ claim_id: string; source_id: string; study_id: string | null }>;
  evidence: Array<{
    claim_id: string;
    evidence_level: string | null;
    confidence: string | null;
    evidence_type: string;
    review_status: string;
  }>;
  regulatory: Array<{
    stable_key: string;
    substance_id: string;
    authority: string;
    region: string;
    status: string;
    indication: string | null;
    product_name: string | null;
    application_id: string | null;
    is_current: boolean;
    source_id: string;
    review_status: string;
  }>;
  communityReports?: Array<{
    id: string;
    substance_id: string;
    kind: string;
    title: string;
    content_summary: string | null;
    source_url: string | null;
    review_status: string;
  }>;
}

export interface PublicLexiconCatalog {
  substances: PeptideSubstance[];
  profiles: Map<string, SubstanceProfile>;
  source: PublicLexiconSource;
  fallback: PublicLexiconFallback | null;
}

export const PUBLIC_LEXICON_CACHE_MS = 30_000;

export const PUBLIC_CLAIM_STATUS = "approved";
export const PUBLIC_REVIEW_STATUS = "approved";
export const PUBLIC_REGULATORY_REVIEW_STATUS = "approved";
