/**
 * Batch 03 review intake: validate, dedupe, never Hudson, never auto-approve.
 * Does not write Postgres. Import is blocked until migration 0030 is applied.
 */
import { normalizeDoi, normalizeNct, normalizePmid } from "@/lib/peptide/persistence/identifiers";
import { listPublishedProfiles } from "@/lib/peptide/profiles";
import {
  identityMustStaySeparate,
  isHudsonExcludedNct,
  isHudsonSponsor,
  keepArticle,
  keepStudy,
} from "@/lib/peptide/research/sourceValidation";

export const BATCH_03_MIGRATION_REQUIRED = "0030_research_source_study_review_intake";
export const BATCH03_PRODUCTION_IMPORT_PENDING = false;

export type IntakeDisposition = "import" | "duplicate" | "relationship" | "rejected" | "hudson";

export interface IntakeSourceRow {
  candidateId: string;
  slug: string;
  title: string;
  url: string;
  sourceType: "pubmed" | "clinical_trial";
  identifier: string;
  pmid: string | null;
  doi: string | null;
  nctId: string | null;
  publicationDate: string | null;
  publisher: string | null;
  connector: "ncbi-eutils" | "clinicaltrials.gov-v2";
  reviewStatus: "review-required";
  disposition: IntakeDisposition;
  reason: string;
}

export interface IntakeStudyRow {
  candidateId: string;
  slug: string;
  nctId: string;
  title: string;
  sponsor: string | null;
  intervention: string | null;
  condition: string | null;
  phase: string | null;
  status: string | null;
  url: string;
  lastUpdate: string | null;
  reviewStatus: "review-required";
  disposition: IntakeDisposition;
  reason: string;
}

export interface Batch03IntakePlan {
  migrationRequired: typeof BATCH_03_MIGRATION_REQUIRED;
  productionWrite: false;
  claimsAdded: 0;
  evidenceChanges: 0;
  regulatoryChanges: 0;
  sources: {
    candidates: number;
    import: IntakeSourceRow[];
    duplicate: IntakeSourceRow[];
    relationship: IntakeSourceRow[];
    rejected: IntakeSourceRow[];
    hudson: IntakeSourceRow[];
  };
  studies: {
    candidates: number;
    import: IntakeStudyRow[];
    duplicate: IntakeStudyRow[];
    relationship: IntakeStudyRow[];
    rejected: IntakeStudyRow[];
    hudson: IntakeStudyRow[];
  };
}

export type Batch03AnalysisFile = {
  sourcesAccepted?: Array<{
    slug: string;
    kind: string;
    id: string;
    title?: string;
    doi?: string | null;
    pubdate?: string | null;
    quality?: string;
    alreadyPublished?: boolean;
    publication?: string;
  }>;
  studiesAccepted?: Array<{
    slug: string;
    nctId: string;
    title: string;
    sponsor?: string | null;
    phase?: string | null;
    status?: string | null;
    intervention?: string | null;
    condition?: string | null;
    lastUpdate?: string | null;
    url?: string;
    alreadyPublished?: boolean;
    publication?: string;
  }>;
};

export function publishedIdentifierIndex() {
  const pmids = new Set<string>();
  const ncts = new Set<string>();
  const dois = new Set<string>();
  const sourcePairs = new Set<string>();
  const studyPairs = new Set<string>();
  for (const profile of listPublishedProfiles()) {
    for (const source of profile.sources) {
      const pmid = normalizePmid(source.pmid);
      const nct = normalizeNct(source.clinicalTrialId);
      const doi = normalizeDoi(source.doi);
      if (pmid) {
        pmids.add(pmid);
        sourcePairs.add(`${profile.slug}::pmid:${pmid}`);
      }
      if (nct) {
        ncts.add(nct);
        sourcePairs.add(`${profile.slug}::nct:${nct}`);
      }
      if (doi) dois.add(doi);
    }
    for (const study of profile.studies) {
      const nct = normalizeNct(study.clinicalTrialId);
      if (!nct) continue;
      ncts.add(nct);
      studyPairs.add(`${profile.slug}::nct:${nct}`);
    }
  }
  return { pmids, ncts, dois, sourcePairs, studyPairs };
}

function pubmedUrl(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}

function nctUrl(nct: string): string {
  return `https://clinicaltrials.gov/study/${nct}`;
}

