import { isCommunitySource, type SourceType } from "@/lib/peptide/types";
import { listPublishedProfiles, RESEARCH_ACCESS_DATE } from "@/lib/peptide/profiles";
import type { ProfileSource, ProfileStudy, SubstanceProfile } from "@/lib/peptide/profiles/types";
import {
  inferRegulatoryAuthority,
  isExcludedNct,
  isFictionalOrExampleStudyTitle,
  normalizeDoi,
  normalizeNct,
  normalizePmid,
} from "@/lib/peptide/persistence/identifiers";

export const BATCH_01_SLUGS = [
  "retatrutide",
  "tirzepatide",
  "semaglutide",
  "liraglutide",
  "tesamorelin",
  "orforglipron",
  "cagrilintide",
  "mazdutide",
  "cjc-1295",
  "ipamorelin",
  "bpc-157",
  "ghk-cu",
  "mots-c",
  "aod-9604",
  "tb-500",
] as const;

export const BATCH_02_SLUGS = [
  "sermorelin",
  "thymosin-beta-4",
  "semax",
  "selank",
  "thymosin-alpha-1",
  "kpv",
  "igf-1-lr3",
  "somatropin",
  "hcg",
  "gonadorelin",
  "melanotan-ii",
  "glow-blend",
] as const;

export type ScienceSourceType =
  | "fda"
  | "ema"
  | "bfarm"
  | "mhra"
  | "clinical_trial"
  | "pubmed"
  | "journal"
  | "systematic_review"
  | "review"
  | "meta_analysis"
  | "manufacturer"
  | "literature"
  | "scientific"
  | "regulatory"
  | "other";

export type ReconcileStatus = "MATCH" | "MISSING_IN_POSTGRES" | "MISSING_IN_JSON" | "DIFFERENT" | "UNRESOLVED";

export interface SeedSource {
  key: string;
  sourceType: ScienceSourceType;
  title: string;
  publisher: string | null;
  publicationDate: string | null;
  accessDate: string;
  url: string;
  doi: string | null;
  pmid: string | null;
  nctId: string | null;
  sourceQuality: 1 | 2 | 3 | 4 | 5;
  status: "active";
  legacyIds: string[];
  substanceSlugs: string[];
}

export interface SeedStudy {
  nctId: string;
  title: string;
  sponsor: string | null;
  phase: string | null;
  status: string | null;
  enrollment: number | null;
  startDate: string | null;
  completionDate: string | null;
  lastUpdated: string | null;
  hasResults: boolean;
  url: string;
  substanceSlugs: string[];
}

export interface SeedSourceSubstance {
  sourceKey: string;
  substanceSlug: string;
  legacySourceId: string;
}

export interface SeedStudySubstance {
  nctId: string;
  substanceSlug: string;
}

export interface SeedStudySource {
  nctId: string;
  sourceKey: string;
}

export interface SeedResearchRun {
  batchLabel: "batch-01" | "batch-02";
  runType: "historical_import";
  connector: "published.json";
  query: string;
  status: "completed";
  operatorNote: string;
  sourceKeys: string[];
  studyNcts: string[];
}

export interface ReconcileRow {
  kind: "source" | "study";
  status: ReconcileStatus;
  jsonRef: string;
  postgresRef: string;
  note: string;
}

export interface PublishedScienceSeed {
  accessDate: string;
  jsonSourceRows: number;
  jsonStudyRows: number;
  sources: SeedSource[];
  studies: SeedStudy[];
  sourceSubstances: SeedSourceSubstance[];
  studySubstances: SeedStudySubstance[];
  studySources: SeedStudySource[];
  researchRuns: SeedResearchRun[];
  rejectedSources: Array<{ reason: string; ref: string; slug: string }>;
  rejectedStudies: Array<{ reason: string; ref: string; slug: string }>;
  hudsonExclusions: string[];
  reconciliation: ReconcileRow[];
}

function batchForSlug(slug: string): "batch-01" | "batch-02" | null {
  if ((BATCH_01_SLUGS as readonly string[]).includes(slug)) return "batch-01";
  if ((BATCH_02_SLUGS as readonly string[]).includes(slug)) return "batch-02";
  return null;
}

export function mapPublishedSourceType(source: ProfileSource): ScienceSourceType {
  if (source.sourceType === "regulatory") {
    return inferRegulatoryAuthority(source.url) ?? "regulatory";
  }
  if (source.sourceType === "clinical_trial") return "clinical_trial";
  if (source.sourceType === "pubmed") return "pubmed";
  if (source.sourceType === "meta_analysis") return "meta_analysis";
  if (source.sourceType === "review") return "review";
  if (source.sourceType === "journal") return "journal";
  if (source.sourceType === "scientific") return "scientific";
  if (source.sourceType === "manufacturer") return "manufacturer";
  return "other";
}

