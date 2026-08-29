import { researchSourceKey } from "@/lib/peptide/persistence/dualRead/keys";
import { sortedCopy } from "@/lib/peptide/persistence/dualRead/empty";
import type { PostgresResearchBundle } from "@/lib/peptide/persistence/dualRead/bundle";
import type {
  NormalizedIdentity,
  NormalizedListItem,
  NormalizedRegulatory,
  NormalizedResearchSnapshot,
} from "@/lib/peptide/persistence/dualRead/types";
import { listPublishedProfiles } from "@/lib/peptide/profiles";
import type { RegulatoryStatus } from "@/lib/peptide/types";

function persistedToOverlayStatus(status: string): RegulatoryStatus {
  if (status === "approved") return "approved";
  if (status === "approved_specific_indication") return "approved-specific";
  if (status === "clinical_development") return "clinical-development";
  if (status === "investigational") return "investigational";
  if (status === "not_approved") return "not-approved";
  if (status === "insufficient_information") return "insufficient";
  return "unknown";
}

function deriveListRegulatory(
  records: NormalizedRegulatory[],
  slug: string,
  fallback: RegulatoryStatus,
): string {
  const current = records.filter((row) => row.substanceSlug === slug && row.isCurrent);
  const approved = current.find(
    (row) => row.status === "approved" || row.status === "approved_specific_indication",
  );
  if (approved) return persistedToOverlayStatus(approved.status);
  if (current.some((row) => row.status === "clinical_development")) return "clinical-development";
  if (current.some((row) => row.status === "investigational")) return "investigational";
  if (current.some((row) => row.status === "insufficient_information")) return "insufficient";
  return fallback;
}

