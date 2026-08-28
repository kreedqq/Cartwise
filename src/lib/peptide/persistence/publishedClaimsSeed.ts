import { isExcludedNct } from "@/lib/peptide/persistence/identifiers";
import { listPublishedProfiles } from "@/lib/peptide/profiles";
import type { CitedText, SubstanceProfile } from "@/lib/peptide/profiles/types";
import type { ConfidenceLevel, EvidenceLevel } from "@/lib/peptide/types";

export type ClaimType =
  | "mechanism"
  | "effect"
  | "efficacy"
  | "safety"
  | "pharmacology"
  | "clinical_evidence"
  | "current_research"
  | "other";

export type ClaimStatus = "draft" | "review-required" | "approved" | "rejected";

export type SafetyCategory =
  | "common_adverse_event"
  | "serious_adverse_event"
  | "warning"
  | "contraindication"
  | "long_term_unknown"
  | "interaction";

export type EvidenceType =
  | "human"
  | "clinical_trial"
  | "observational"
  | "case_report"
  | "systematic_review"
  | "meta_analysis"
  | "animal"
  | "in_vitro"
  | "mechanistic"
  | "regulatory"
  | "other";

export type ReconcileStatus = "MATCH" | "MISSING_IN_POSTGRES" | "MISSING_IN_JSON" | "DIFFERENT" | "UNRESOLVED";

export interface SeedClaim {
  stableKey: string;
  substanceSlug: string;
  claimType: ClaimType;
  statement: string;
  status: ClaimStatus;
  safetyCategory: SafetyCategory | null;
  legacySourceIds: string[];
  nctIds: string[];
}

export interface SeedClaimSource {
  stableKey: string;
  legacySourceId: string;
  nctId: string | null;
}

export interface SeedEvidenceAssessment {
  stableKey: string;
  evidenceLevel: EvidenceLevel | null;
  confidence: ConfidenceLevel | null;
  evidenceType: EvidenceType;
  rationale: string | null;
  reviewStatus: ClaimStatus;
}

export interface SeedReconcileRow {
  kind: "claim";
  status: ReconcileStatus;
  jsonRef: string;
  postgresRef: string;
  note: string;
}

export interface PublishedClaimsSeed {
  legacyParagraphs: number;
  claims: SeedClaim[];
  claimSources: SeedClaimSource[];
  evidenceAssessments: SeedEvidenceAssessment[];
  claimsWithSources: number;
  claimsWithoutSources: number;
  reviewRequiredClaims: number;
  hudsonHits: string[];
  duplicatesKeptSeparate: number;
  reconciliation: SeedReconcileRow[];
}

function safetyCategory(severity: "common" | "serious" | "warning" | "unknown"): SafetyCategory {
  if (severity === "common") return "common_adverse_event";
  if (severity === "serious") return "serious_adverse_event";
  if (severity === "warning") return "warning";
  return "long_term_unknown";
}

function domainEvidenceType(domain: "human" | "animal" | "in-vitro" | "theoretical"): EvidenceType {
  if (domain === "human") return "human";
  if (domain === "animal") return "animal";
  if (domain === "in-vitro") return "in_vitro";
  return "mechanistic";
}

function citedNcts(profile: SubstanceProfile, sourceIds: string[]): string[] {
  const ncts: string[] = [];
  for (const id of sourceIds) {
    const source = profile.sources.find((row) => row.id === id);
    const nct = source?.clinicalTrialId ?? null;
    if (nct && !ncts.includes(nct)) ncts.push(nct);
  }
  return ncts;
}

function pushClaim(
  seed: PublishedClaimsSeed,
  profile: SubstanceProfile,
  stableKey: string,
  claimType: ClaimType,
  statement: string,
  sourceIds: string[],
  extras: {
    safetyCategory?: SafetyCategory | null;
    evidenceType: EvidenceType;
    copySubstanceEvidence?: boolean;
  },
): void {
  const hudson = citedNcts(profile, sourceIds).filter((nct) => isExcludedNct(nct));
  const hudsonIdHit = sourceIds.some(
    (id) => id.includes("NCT07487363") || id.includes("NCT07437560"),
  );
  if (hudson.length || hudsonIdHit) {
    seed.hudsonHits.push(`${profile.slug}:${stableKey}`);
  }
  const missingSources = sourceIds.length === 0;
  if (missingSources) seed.claimsWithoutSources += 1;
  else seed.claimsWithSources += 1;
  const status: ClaimStatus =
    missingSources || hudson.length || hudsonIdHit ? "review-required" : "approved";
  if (status === "review-required") seed.reviewRequiredClaims += 1;

  seed.claims.push({
    stableKey,
    substanceSlug: profile.slug,
    claimType,
    statement,
    status,
    safetyCategory: extras.safetyCategory ?? null,
    legacySourceIds: [...sourceIds],
    nctIds: citedNcts(profile, sourceIds),
  });
  for (const sourceId of sourceIds) {
    const source = profile.sources.find((row) => row.id === sourceId);
    seed.claimSources.push({
      stableKey,
      legacySourceId: sourceId,
      nctId: source?.clinicalTrialId ?? null,
    });
  }

  const copy = extras.copySubstanceEvidence === true;
  seed.evidenceAssessments.push({
    stableKey,
    evidenceLevel: copy ? profile.evidenceLevel : null,
    confidence: copy ? profile.confidenceLevel : null,
    evidenceType: extras.evidenceType,
    rationale: copy
      ? "Imported from the published substance overlay evidenceLevel/confidenceLevel. Not a new claim-level reassessment."
      : null,
    reviewStatus: copy && status === "approved" ? "approved" : "review-required",
  });

  seed.reconciliation.push({
    kind: "claim",
    status: "MATCH",
    jsonRef: `${profile.slug}:${stableKey}`,
    postgresRef: stableKey,
    note: missingSources ? "no source ids" : "imported cited block",
  });
}