function sourceKey(source: ProfileSource): string {
  const pmid = normalizePmid(source.pmid);
  if (pmid) return `pmid:${pmid}`;
  const doi = normalizeDoi(source.doi);
  if (doi) return `doi:${doi}`;
  const nct = normalizeNct(source.clinicalTrialId);
  if (nct) return `nct:${nct}`;
  return `id:${source.id}`;
}

function skipSource(
  slug: string,
  source: ProfileSource,
): { reason: string; ref: string; slug: string } | null {
  if (isCommunitySource(source.sourceType as SourceType)) {
    return { reason: "community_not_scientific", ref: source.id, slug };
  }
  if (isExcludedNct(source.clinicalTrialId)) {
    return { reason: "hudson_or_fictional_nct", ref: source.clinicalTrialId ?? source.id, slug };
  }
  return null;
}

function skipStudy(slug: string, study: ProfileStudy): { reason: string; ref: string; slug: string } | null {
  if (isExcludedNct(study.clinicalTrialId)) {
    return { reason: "hudson_or_fictional_nct", ref: study.clinicalTrialId, slug };
  }
  if (isFictionalOrExampleStudyTitle(study.title)) {
    return { reason: "fictional_or_example_title", ref: study.clinicalTrialId, slug };
  }
  if (/hudson biotech/i.test(study.sponsor ?? "")) {
    return { reason: "hudson_biotech_sponsor", ref: study.clinicalTrialId, slug };
  }
  const nct = normalizeNct(study.clinicalTrialId);
  if (!nct) {
    return { reason: "invalid_nct", ref: study.clinicalTrialId, slug };
  }
  return null;
}