export function normalizePostgresResearch(bundle: PostgresResearchBundle): NormalizedResearchSnapshot {
  const slugById = new Map(bundle.substances.map((row) => [row.id, row.slug]));
  const sourceById = new Map(bundle.sources.map((row) => [row.id, row]));
  const studyById = new Map(bundle.studies.map((row) => [row.id, row]));
  const claimById = new Map(bundle.claims.map((row) => [row.id, row]));
  const overlayBySlug = new Map(listPublishedProfiles().map((profile) => [profile.slug, profile]));

  const identities: NormalizedIdentity[] = bundle.substances.map((row) => {
    const aliases = bundle.aliases.filter((alias) => alias.substance_id === row.id);
    const components = bundle.components
      .filter((item) => item.blend_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => slugById.get(item.component_id) ?? item.component_id);
    return {
      slug: row.slug,
      name: row.name,
      displayName: row.display_name,
      aliases: aliases.filter((item) => item.alias_type === "common_name").map((item) => item.alias),
      developmentNames: aliases.filter((item) => item.alias_type === "development_name").map((item) => item.alias),
      category: row.category,
      moleculeType: row.molecule_type,
      chemicalClass: row.chemical_class,
      casNumber: row.cas_number,
      identityNote: row.identity_note,
      lifecycleStatus: row.status,
      blendComponentSlugs: components,
    };
  });

  const sourceKeyById = new Map(
    bundle.sources.map((row) => [
      row.id,
      researchSourceKey({ pmid: row.pmid, doi: row.doi, nctId: row.nct_id, id: row.legacy_ids[0] ?? row.id }),
    ]),
  );

  const sources = bundle.sources.map((row) => {
    const attachments = bundle.sourceSubstances.filter((item) => item.source_id === row.id);
    return {
      key: sourceKeyById.get(row.id) ?? row.id,
      title: row.title,
      sourceType: row.source_type,
      doi: row.doi,
      pmid: row.pmid,
      nctId: row.nct_id,
      url: row.url,
      publisher: row.publisher,
      publicationDate: row.publication_date,
      accessDate: row.access_date,
      legacyIds: [...row.legacy_ids],
      substanceSlugs: attachments.map((item) => slugById.get(item.substance_id) ?? item.substance_id),
      reviewStatus: row.review_status ?? "approved",
    };
  });

  const studies = bundle.studies.map((row) => ({
    nctId: row.nct_id,
    title: row.title,
    sponsor: row.sponsor,
    phase: row.phase,
    status: row.status,
    enrollment: row.enrollment,
    startDate: row.start_date,
    completionDate: row.completion_date,
    lastUpdated: row.last_updated,
    hasResults: row.has_results,
    url: row.source_url,
    substanceSlugs: bundle.studySubstances
      .filter((item) => item.study_id === row.id)
      .map((item) => slugById.get(item.substance_id) ?? item.substance_id),
    reviewStatus: row.review_status ?? "approved",
  }));

  const claims = bundle.claims.map((row) => {
    const links = bundle.claimSources.filter((item) => item.claim_id === row.id);
    const sourceLegacyIds = links.map((link) => {
      const attachment = bundle.sourceSubstances.find(
        (item) => item.source_id === link.source_id && item.substance_id === row.substance_id,
      );
      if (attachment) return attachment.legacy_source_id;
      return sourceById.get(link.source_id)?.legacy_ids[0] ?? link.source_id;
    });
    const nctIds = links
      .map((link) => {
        if (link.study_id) return studyById.get(link.study_id)?.nct_id ?? link.study_id;
        return sourceById.get(link.source_id)?.nct_id ?? null;
      })
      .filter((item): item is string => Boolean(item));
    return {
      stableKey: row.stable_key,
      substanceSlug: slugById.get(row.substance_id) ?? row.substance_id,
      claimType: row.claim_type,
      statement: row.statement,
      status: row.status,
      sourceLegacyIds: [...new Set(sourceLegacyIds)],
      nctIds: [...new Set(nctIds)],
    };
  });

  const evidence = bundle.evidence.map((row) => {
    const claim = claimById.get(row.claim_id);
    const stableKey = claim?.stable_key ?? row.claim_id;
    return {
      stableKey,
      substanceSlug: claim ? (slugById.get(claim.substance_id) ?? claim.substance_id) : "",
      evidenceLevel: row.evidence_level,
      confidence: row.confidence,
      evidenceType: row.evidence_type,
      reviewStatus: row.review_status,
      overlay: stableKey.endsWith(":summary.humanEvidence") && row.review_status === "approved",
    };
  });

  const regulatory: NormalizedRegulatory[] = bundle.regulatory.map((row) => {
    const source = sourceById.get(row.source_id);
    return {
      stableKey: row.stable_key,
      substanceSlug: slugById.get(row.substance_id) ?? row.substance_id,
      authority: row.authority,
      region: row.region,
      status: row.status,
      indication: row.indication,
      productName: row.product_name,
      applicationId: row.application_id,
      isCurrent: row.is_current,
      legacySourceId: source?.legacy_ids[0] ?? row.stable_key.split(":").slice(1).join(":"),
    };
  });

  const listItems: NormalizedListItem[] = identities.map((identity) => {
    const overlay = overlayBySlug.get(identity.slug);
    const human = evidence.find((row) => row.stableKey === `${identity.slug}:summary.humanEvidence` && row.overlay);
    const fallbackStatus = overlay?.regulatoryStatus ?? "insufficient";
    return {
      slug: identity.slug,
      category: identity.category,
      evidenceLevel: human?.evidenceLevel ?? overlay?.evidenceLevel ?? "F",
      regulatoryStatus: deriveListRegulatory(regulatory, identity.slug, fallbackStatus),
      casNumber: identity.casNumber,
    };
  });

  const details = identities.map((identity) => {
    const claimText = (slot: string) =>
      claims.find((row) => row.stableKey === `${identity.slug}:${slot}`)?.statement ?? "";
    const human = evidence.find((row) => row.stableKey === `${identity.slug}:summary.humanEvidence`);
    const overlay = overlayBySlug.get(identity.slug);
    return {
      slug: identity.slug,
      identity,
      overview: claimText("summary.whatIsIt"),
      mechanism: claimText("summary.mechanism"),
      effects: claimText("summary.humanEvidence"),
      safety: claimText("summary.safety"),
      interactions: claims
        .filter((row) => row.stableKey.startsWith(`${identity.slug}:interaction:`))
        .map((row) => row.statement),
      reconstitution: claims.find((row) => row.stableKey === `${identity.slug}:reconstitution`)?.statement ?? null,
      studyNcts: studies.filter((row) => row.substanceSlugs.includes(identity.slug)).map((row) => row.nctId),
      sourceLegacyIds: bundle.sourceSubstances
        .filter((row) => slugById.get(row.substance_id) === identity.slug)
        .map((row) => row.legacy_source_id),
      evidenceLevel: human?.evidenceLevel ?? overlay?.evidenceLevel ?? null,
      evidenceType: human?.evidenceType ?? null,
      evidenceReviewStatus: human?.reviewStatus ?? null,
      confidence: human?.confidence ?? overlay?.confidenceLevel ?? null,
      regulatory: regulatory
        .filter((row) => row.substanceSlug === identity.slug)
        .map((row) => ({
          authority: row.authority,
          region: row.region,
          status: row.status,
          productName: row.productName,
          applicationId: row.applicationId,
          isCurrent: row.isCurrent,
        })),
    };
  });

  return {
    identities: sortedCopy(identities, (row) => row.slug),
    listItems: sortedCopy(listItems, (row) => row.slug),
    sources: sortedCopy(sources, (row) => row.key),
    sourceAttachments: sortedCopy(
      bundle.sourceSubstances.map((row) => ({
        sourceKey: sourceKeyById.get(row.source_id) ?? row.source_id,
        substanceSlug: slugById.get(row.substance_id) ?? row.substance_id,
        legacySourceId: row.legacy_source_id,
      })),
      (row) => `${row.substanceSlug}:${row.legacySourceId}`,
    ),
    studies: sortedCopy(studies, (row) => row.nctId),
    studyAttachments: sortedCopy(
      bundle.studySubstances.map((row) => ({
        nctId: studyById.get(row.study_id)?.nct_id ?? row.study_id,
        substanceSlug: slugById.get(row.substance_id) ?? row.substance_id,
      })),
      (row) => `${row.substanceSlug}:${row.nctId}`,
    ),
    claims: sortedCopy(claims, (row) => row.stableKey),
    evidence: sortedCopy(evidence, (row) => row.stableKey),
    regulatory: sortedCopy(regulatory, (row) => row.stableKey),
    reviewActions: sortedCopy(
      bundle.reviewActions.map((row) => ({
        entityStableKey: row.entity_stable_key ?? "",
        action: row.action,
        reason: row.reason ?? "",
      })),
      (row) => `${row.entityStableKey}:${row.reason}`,
    ),
    productMaps: sortedCopy(
      bundle.productMaps.map((row) => ({ code: row.code, name: row.name, slug: row.substance_slug })),
      (row) => row.code.toUpperCase(),
    ),
    details: sortedCopy(details, (row) => row.slug),
    communityReports: [],
  };
}