function addCited(
  seed: PublishedClaimsSeed,
  profile: SubstanceProfile,
  slot: string,
  claimType: ClaimType,
  block: CitedText,
  evidenceType: EvidenceType,
  copySubstanceEvidence = false,
): void {
  seed.legacyParagraphs += 1;
  pushClaim(seed, profile, `${profile.slug}:${slot}`, claimType, block.text, block.sourceIds, {
    evidenceType,
    copySubstanceEvidence,
  });
}

export function buildPublishedClaimsSeed(profiles: SubstanceProfile[]): PublishedClaimsSeed {
  const seed: PublishedClaimsSeed = {
    legacyParagraphs: 0,
    claims: [],
    claimSources: [],
    evidenceAssessments: [],
    claimsWithSources: 0,
    claimsWithoutSources: 0,
    reviewRequiredClaims: 0,
    hudsonHits: [],
    duplicatesKeptSeparate: 0,
    reconciliation: [],
  };

  for (const profile of profiles) {
    addCited(seed, profile, "summary.whatIsIt", "other", profile.summary.whatIsIt, "other");
    addCited(seed, profile, "summary.mechanism", "mechanism", profile.summary.mechanism, "mechanistic");
    addCited(seed, profile, "summary.whatHasBeenStudied", "effect", profile.summary.whatHasBeenStudied, "other");
    addCited(
      seed,
      profile,
      "summary.humanEvidence",
      "clinical_evidence",
      profile.summary.humanEvidence,
      "human",
      true,
    );
    addCited(
      seed,
      profile,
      "summary.preclinicalEvidence",
      "effect",
      profile.summary.preclinicalEvidence,
      "other",
    );
    addCited(seed, profile, "summary.safety", "safety", profile.summary.safety, "other");
    addCited(
      seed,
      profile,
      "summary.currentResearch",
      "current_research",
      profile.summary.currentResearch,
      "other",
    );
    addCited(seed, profile, "summary.unknowns", "other", profile.summary.unknowns, "other");

    profile.pharmacology.forEach((item, index) => {
      seed.legacyParagraphs += 1;
      const statement = `${item.field}: ${item.value}`;
      pushClaim(seed, profile, `${profile.slug}:pharmacology:${index}`, "pharmacology", statement, item.sourceIds, {
        evidenceType: "other",
      });
    });

    profile.safetyItems.forEach((item, index) => {
      seed.legacyParagraphs += 1;
      pushClaim(seed, profile, `${profile.slug}:safetyItem:${index}`, "safety", item.text, item.sourceIds, {
        safetyCategory: safetyCategory(item.severity),
        evidenceType: domainEvidenceType(item.domain),
      });
    });

    profile.interactions.forEach((item, index) => {
      seed.legacyParagraphs += 1;
      pushClaim(seed, profile, `${profile.slug}:interaction:${index}`, "safety", item.text, item.sourceIds, {
        safetyCategory: "interaction",
        evidenceType: "other",
      });
    });

    if (profile.reconstitution) {
      seed.legacyParagraphs += 1;
      pushClaim(
        seed,
        profile,
        `${profile.slug}:reconstitution`,
        "other",
        profile.reconstitution.text,
        profile.reconstitution.sourceIds,
        { evidenceType: "other" },
      );
    }

    profile.conflicts.forEach((item, index) => {
      seed.legacyParagraphs += 1;
      pushClaim(
        seed,
        profile,
        `${profile.slug}:conflict:${index}`,
        "other",
        `${item.topic}: ${item.note}`,
        item.sourceIds,
        { evidenceType: "other" },
      );
    });
  }

  const byText = new Map<string, string[]>();
  for (const claim of seed.claims) {
    const key = `${claim.substanceSlug}::${claim.statement.trim().toLowerCase()}`;
    const list = byText.get(key) ?? [];
    list.push(claim.stableKey);
    byText.set(key, list);
  }
  seed.duplicatesKeptSeparate = [...byText.values()].filter((list) => list.length > 1).length;

  return seed;
}

export function publishedClaimsSeed(): PublishedClaimsSeed {
  return buildPublishedClaimsSeed(listPublishedProfiles());
}