export function identityIssueForCandidate(slug: string, title: string): string | null {
  if (slug === "glow-blend") return "Glow blend is a blend, not a unique INN source target";
  if (slug === "tb-500" && /thymosin beta-?4/i.test(title) && !/fragment|17-23/i.test(title)) {
    return "TB-500 must not share Thymosin Beta-4 evidence";
  }
  if (slug === "melanotan-ii" && /afamelanotide|scenesse/i.test(title)) {
    return "Melanotan II must not merge with afamelanotide";
  }
  if (slug === "igf-1-lr3" && /mecasermin|increlex/i.test(title)) {
    return "IGF-1 LR3 must not merge with mecasermin";
  }
  if (identityMustStaySeparate("tb-500", "thymosin-beta-4") && slug === "thymosin-beta-4" && /tb-500/i.test(title)) {
    return "Thymosin Beta-4 must not share TB-500 fragment evidence";
  }
  return null;
}

export function buildBatch03IntakePlan(analysis: Batch03AnalysisFile): Batch03IntakePlan {
  const index = publishedIdentifierIndex();
  const sourceCandidates = (analysis.sourcesAccepted ?? []).filter((row) => row.publication === "review-required");
  const studyCandidates = (analysis.studiesAccepted ?? []).filter((row) => row.publication === "review-required");

  const sources: Batch03IntakePlan["sources"] = {
    candidates: sourceCandidates.length,
    import: [],
    duplicate: [],
    relationship: [],
    rejected: [],
    hudson: [],
  };
  const studies: Batch03IntakePlan["studies"] = {
    candidates: studyCandidates.length,
    import: [],
    duplicate: [],
    relationship: [],
    rejected: [],
    hudson: [],
  };

  const seenPmids = new Set<string>();
  const seenSourceNcts = new Set<string>();
  const seenDois = new Set<string>();

  for (const row of sourceCandidates) {
    const pmid = row.kind === "pubmed" ? normalizePmid(row.id) : null;
    const nct = row.kind === "clinical_trial" ? normalizeNct(row.id) : null;
    const doi = normalizeDoi(row.doi);
    const title = row.title ?? "";
    const base: IntakeSourceRow = {
      candidateId: `${row.slug}:${row.kind}:${row.id}`,
      slug: row.slug,
      title,
      url: pmid ? pubmedUrl(pmid) : nct ? nctUrl(nct) : "",
      sourceType: row.kind === "clinical_trial" ? "clinical_trial" : "pubmed",
      identifier: pmid ? `PMID ${pmid}` : nct ? nct : row.id,
      pmid,
      doi,
      nctId: nct,
      publicationDate: row.pubdate ?? null,
      publisher: row.kind === "pubmed" ? "NCBI PubMed" : "ClinicalTrials.gov",
      connector: row.kind === "clinical_trial" ? "clinicaltrials.gov-v2" : "ncbi-eutils",
      reviewStatus: "review-required",
      disposition: "import",
      reason: "new-validated-candidate",
    };

    if (isHudsonExcludedNct(nct) || isHudsonExcludedNct(row.id)) {
      sources.hudson.push({ ...base, disposition: "hudson", reason: "hudson-exclusion" });
      continue;
    }
    if (!title || !base.url || (!pmid && !nct)) {
      sources.rejected.push({ ...base, disposition: "rejected", reason: "incomplete-identifier" });
      continue;
    }
    if (pmid && !keepArticle(row.slug, { pmid, title })) {
      sources.rejected.push({ ...base, disposition: "rejected", reason: "title-or-identity-filter" });
      continue;
    }
    if (nct && !keepStudy(row.slug, { nctId: nct, title })) {
      sources.rejected.push({ ...base, disposition: "rejected", reason: "title-or-identity-filter" });
      continue;
    }
    const identity = identityIssueForCandidate(row.slug, title);
    if (identity) {
      sources.rejected.push({ ...base, disposition: "rejected", reason: identity });
      continue;
    }
    if (row.alreadyPublished) {
      sources.duplicate.push({ ...base, disposition: "duplicate", reason: "already-in-published-profile" });
      continue;
    }
    if (pmid && (index.pmids.has(pmid) || seenPmids.has(pmid))) {
      const linkedHere = index.sourcePairs.has(`${row.slug}::pmid:${pmid}`);
      if (!linkedHere) {
        sources.relationship.push({
          ...base,
          disposition: "relationship",
          reason: index.pmids.has(pmid) ? "existing-pmid-new-substance-link" : "batch-pmid-new-substance-link",
        });
        continue;
      }
      sources.duplicate.push({ ...base, disposition: "duplicate", reason: "pmid-exists" });
      continue;
    }
    if (nct && (index.ncts.has(nct) || seenSourceNcts.has(nct))) {
      if (index.ncts.has(nct) && !index.sourcePairs.has(`${row.slug}::nct:${nct}`)) {
        sources.relationship.push({ ...base, disposition: "relationship", reason: "existing-nct-new-substance-link" });
        continue;
      }
      if (seenSourceNcts.has(nct) && !index.sourcePairs.has(`${row.slug}::nct:${nct}`)) {
        sources.relationship.push({ ...base, disposition: "relationship", reason: "batch-nct-new-substance-link" });
        continue;
      }
      sources.duplicate.push({ ...base, disposition: "duplicate", reason: "nct-exists" });
      continue;
    }
    if (doi && (index.dois.has(doi) || seenDois.has(doi))) {
      sources.duplicate.push({ ...base, disposition: "duplicate", reason: "doi-exists" });
      continue;
    }
    if (pmid) seenPmids.add(pmid);
    if (nct) seenSourceNcts.add(nct);
    if (doi) seenDois.add(doi);
    sources.import.push(base);
  }

  const seenStudyNcts = new Set<string>();
  for (const row of studyCandidates) {
    const nct = normalizeNct(row.nctId);
    const title = row.title ?? "";
    const base: IntakeStudyRow = {
      candidateId: `${row.slug}:study:${row.nctId}`,
      slug: row.slug,
      nctId: nct ?? row.nctId,
      title,
      sponsor: row.sponsor ?? null,
      intervention: row.intervention ?? null,
      condition: row.condition ?? null,
      phase: row.phase ?? null,
      status: row.status ?? null,
      url: row.url || (nct ? nctUrl(nct) : ""),
      lastUpdate: row.lastUpdate ?? null,
      reviewStatus: "review-required",
      disposition: "import",
      reason: "new-validated-candidate",
    };
    if (isHudsonExcludedNct(nct) || isHudsonSponsor(row.sponsor)) {
      studies.hudson.push({ ...base, disposition: "hudson", reason: "hudson-exclusion" });
      continue;
    }
    if (!nct || !title || !base.url || !row.intervention || !row.condition) {
      studies.rejected.push({ ...base, disposition: "rejected", reason: "incomplete-study-fields" });
      continue;
    }
    if (
      !keepStudy(row.slug, {
        nctId: nct,
        title,
        sponsor: row.sponsor,
        intervention: row.intervention,
        condition: row.condition,
      })
    ) {
      studies.rejected.push({ ...base, disposition: "rejected", reason: "title-or-identity-filter" });
      continue;
    }
    const identity = identityIssueForCandidate(row.slug, title);
    if (identity) {
      studies.rejected.push({ ...base, disposition: "rejected", reason: identity });
      continue;
    }
    if (row.alreadyPublished || (nct && index.studyPairs.has(`${row.slug}::nct:${nct}`))) {
      studies.duplicate.push({ ...base, disposition: "duplicate", reason: "already-in-published-profile" });
      continue;
    }
    if (nct && (index.ncts.has(nct) || seenStudyNcts.has(nct)) && !index.studyPairs.has(`${row.slug}::nct:${nct}`)) {
      studies.relationship.push({ ...base, disposition: "relationship", reason: "existing-nct-new-substance-link" });
      continue;
    }
    if (nct) seenStudyNcts.add(nct);
    studies.import.push(base);
  }

  return {
    migrationRequired: BATCH_03_MIGRATION_REQUIRED,
    productionWrite: false,
    claimsAdded: 0,
    evidenceChanges: 0,
    regulatoryChanges: 0,
    sources,
    studies,
  };
}

