import { COMMUNITY_DISCLAIMER, getIdentitySubstance, NO_DATA, PEPTIDE_SUBSTANCES_IDENTITY } from "@/lib/peptide/catalog";
import { RESEARCH_ACCESS_DATE } from "@/lib/peptide/profiles";
import type { CitedText, ProfileSource, ProfileStudy, SubstanceProfile } from "@/lib/peptide/profiles/types";
import { resolvePublicCategory } from "@/lib/peptide/lexicon/categoryOverlay";
import { isPublicCommunityReport, isPublicSource, publicClaims, publicEvidence, publicRegulatory, publicStudies } from "@/lib/peptide/lexicon/publicVisibility";
import type { PublicLexiconBundle } from "@/lib/peptide/lexicon/types";
import {
  CONFIDENCE_LEVELS,
  EVIDENCE_LEVELS,
  SOURCE_TYPES,
  type ConfidenceLevel,
  type EvidenceLevel,
  type PeptideSubstance,
  type RegulatoryStatus,
  type SourceType,
} from "@/lib/peptide/types";

const EMPTY_CITED: CitedText = { text: "", sourceIds: [] };

function persistedToOverlayStatus(status: string): RegulatoryStatus {
  if (status === "approved") return "approved";
  if (status === "approved_specific_indication") return "approved-specific";
  if (status === "clinical_development") return "clinical-development";
  if (status === "investigational") return "investigational";
  if (status === "not_approved") return "not-approved";
  if (status === "insufficient_information") return "insufficient";
  return "unknown";
}

function asEvidenceLevel(value: string | null): EvidenceLevel | null {
  if (value && (EVIDENCE_LEVELS as readonly string[]).includes(value)) return value as EvidenceLevel;
  return null;
}

function asConfidence(value: string | null): ConfidenceLevel | null {
  if (value && (CONFIDENCE_LEVELS as readonly string[]).includes(value)) return value as ConfidenceLevel;
  return null;
}

function asSourceType(value: string): SourceType {
  if ((SOURCE_TYPES as readonly string[]).includes(value)) return value as SourceType;
  return "scientific";
}

function deriveListRegulatory(
  records: PublicLexiconBundle["regulatory"],
  substanceId: string,
): RegulatoryStatus {
  const current = records.filter((row) => row.substance_id === substanceId);
  const approved = current.find(
    (row) => row.status === "approved" || row.status === "approved_specific_indication",
  );
  if (approved) return persistedToOverlayStatus(approved.status);
  if (current.some((row) => row.status === "clinical_development")) return "clinical-development";
  if (current.some((row) => row.status === "investigational")) return "investigational";
  if (current.some((row) => row.status === "insufficient_information")) return "insufficient";
  return "insufficient";
}

function citeIdsForClaim(
  claimId: string,
  bundle: PublicLexiconBundle,
  sourceById: Map<string, PublicLexiconBundle["sources"][number]>,
): string[] {
  const ids: string[] = [];
  for (const link of bundle.claimSources) {
    if (link.claim_id !== claimId) continue;
    const source = sourceById.get(link.source_id);
    if (!source || !isPublicSource(source)) continue;
    const legacy = bundle.sourceSubstances.find((row) => row.source_id === source.id)?.legacy_source_id;
    ids.push(legacy ?? source.legacy_ids[0] ?? source.id);
  }
  return [...new Set(ids)];
}

function citedBlock(
  claims: PublicLexiconBundle["claims"],
  slug: string,
  slot: string,
  sourceById: Map<string, PublicLexiconBundle["sources"][number]>,
  bundle: PublicLexiconBundle,
): CitedText {
  const claim = claims.find((row) => row.stable_key === `${slug}:${slot}`);
  if (!claim) return EMPTY_CITED;
  const sourceIds = citeIdsForClaim(claim.id, bundle, sourceById);
  if (sourceIds.length === 0) return EMPTY_CITED;
  return { text: claim.statement, sourceIds };
}

function splitOnce(statement: string): { left: string; right: string } {
  const index = statement.indexOf(": ");
  if (index < 0) return { left: statement, right: "" };
  return { left: statement.slice(0, index), right: statement.slice(index + 2) };
}

function safetySeverity(category: string | null): "common" | "serious" | "warning" | "unknown" {
  if (category === "common_adverse_event") return "common";
  if (category === "serious_adverse_event") return "serious";
  if (category === "warning") return "warning";
  return "unknown";
}

function toProfileSource(row: PublicLexiconBundle["sources"][number], legacyId: string): ProfileSource {
  return {
    id: legacyId,
    title: row.title,
    url: row.url,
    publisher: row.publisher,
    publicationDate: row.publication_date,
    accessDate: row.access_date ?? RESEARCH_ACCESS_DATE,
    doi: row.doi,
    pmid: row.pmid,
    clinicalTrialId: row.nct_id,
    sourceType: asSourceType(row.source_type),
    sourceQuality: 3,
  };
}

