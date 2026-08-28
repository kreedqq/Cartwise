import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const published = JSON.parse(
  readFileSync(resolve(root, "src/lib/peptide/profiles/published.json"), "utf8"),
);
const migrationPath = resolve(root, "supabase/migrations/0025_research_sources_studies_runs.sql");

const BATCH_01 = new Set([
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
]);
const BATCH_02 = new Set([
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
]);
const HUDSON = new Set(["NCT07487363", "NCT07437560"]);
const COMMUNITY = new Set(["blog", "reddit", "forum", "community"]);

function normalizeDoi(raw) {
  if (!raw) return null;
  let value = String(raw).trim();
  if (!value) return null;
  value = value.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  value = value.replace(/^doi:\s*/i, "");
  value = value.replace(/\s+/g, "");
  return value ? value.toLowerCase() : null;
}

function normalizePmid(raw) {
  if (!raw) return null;
  const digits = String(raw)
    .trim()
    .replace(/^pmid[:\s]*/i, "")
    .replace(/[^\d]/g, "");
  return digits || null;
}

function normalizeNct(raw) {
  if (!raw) return null;
  const compact = String(raw).trim().replace(/\s+/g, "").toUpperCase();
  const match = /^NCT(\d{8})$/.exec(compact);
  return match ? `NCT${match[1]}` : null;
}

function inferAuthority(url) {
  const value = String(url ?? "").toLowerCase();
  if (value.includes("ema.europa.eu")) return "ema";
  if (value.includes("bfarm.de")) return "bfarm";
  if (value.includes("mhra.gov") || value.includes("gov.uk/mhra") || value.includes("yellowcard")) return "mhra";
  if (
    value.includes("fda.gov") ||
    value.includes("dailymed.nlm.nih.gov") ||
    value.includes("accessdata.fda.gov") ||
    value.includes("open.fda.gov")
  ) {
    return "fda";
  }
  return null;
}

function mapType(source) {
  if (source.sourceType === "regulatory") return inferAuthority(source.url) ?? "regulatory";
  if (
    [
      "clinical_trial",
      "pubmed",
      "meta_analysis",
      "review",
      "journal",
      "scientific",
      "manufacturer",
    ].includes(source.sourceType)
  ) {
    return source.sourceType;
  }
  return "other";
}

function sourceKey(source) {
  const pmid = normalizePmid(source.pmid);
  if (pmid) return `pmid:${pmid}`;
  const doi = normalizeDoi(source.doi);
  if (doi) return `doi:${doi}`;
  const nct = normalizeNct(source.clinicalTrialId);
  if (nct) return `nct:${nct}`;
  return `id:${source.id}`;
}

function skipSource(source) {
  if (COMMUNITY.has(source.sourceType)) return "community_not_scientific";
  const nct = normalizeNct(source.clinicalTrialId);
  if (nct && HUDSON.has(nct)) return "hudson_or_fictional_nct";
  return null;
}

function skipStudy(study) {
  const nct = normalizeNct(study.clinicalTrialId);
  if (nct && HUDSON.has(nct)) return "hudson_or_fictional_nct";
  if (/mock study|fictional study|example of a ClinicalTrials\.gov-style/i.test(study.title ?? "")) {
    return "fictional_or_example_title";
  }
  if (/hudson biotech/i.test(study.sponsor ?? "")) return "hudson_biotech_sponsor";
  if (!nct) return "invalid_nct";
  return null;
}

const sourcesByKey = new Map();
const studiesByNct = new Map();
const sourceSubstances = [];
const studySubstances = [];
const seenSourcePair = new Set();
const seenStudyPair = new Set();

