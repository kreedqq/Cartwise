import { identitySeedFromCatalog } from "@/lib/peptide/persistence/identitySeed";
import { publishedClaimsSeed } from "@/lib/peptide/persistence/publishedClaimsSeed";
import { publishedRegulatorySeed } from "@/lib/peptide/persistence/publishedRegulatorySeed";
import { publishedScienceSeed } from "@/lib/peptide/persistence/publishedScienceSeed";
import { LIVE_SHOP_PRODUCTS } from "@/lib/peptide/persistence/liveShopProducts";
import { postgresMappingSlug } from "@/lib/peptide/persistence/sqlProductMapping";

export interface PostgresResearchBundle {
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
  }>;
  aliases: Array<{ substance_id: string; alias: string; alias_type: string }>;
  components: Array<{ blend_id: string; component_id: string; sort_order: number }>;
  productMaps: Array<{ code: string; name: string; substance_slug: string | null }>;
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
  }>;
  studySubstances: Array<{ study_id: string; substance_id: string }>;
  claims: Array<{
    id: string;
    stable_key: string;
    substance_id: string;
    claim_type: string;
    statement: string;
    status: string;
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
  }>;
  reviewActions: Array<{
    entity_stable_key: string | null;
    action: string;
    reason: string | null;
  }>;
}

/** Synthetic bundle matching the Phase 2–4 seed (what live Postgres should contain). */
export function postgresBundleFromSeeds(): PostgresResearchBundle {
  const identity = identitySeedFromCatalog();
  const science = publishedScienceSeed();
  const claimsSeed = publishedClaimsSeed();
  const regulatorySeed = publishedRegulatorySeed();

  const substances = identity.map((row) => ({
    id: row.slug,
    slug: row.slug,
    name: row.name,
    display_name: row.displayName,
    category: row.category,
    molecule_type: row.moleculeType,
    chemical_class: row.chemicalClass,
    cas_number: row.casNumber,
    identity_note: row.identityNote,
    status: row.status,
  }));
  const aliases = identity.flatMap((row) =>
    row.aliases.map((entry) => ({
      substance_id: row.slug,
      alias: entry.alias,
      alias_type: entry.aliasType,
    })),
  );
  const components = identity.flatMap((row) =>
    row.componentSlugs.map((component, index) => ({
      blend_id: row.slug,
      component_id: component,
      sort_order: index,
    })),
  );
  const productMaps = LIVE_SHOP_PRODUCTS.map((row) => ({
    code: row.code,
    name: row.name,
    substance_slug: postgresMappingSlug(row),
  }));
  const sources = science.sources.map((row) => ({
    id: row.key,
    source_type: row.sourceType,
    title: row.title,
    publisher: row.publisher,
    publication_date: row.publicationDate,
    access_date: row.accessDate,
    url: row.url,
    doi: row.doi,
    pmid: row.pmid,
    nct_id: row.nctId,
    legacy_ids: [...row.legacyIds],
  }));
  const sourceSubstances = science.sourceSubstances.map((row) => ({
    source_id: row.sourceKey,
    substance_id: row.substanceSlug,
    legacy_source_id: row.legacySourceId,
  }));
  const studies = science.studies.map((row) => ({
    id: row.nctId,
    nct_id: row.nctId,
    title: row.title,
    sponsor: row.sponsor,
    phase: row.phase,
    status: row.status,
    enrollment: row.enrollment,
    start_date: row.startDate,
    completion_date: row.completionDate,
    last_updated: row.lastUpdated,
    has_results: row.hasResults,
    source_url: row.url,
  }));
  const studySubstances = science.studySubstances.map((row) => ({
    study_id: row.nctId,
    substance_id: row.substanceSlug,
  }));
  const claims = claimsSeed.claims.map((row) => ({
    id: row.stableKey,
    stable_key: row.stableKey,
    substance_id: row.substanceSlug,
    claim_type: row.claimType,
    statement: row.statement,
    status: row.status,
  }));
  const sourceByLegacy = new Map<string, string>();
  for (const row of science.sourceSubstances) {
    sourceByLegacy.set(row.legacySourceId, row.sourceKey);
  }
  const claimSources = claimsSeed.claimSources.map((row) => ({
    claim_id: row.stableKey,
    source_id: sourceByLegacy.get(row.legacySourceId) ?? `id:${row.legacySourceId}`,
    study_id: row.nctId,
  }));
  const evidence = claimsSeed.evidenceAssessments.map((row) => ({
    claim_id: row.stableKey,
    evidence_level: row.evidenceLevel,
    confidence: row.confidence,
    evidence_type: row.evidenceType,
    review_status: row.reviewStatus,
  }));
  const regulatory = regulatorySeed.records.map((row) => ({
    stable_key: row.stableKey,
    substance_id: row.substanceSlug,
    authority: row.authority,
    region: row.region,
    status: row.status,
    indication: row.indication,
    product_name: row.productName,
    application_id: row.applicationId,
    is_current: row.isCurrent,
    source_id: sourceByLegacy.get(row.legacySourceId) ?? `id:${row.legacySourceId}`,
  }));
  const reviewActions = regulatorySeed.reviewActions.map((row) => ({
    entity_stable_key: row.entityStableKey,
    action: row.action,
    reason: row.reason,
  }));

  return {
    substances,
    aliases,
    components,
    productMaps,
    sources,
    sourceSubstances,
    studies,
    studySubstances,
    claims,
    claimSources,
    evidence,
    regulatory,
    reviewActions,
  };
}