export function buildPublishedScienceSeed(profiles: SubstanceProfile[], accessDate: string): PublishedScienceSeed {
  const rejectedSources: PublishedScienceSeed["rejectedSources"] = [];
  const rejectedStudies: PublishedScienceSeed["rejectedStudies"] = [];
  const sourcesByKey = new Map<string, SeedSource>();
  const studiesByNct = new Map<string, SeedStudy>();
  const sourceSubstances: SeedSourceSubstance[] = [];
  const studySubstances: SeedStudySubstance[] = [];
  const seenSourcePair = new Set<string>();
  const seenStudyPair = new Set<string>();
  const reconciliation: ReconcileRow[] = [];
  let jsonSourceRows = 0;
  let jsonStudyRows = 0;

  for (const profile of profiles) {
    jsonSourceRows += profile.sources.length;
    jsonStudyRows += profile.studies.length;

    for (const source of profile.sources) {
      const skipped = skipSource(profile.slug, source);
      if (skipped) {
        rejectedSources.push(skipped);
        reconciliation.push({
          kind: "source",
          status: "MATCH",
          jsonRef: `${profile.slug}:${source.id}`,
          postgresRef: "(not imported)",
          note: skipped.reason,
        });
        continue;
      }
      const key = sourceKey(source);
      const doi = normalizeDoi(source.doi);
      const pmid = normalizePmid(source.pmid);
      const nctId = normalizeNct(source.clinicalTrialId);
      const existing = sourcesByKey.get(key);
      if (!existing) {
        sourcesByKey.set(key, {
          key,
          sourceType: mapPublishedSourceType(source),
          title: source.title,
          publisher: source.publisher,
          publicationDate: source.publicationDate,
          accessDate: source.accessDate,
          url: source.url,
          doi,
          pmid,
          nctId,
          sourceQuality: source.sourceQuality,
          status: "active",
          legacyIds: [source.id],
          substanceSlugs: [profile.slug],
        });
      } else {
        if (!existing.legacyIds.includes(source.id)) existing.legacyIds.push(source.id);
        if (!existing.substanceSlugs.includes(profile.slug)) existing.substanceSlugs.push(profile.slug);
        if (existing.title.trim() !== source.title.trim()) {
          reconciliation.push({
            kind: "source",
            status: "DIFFERENT",
            jsonRef: `${profile.slug}:${source.id}`,
            postgresRef: key,
            note: "Merged identifier; titles differ; first title kept",
          });
        }
      }
      const pair = `${key}::${profile.slug}`;
      if (!seenSourcePair.has(pair)) {
        seenSourcePair.add(pair);
        sourceSubstances.push({ sourceKey: key, substanceSlug: profile.slug, legacySourceId: source.id });
      }
      reconciliation.push({
        kind: "source",
        status: "MATCH",
        jsonRef: `${profile.slug}:${source.id}`,
        postgresRef: key,
        note: "imported from published.json",
      });
    }

    for (const study of profile.studies) {
      const skipped = skipStudy(profile.slug, study);
      if (skipped) {
        rejectedStudies.push(skipped);
        reconciliation.push({
          kind: "study",
          status: "MATCH",
          jsonRef: `${profile.slug}:${study.clinicalTrialId}`,
          postgresRef: "(not imported)",
          note: skipped.reason,
        });
        continue;
      }
      const nctId = normalizeNct(study.clinicalTrialId)!;
      const existing = studiesByNct.get(nctId);
      if (!existing) {
        studiesByNct.set(nctId, {
          nctId,
          title: study.title,
          sponsor: study.sponsor,
          phase: study.phase,
          status: study.status,
          enrollment: study.enrollment,
          startDate: study.startDate,
          completionDate: study.completionDate,
          lastUpdated: study.lastUpdated,
          hasResults: study.hasResults,
          url: study.url,
          substanceSlugs: [profile.slug],
        });
      } else {
        if (!existing.substanceSlugs.includes(profile.slug)) existing.substanceSlugs.push(profile.slug);
        if (existing.title.trim() !== study.title.trim()) {
          reconciliation.push({
            kind: "study",
            status: "DIFFERENT",
            jsonRef: `${profile.slug}:${study.clinicalTrialId}`,
            postgresRef: nctId,
            note: "Merged NCT; titles differ; first title kept",
          });
        }
      }
      const pair = `${nctId}::${profile.slug}`;
      if (!seenStudyPair.has(pair)) {
        seenStudyPair.add(pair);
        studySubstances.push({ nctId, substanceSlug: profile.slug });
      }
      reconciliation.push({
        kind: "study",
        status: "MATCH",
        jsonRef: `${profile.slug}:${study.clinicalTrialId}`,
        postgresRef: nctId,
        note: "imported from published.json",
      });
    }
  }

  const sources = [...sourcesByKey.values()].sort((a, b) => a.key.localeCompare(b.key));
  const studies = [...studiesByNct.values()].sort((a, b) => a.nctId.localeCompare(b.nctId));

  const studySources: SeedStudySource[] = [];
  const seenStudySource = new Set<string>();
  for (const study of studies) {
    for (const source of sources) {
      if (source.nctId === study.nctId) {
        const pair = `${study.nctId}::${source.key}`;
        if (!seenStudySource.has(pair)) {
          seenStudySource.add(pair);
          studySources.push({ nctId: study.nctId, sourceKey: source.key });
        }
      }
    }
  }

  const runs: SeedResearchRun[] = [
    {
      batchLabel: "batch-01",
      runType: "historical_import",
      connector: "published.json",
      query: "validated Batch 01 published profiles (15 substances)",
      status: "completed",
      operatorNote:
        "Historical import from published.json. Not a live connector log. Hudson NCT07487363 excluded from publication (raw cache retained).",
      sourceKeys: [],
      studyNcts: [],
    },
    {
      batchLabel: "batch-02",
      runType: "historical_import",
      connector: "published.json",
      query: "validated Batch 02 published profiles (12 substances)",
      status: "completed",
      operatorNote:
        "Historical import from published.json. Not a live connector log. Hudson NCT07437560 excluded from publication (raw cache retained).",
      sourceKeys: [],
      studyNcts: [],
    },
  ];

  for (const link of sourceSubstances) {
    const batch = batchForSlug(link.substanceSlug);
    const run = runs.find((item) => item.batchLabel === batch);
    if (run && !run.sourceKeys.includes(link.sourceKey)) run.sourceKeys.push(link.sourceKey);
  }
  for (const link of studySubstances) {
    const batch = batchForSlug(link.substanceSlug);
    const run = runs.find((item) => item.batchLabel === batch);
    if (run && !run.studyNcts.includes(link.nctId)) run.studyNcts.push(link.nctId);
  }

  return {
    accessDate,
    jsonSourceRows,
    jsonStudyRows,
    sources,
    studies,
    sourceSubstances: sourceSubstances.sort((a, b) =>
      `${a.sourceKey}:${a.substanceSlug}`.localeCompare(`${b.sourceKey}:${b.substanceSlug}`),
    ),
    studySubstances: studySubstances.sort((a, b) =>
      `${a.nctId}:${a.substanceSlug}`.localeCompare(`${b.nctId}:${b.substanceSlug}`),
    ),
    studySources: studySources.sort((a, b) =>
      `${a.nctId}:${a.sourceKey}`.localeCompare(`${b.nctId}:${b.sourceKey}`),
    ),
    researchRuns: runs,
    rejectedSources,
    rejectedStudies,
    hudsonExclusions: ["NCT07487363", "NCT07437560"],
    reconciliation,
  };
}

export function publishedScienceSeed(): PublishedScienceSeed {
  return buildPublishedScienceSeed(listPublishedProfiles(), RESEARCH_ACCESS_DATE);
}