for (const profile of Object.values(published.profiles)) {
  for (const source of profile.sources) {
    if (skipSource(source)) continue;
    const key = sourceKey(source);
    const existing = sourcesByKey.get(key);
    if (!existing) {
      sourcesByKey.set(key, {
        key,
        source_type: mapType(source),
        title: source.title,
        publisher: source.publisher,
        publication_date: source.publicationDate,
        access_date: source.accessDate,
        url: source.url,
        doi: normalizeDoi(source.doi),
        pmid: normalizePmid(source.pmid),
        nct_id: normalizeNct(source.clinicalTrialId),
        source_quality: source.sourceQuality,
        legacy_ids: [source.id],
      });
    } else {
      if (!existing.legacy_ids.includes(source.id)) existing.legacy_ids.push(source.id);
    }
    const pair = `${key}::${profile.slug}`;
    if (!seenSourcePair.has(pair)) {
      seenSourcePair.add(pair);
      sourceSubstances.push({ source_key: key, substance_slug: profile.slug, legacy_source_id: source.id });
    }
  }
  for (const study of profile.studies) {
    if (skipStudy(study)) continue;
    const nctId = normalizeNct(study.clinicalTrialId);
    const existing = studiesByNct.get(nctId);
    if (!existing) {
      studiesByNct.set(nctId, {
        nct_id: nctId,
        title: study.title,
        sponsor: study.sponsor,
        phase: study.phase,
        status: study.status,
        enrollment: study.enrollment,
        start_date: study.startDate,
        completion_date: study.completionDate,
        last_updated: study.lastUpdated,
        has_results: study.hasResults,
        source_url: study.url,
      });
    }
    const pair = `${nctId}::${profile.slug}`;
    if (!seenStudyPair.has(pair)) {
      seenStudyPair.add(pair);
      studySubstances.push({ nct_id: nctId, substance_slug: profile.slug });
    }
  }
}

const sources = [...sourcesByKey.values()].sort((a, b) => a.key.localeCompare(b.key));
const studies = [...studiesByNct.values()].sort((a, b) => a.nct_id.localeCompare(b.nct_id));
const studySources = [];
for (const study of studies) {
  for (const source of sources) {
    if (source.nct_id === study.nct_id) {
      studySources.push({ nct_id: study.nct_id, source_key: source.key });
    }
  }
}

const runKeys = { "batch-01": new Set(), "batch-02": new Set() };
const runStudies = { "batch-01": new Set(), "batch-02": new Set() };
for (const link of sourceSubstances) {
  const batch = BATCH_01.has(link.substance_slug) ? "batch-01" : BATCH_02.has(link.substance_slug) ? "batch-02" : null;
  if (batch) runKeys[batch].add(link.source_key);
}
for (const link of studySubstances) {
  const batch = BATCH_01.has(link.substance_slug) ? "batch-01" : BATCH_02.has(link.substance_slug) ? "batch-02" : null;
  if (batch) runStudies[batch].add(link.nct_id);
}

const payload = {
  sources,
  studies,
  source_substances: sourceSubstances.sort((a, b) =>
    `${a.source_key}:${a.substance_slug}`.localeCompare(`${b.source_key}:${b.substance_slug}`),
  ),
  study_substances: studySubstances.sort((a, b) =>
    `${a.nct_id}:${a.substance_slug}`.localeCompare(`${b.nct_id}:${b.substance_slug}`),
  ),
  study_sources: studySources.sort((a, b) =>
    `${a.nct_id}:${a.source_key}`.localeCompare(`${b.nct_id}:${b.source_key}`),
  ),
  run_source_keys: {
    "batch-01": [...runKeys["batch-01"]].sort(),
    "batch-02": [...runKeys["batch-02"]].sort(),
  },
};

const json = JSON.stringify(payload);
if (json.includes("NCT07487363") || json.includes("NCT07437560")) {
  throw new Error("Hudson NCTs leaked into Phase 2 seed payload.");
}

const current = readFileSync(migrationPath, "utf8");
const marker = "-- BEGIN GENERATED SEED";
const head = current.split(marker)[0] + marker + "\n";