export function mapPublicLexicon(bundle: PublicLexiconBundle): {
  substances: PeptideSubstance[];
  profiles: Map<string, SubstanceProfile>;
} {
  const allowlist = new Set(PEPTIDE_SUBSTANCES_IDENTITY.map((item) => item.slug));
  const slugById = new Map(bundle.substances.map((row) => [row.id, row.slug]));
  const sourceById = new Map(bundle.sources.map((row) => [row.id, row]));
  const claims = publicClaims(bundle);
  const evidence = publicEvidence(bundle);
  const regulatory = publicRegulatory(bundle);
  const studies = publicStudies(bundle);
  const substances: PeptideSubstance[] = [];
  const profiles = new Map<string, SubstanceProfile>();

  for (const row of bundle.substances) {
    if (!allowlist.has(row.slug)) continue;
    const category = resolvePublicCategory(row.slug, row.category);
    if (!category.ok) continue;
    const identity = getIdentitySubstance(row.slug);
    const aliases = bundle.aliases
      .filter((item) => item.substance_id === row.id && item.alias_type === "common_name")
      .map((item) => item.alias);
    const developmentNames = bundle.aliases
      .filter((item) => item.substance_id === row.id && item.alias_type === "development_name")
      .map((item) => item.alias);
    const blendComponentSlugs = bundle.components
      .filter((item) => item.blend_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => slugById.get(item.component_id) ?? item.component_id);

    const humanClaim = claims.find((item) => item.stable_key === `${row.slug}:summary.humanEvidence`);
    const humanEvidence = humanClaim
      ? evidence.find((item) => item.claim_id === humanClaim.id)
      : undefined;
    const evidenceLevel = asEvidenceLevel(humanEvidence?.evidence_level ?? null) ?? "F";
    const confidenceLevel = asConfidence(humanEvidence?.confidence ?? null) ?? "insufficient";
    const regulatoryStatus = deriveListRegulatory(regulatory, row.id);

    const substance: PeptideSubstance = {
      id: row.slug,
      slug: row.slug,
      name: row.name,
      displayName: row.display_name,
      aliases,
      developmentNames,
      casNumber: row.cas_number,
      category: category.category,
      subcategory: null,
      moleculeType: row.molecule_type ?? identity?.moleculeType ?? null,
      chemicalClass: row.chemical_class,
      description: identity?.description ?? "Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.",
      identityNote: row.identity_note ?? identity?.identityNote ?? null,
      blendComponentSlugs,
      evidenceLevel,
      confidenceLevel,
      regulatoryStatus,
      reviewStatus: "incomplete",
      lastReviewedAt: row.updated_at,
      lastResearchScanAt: null,
      lastCommunityScanAt: null,
    };

    const whatIsIt = citedBlock(claims, row.slug, "summary.whatIsIt", sourceById, bundle);
    substance.description = whatIsIt.text || substance.description;

    const sourceIdsUsed = new Set<string>();
    const collect = (ids: string[]) => ids.forEach((id) => sourceIdsUsed.add(id));

    const summary = {
      whatIsIt,
      mechanism: citedBlock(claims, row.slug, "summary.mechanism", sourceById, bundle),
      whatHasBeenStudied: citedBlock(claims, row.slug, "summary.whatHasBeenStudied", sourceById, bundle),
      humanEvidence: citedBlock(claims, row.slug, "summary.humanEvidence", sourceById, bundle),
      preclinicalEvidence: citedBlock(claims, row.slug, "summary.preclinicalEvidence", sourceById, bundle),
      safety: citedBlock(claims, row.slug, "summary.safety", sourceById, bundle),
      currentResearch: citedBlock(claims, row.slug, "summary.currentResearch", sourceById, bundle),
      unknowns: citedBlock(claims, row.slug, "summary.unknowns", sourceById, bundle),
    };
    Object.values(summary).forEach((block) => collect(block.sourceIds));

    const reconstitutionClaim = claims.find((item) => item.stable_key === `${row.slug}:reconstitution`);
    const reconstitution =
      reconstitutionClaim && citeIdsForClaim(reconstitutionClaim.id, bundle, sourceById).length > 0
        ? {
            text: reconstitutionClaim.statement,
            sourceIds: citeIdsForClaim(reconstitutionClaim.id, bundle, sourceById),
          }
        : null;
    if (reconstitution) collect(reconstitution.sourceIds);

    const pharmacology = claims
      .filter((item) => item.stable_key.startsWith(`${row.slug}:pharmacology:`))
      .map((item) => {
        const sourceIds = citeIdsForClaim(item.id, bundle, sourceById);
        collect(sourceIds);
        const parts = splitOnce(item.statement);
        return { field: parts.left, value: parts.right, sourceIds };
      })
      .filter((item) => item.sourceIds.length > 0);

    const safetyItems = claims
      .filter((item) => item.stable_key.startsWith(`${row.slug}:safetyItem:`))
      .map((item) => {
        const sourceIds = citeIdsForClaim(item.id, bundle, sourceById);
        collect(sourceIds);
        return {
          domain: "theoretical" as const,
          severity: safetySeverity(item.safety_category),
          text: item.statement,
          sourceIds,
        };
      })
      .filter((item) => item.sourceIds.length > 0);

    const interactions = claims
      .filter((item) => item.stable_key.startsWith(`${row.slug}:interaction:`))
      .map((item) => {
        const sourceIds = citeIdsForClaim(item.id, bundle, sourceById);
        collect(sourceIds);
        return { category: "unknown" as const, text: item.statement, sourceIds };
      })
      .filter((item) => item.sourceIds.length > 0);

    const conflicts = claims
      .filter((item) => item.stable_key.startsWith(`${row.slug}:conflict:`))
      .map((item) => {
        const sourceIds = citeIdsForClaim(item.id, bundle, sourceById);
        collect(sourceIds);
        const parts = splitOnce(item.statement);
        return { topic: parts.left, note: parts.right, sourceIds };
      })
      .filter((item) => item.sourceIds.length > 0);

    const profileStudies: ProfileStudy[] = studies
      .filter((study) =>
        bundle.studySubstances.some(
          (link) => link.study_id === study.id && slugById.get(link.substance_id) === row.slug,
        ),
      )
      .map((study) => ({
        id: study.nct_id,
        clinicalTrialId: study.nct_id,
        title: study.title,
        phase: study.phase,
        status: study.status,
        sponsor: study.sponsor,
        enrollment: study.enrollment,
        startDate: study.start_date,
        completionDate: study.completion_date,
        lastUpdated: study.last_updated,
        hasResults: study.has_results,
        url: study.source_url,
      }));

    const attachments = bundle.sourceSubstances.filter((item) => item.substance_id === row.id);
    const profileSources: ProfileSource[] = [];
    const sourceReferences: ProfileSource[] = [];
    const seenSource = new Set<string>();
    for (const id of sourceIdsUsed) {
      const source = bundle.sources.find((item) => item.id === id || item.legacy_ids.includes(id));
      if (!source || !isPublicSource(source)) continue;
      if (seenSource.has(id)) continue;
      seenSource.add(id);
      profileSources.push(toProfileSource(source, id));
    }
    for (const attachment of attachments) {
      const source = sourceById.get(attachment.source_id);
      if (!source || !isPublicSource(source)) continue;
      const id = attachment.legacy_source_id || source.legacy_ids[0] || source.id;
      if (seenSource.has(id)) continue;
      seenSource.add(id);
      sourceReferences.push(toProfileSource(source, id));
    }

    const regions = [
      ...new Set(regulatory.filter((item) => item.substance_id === row.id).map((item) => item.region)),
    ];

    const communityReports = (bundle.communityReports ?? []).filter(
      (item) => item.substance_id === row.id && isPublicCommunityReport(item),
    );
    const profile: SubstanceProfile = {
      slug: row.slug,
      publicationStatus: "published",
      lastReviewedAt: row.updated_at ?? "",
      lastResearchScanAt: "",
      lastCommunityScanAt: null,
      evidenceLevel,
      confidenceLevel,
      regulatoryStatus,
      reviewStatus: substance.reviewStatus,
      identity: {
        verified: true,
        casNumber: row.cas_number,
        chemicalClass: row.chemical_class,
        moleculeType: row.molecule_type,
        identityNote: substance.identityNote,
      },
      connectors: [],
      summary,
      pharmacology,
      safetyItems,
      interactions,
      reconstitution,
      studies: profileStudies,
      sources: profileSources,
      sourceReferences,
      conflicts,
      reviewItems: [],
      regulatoryRegions: regions,
      community: {
        available: communityReports.length > 0,
        message: COMMUNITY_DISCLAIMER,
        reports: communityReports.map((item) => ({
          id: item.id,
          kind: item.kind,
          title: item.title,
          sourceUrl: item.source_url,
        })),
      },
      researchReport: {
        identity: row.name,
        fda: regions.includes("US") ? "US" : NO_DATA,
        ema: regions.includes("EU") ? "EU" : NO_DATA,
        clinicalTrials: profileStudies.length,
        pubmed: profileSources.filter((item) => item.pmid).length,
        scientific: profileSources.length,
        community: COMMUNITY_DISCLAIMER,
        conflicts: conflicts.length,
      },
    };

    substances.push(substance);
    profiles.set(row.slug, profile);
  }

  const identityOrder = PEPTIDE_SUBSTANCES_IDENTITY.map((item) => item.slug);
  substances.sort((a, b) => identityOrder.indexOf(a.slug) - identityOrder.indexOf(b.slug));
  return { substances, profiles };
}