export function intakeSourceById(plan: Batch03IntakePlan, id: string): IntakeSourceRow | undefined {
  const candidateId = id.replace(/^intake:/, "");
  return [...plan.sources.import, ...plan.sources.duplicate, ...plan.sources.relationship].find(
    (row) => row.candidateId === candidateId,
  );
}

export function intakeStudyById(plan: Batch03IntakePlan, id: string): IntakeStudyRow | undefined {
  const candidateId = id.replace(/^intake:/, "");
  return [...plan.studies.import, ...plan.studies.duplicate, ...plan.studies.relationship].find(
    (row) => row.candidateId === candidateId,
  );
}

export function intakeQueueItems(plan: Batch03IntakePlan): Array<{
  kind: "source" | "study";
  id: string;
  stableKey: string;
  substanceSlug: string;
  title: string;
  status: "review-required";
  note: string;
  sourceCount: number;
}> {
  return [
    ...plan.sources.import.map((row) => ({
      kind: "source" as const,
      id: `intake:${row.candidateId}`,
      stableKey: row.candidateId,
      substanceSlug: row.slug,
      title: row.title,
      status: "review-required" as const,
      note: `${row.identifier} · ${row.connector} · not persisted`,
      sourceCount: 1,
    })),
    ...plan.studies.import.map((row) => ({
      kind: "study" as const,
      id: `intake:${row.candidateId}`,
      stableKey: row.candidateId,
      substanceSlug: row.slug,
      title: row.title,
      status: "review-required" as const,
      note: `${row.nctId} · not persisted`,
      sourceCount: 1,
    })),
  ];
}

export function isIntakePlaceholderId(id: string): boolean {
  return id.startsWith("intake:");
}