const sql = `${head}-- unique_sources: ${sources.length}
-- unique_studies: ${studies.length}
-- source_substance_links: ${sourceSubstances.length}
-- study_substance_links: ${studySubstances.length}
-- json_source_rows: 468
-- json_study_rows: 123
-- hudson_excluded: NCT07487363, NCT07437560

insert into public.research_runs (
  id, run_type, connector, query, batch_label, status,
  sources_accepted, studies_accepted, operator_note
) values
  (
    '60131c00-0002-4000-8000-000000000001',
    'historical_import',
    'published.json',
    'validated Batch 01 published profiles (15 substances)',
    'batch-01',
    'completed',
    ${runKeys["batch-01"].size},
    ${runStudies["batch-01"].size},
    'Historical import from published.json. Not a live connector log. Hudson NCT07487363 excluded from publication (raw cache retained).'
  ),
  (
    '60131c00-0002-4000-8000-000000000002',
    'historical_import',
    'published.json',
    'validated Batch 02 published profiles (12 substances)',
    'batch-02',
    'completed',
    ${runKeys["batch-02"].size},
    ${runStudies["batch-02"].size},
    'Historical import from published.json. Not a live connector log. Hudson NCT07437560 excluded from publication (raw cache retained).'
  );

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url,
  doi, pmid, nct_id, source_quality, status, legacy_ids
)
select
  x.source_type,
  x.title,
  x.publisher,
  x.publication_date,
  x.access_date,
  x.url,
  x.doi,
  x.pmid,
  x.nct_id,
  x.source_quality,
  'active',
  coalesce((select array_agg(v) from jsonb_array_elements_text(x.legacy_ids) as v), '{}')
from jsonb_to_recordset($phase2_sources$
${JSON.stringify(sources)}
$phase2_sources$::jsonb) as x(
  key text,
  source_type text,
  title text,
  publisher text,
  publication_date text,
  access_date text,
  url text,
  doi text,
  pmid text,
  nct_id text,
  source_quality smallint,
  legacy_ids jsonb
);

insert into public.studies (
  nct_id, title, sponsor, phase, status, enrollment,
  start_date, completion_date, last_updated, has_results, source_url
)
select
  x.nct_id, x.title, x.sponsor, x.phase, x.status, x.enrollment,
  x.start_date, x.completion_date, x.last_updated, x.has_results, x.source_url
from jsonb_to_recordset($phase2_studies$
${JSON.stringify(studies)}
$phase2_studies$::jsonb) as x(
  nct_id text,
  title text,
  sponsor text,
  phase text,
  status text,
  enrollment integer,
  start_date text,
  completion_date text,
  last_updated text,
  has_results boolean,
  source_url text
);

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select src.id, sub.id, link.legacy_source_id
from jsonb_to_recordset($phase2_source_substances$
${JSON.stringify(payload.source_substances)}
$phase2_source_substances$::jsonb) as link(
  source_key text,
  substance_slug text,
  legacy_source_id text
)
join public.substances sub on sub.slug = link.substance_slug
join public.sources src on
  (link.source_key like 'pmid:%' and src.pmid = substr(link.source_key, 6))
  or (link.source_key like 'doi:%' and src.doi = substr(link.source_key, 5))
  or (link.source_key like 'nct:%' and src.nct_id = substr(link.source_key, 5))
  or (link.source_key like 'id:%' and src.legacy_ids @> array[substr(link.source_key, 4)]);

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from jsonb_to_recordset($phase2_study_substances$
${JSON.stringify(payload.study_substances)}
$phase2_study_substances$::jsonb) as link(
  nct_id text,
  substance_slug text
)
join public.substances sub on sub.slug = link.substance_slug
join public.studies st on st.nct_id = link.nct_id;

insert into public.study_sources (study_id, source_id)
select st.id, src.id
from jsonb_to_recordset($phase2_study_sources$
${JSON.stringify(payload.study_sources)}
$phase2_study_sources$::jsonb) as link(
  nct_id text,
  source_key text
)
join public.studies st on st.nct_id = link.nct_id
join public.sources src on
  (link.source_key like 'pmid:%' and src.pmid = substr(link.source_key, 6))
  or (link.source_key like 'doi:%' and src.doi = substr(link.source_key, 5))
  or (link.source_key like 'nct:%' and src.nct_id = substr(link.source_key, 5))
  or (link.source_key like 'id:%' and src.legacy_ids @> array[substr(link.source_key, 4)]);

insert into public.research_run_sources (research_run_id, source_id, accepted)
select run.id, src.id, true
from jsonb_to_recordset($phase2_run_sources$
${JSON.stringify([
  ...payload.run_source_keys["batch-01"].map((key) => ({ run: "batch-01", source_key: key })),
  ...payload.run_source_keys["batch-02"].map((key) => ({ run: "batch-02", source_key: key })),
])}
$phase2_run_sources$::jsonb) as link(run text, source_key text)
join public.research_runs run on run.batch_label = link.run
join public.sources src on
  (link.source_key like 'pmid:%' and src.pmid = substr(link.source_key, 6))
  or (link.source_key like 'doi:%' and src.doi = substr(link.source_key, 5))
  or (link.source_key like 'nct:%' and src.nct_id = substr(link.source_key, 5))
  or (link.source_key like 'id:%' and src.legacy_ids @> array[substr(link.source_key, 4)]);
`;

writeFileSync(migrationPath, sql);
console.log(
  JSON.stringify(
    {
      unique_sources: sources.length,
      unique_studies: studies.length,
      source_substance_links: sourceSubstances.length,
      study_substance_links: studySubstances.length,
      study_sources: studySources.length,
      batch01_sources: runKeys["batch-01"].size,
      batch01_studies: runStudies["batch-01"].size,
      batch02_sources: runKeys["batch-02"].size,
      batch02_studies: runStudies["batch-02"].size,
    },
    null,
    2,
  ),
);
