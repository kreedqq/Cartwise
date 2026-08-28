import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const published = JSON.parse(
  readFileSync(resolve(root, "src/lib/peptide/profiles/published.json"), "utf8"),
);
const migrationPath = resolve(root, "supabase/migrations/0026_research_claims_and_evidence.sql");
const HUDSON = new Set(["NCT07487363", "NCT07437560"]);

function isHudsonNct(raw) {
  if (!raw) return false;
  const compact = String(raw).trim().replace(/\s+/g, "").toUpperCase();
  return HUDSON.has(compact);
}

function safetyCategory(severity) {
  if (severity === "common") return "common_adverse_event";
  if (severity === "serious") return "serious_adverse_event";
  if (severity === "warning") return "warning";
  return "long_term_unknown";
}

function domainType(domain) {
  if (domain === "human") return "human";
  if (domain === "animal") return "animal";
  if (domain === "in-vitro") return "in_vitro";
  return "mechanistic";
}

function nctsFor(profile, sourceIds) {
  const out = [];
  for (const id of sourceIds) {
    const source = profile.sources.find((row) => row.id === id);
    if (source?.clinicalTrialId && !out.includes(source.clinicalTrialId)) out.push(source.clinicalTrialId);
  }
  return out;
}

const claims = [];
const claimSources = [];
const assessments = [];
const hudsonHits = [];

function pushClaim(profile, stableKey, claimType, statement, sourceIds, extras) {
  const hudson = nctsFor(profile, sourceIds).filter(isHudsonNct);
  const hudsonIdHit = sourceIds.some((id) => id.includes("NCT07487363") || id.includes("NCT07437560"));
  if (hudson.length || hudsonIdHit) hudsonHits.push(`${profile.slug}:${stableKey}`);
  const missing = sourceIds.length === 0;
  const status = missing || hudson.length || hudsonIdHit ? "review-required" : "approved";
  claims.push({
    stable_key: stableKey,
    substance_slug: profile.slug,
    claim_type: claimType,
    statement,
    status,
    safety_category: extras.safetyCategory ?? null,
  });
  for (const sourceId of sourceIds) {
    const source = profile.sources.find((row) => row.id === sourceId);
    claimSources.push({
      stable_key: stableKey,
      legacy_source_id: sourceId,
      nct_id: source?.clinicalTrialId ?? null,
    });
  }
  const copy = extras.copySubstanceEvidence === true;
  assessments.push({
    stable_key: stableKey,
    evidence_level: copy ? profile.evidenceLevel : null,
    confidence: copy ? profile.confidenceLevel : null,
    evidence_type: extras.evidenceType,
    rationale: copy
      ? "Imported from the published substance overlay evidenceLevel/confidenceLevel. Not a new claim-level reassessment."
      : null,
    review_status: copy && status === "approved" ? "approved" : "review-required",
  });
}

for (const profile of Object.values(published.profiles)) {
  pushClaim(profile, `${profile.slug}:summary.whatIsIt`, "other", profile.summary.whatIsIt.text, profile.summary.whatIsIt.sourceIds, {
    evidenceType: "other",
  });
  pushClaim(profile, `${profile.slug}:summary.mechanism`, "mechanism", profile.summary.mechanism.text, profile.summary.mechanism.sourceIds, {
    evidenceType: "mechanistic",
  });
  pushClaim(
    profile,
    `${profile.slug}:summary.whatHasBeenStudied`,
    "effect",
    profile.summary.whatHasBeenStudied.text,
    profile.summary.whatHasBeenStudied.sourceIds,
    { evidenceType: "other" },
  );
  pushClaim(
    profile,
    `${profile.slug}:summary.humanEvidence`,
    "clinical_evidence",
    profile.summary.humanEvidence.text,
    profile.summary.humanEvidence.sourceIds,
    { evidenceType: "human", copySubstanceEvidence: true },
  );
  pushClaim(
    profile,
    `${profile.slug}:summary.preclinicalEvidence`,
    "effect",
    profile.summary.preclinicalEvidence.text,
    profile.summary.preclinicalEvidence.sourceIds,
    { evidenceType: "other" },
  );
  pushClaim(profile, `${profile.slug}:summary.safety`, "safety", profile.summary.safety.text, profile.summary.safety.sourceIds, {
    evidenceType: "other",
  });
  pushClaim(
    profile,
    `${profile.slug}:summary.currentResearch`,
    "current_research",
    profile.summary.currentResearch.text,
    profile.summary.currentResearch.sourceIds,
    { evidenceType: "other" },
  );
  pushClaim(profile, `${profile.slug}:summary.unknowns`, "other", profile.summary.unknowns.text, profile.summary.unknowns.sourceIds, {
    evidenceType: "other",
  });
  profile.pharmacology.forEach((item, index) => {
    pushClaim(profile, `${profile.slug}:pharmacology:${index}`, "pharmacology", `${item.field}: ${item.value}`, item.sourceIds, {
      evidenceType: "other",
    });
  });
  profile.safetyItems.forEach((item, index) => {
    pushClaim(profile, `${profile.slug}:safetyItem:${index}`, "safety", item.text, item.sourceIds, {
      safetyCategory: safetyCategory(item.severity),
      evidenceType: domainType(item.domain),
    });
  });
  profile.interactions.forEach((item, index) => {
    pushClaim(profile, `${profile.slug}:interaction:${index}`, "safety", item.text, item.sourceIds, {
      safetyCategory: "interaction",
      evidenceType: "other",
    });
  });
  if (profile.reconstitution) {
    pushClaim(profile, `${profile.slug}:reconstitution`, "other", profile.reconstitution.text, profile.reconstitution.sourceIds, {
      evidenceType: "other",
    });
  }
  profile.conflicts.forEach((item, index) => {
    pushClaim(profile, `${profile.slug}:conflict:${index}`, "other", `${item.topic}: ${item.note}`, item.sourceIds, {
      evidenceType: "other",
    });
  });
}

const payload = JSON.stringify({ claims, claimSources, assessments });
if ([...HUDSON].some((nct) => payload.includes(`"nct_id":"${nct}"`) || payload.includes(`"legacy_source_id":"${nct}"`))) {
  throw new Error("Hudson NCT leaked into claim payload identifiers.");
}
if (hudsonHits.length) {
  throw new Error(`Hudson hits in claims: ${hudsonHits.join(", ")}`);
}

const current = readFileSync(migrationPath, "utf8");
const marker = "-- BEGIN GENERATED SEED";
const head = current.split(marker)[0] + marker + "\n";

const sql = `${head}-- claims: ${claims.length}
-- claim_sources: ${claimSources.length}
-- evidence_assessments: ${assessments.length}
-- hudson_excluded: NCT07487363, NCT07437560

insert into public.claims (
  stable_key, substance_id, claim_type, statement, status, safety_category
)
select
  x.stable_key,
  sub.id,
  x.claim_type,
  x.statement,
  x.status,
  x.safety_category
from jsonb_to_recordset($phase3_claims$
${JSON.stringify(claims)}
$phase3_claims$::jsonb) as x(
  stable_key text,
  substance_slug text,
  claim_type text,
  statement text,
  status text,
  safety_category text
)
join public.substances sub on sub.slug = x.substance_slug;

insert into public.claim_sources (claim_id, source_id, study_id)
select c.id, src.id, st.id
from jsonb_to_recordset($phase3_claim_sources$
${JSON.stringify(claimSources)}
$phase3_claim_sources$::jsonb) as link(
  stable_key text,
  legacy_source_id text,
  nct_id text
)
join public.claims c on c.stable_key = link.stable_key
join public.sources src on src.legacy_ids @> array[link.legacy_source_id]
left join public.studies st on st.nct_id = link.nct_id;

insert into public.evidence_assessments (
  claim_id, evidence_level, confidence, evidence_type, rationale, review_status
)
select
  c.id,
  x.evidence_level,
  x.confidence,
  x.evidence_type,
  x.rationale,
  x.review_status
from jsonb_to_recordset($phase3_evidence$
${JSON.stringify(assessments)}
$phase3_evidence$::jsonb) as x(
  stable_key text,
  evidence_level text,
  confidence text,
  evidence_type text,
  rationale text,
  review_status text
)
join public.claims c on c.stable_key = x.stable_key;
`;

writeFileSync(migrationPath, sql);
console.log(
  JSON.stringify(
    {
      claims: claims.length,
      claim_sources: claimSources.length,
      evidence_assessments: assessments.length,
      approved: claims.filter((row) => row.status === "approved").length,
      review_required: claims.filter((row) => row.status === "review-required").length,
      hudson_hits: hudsonHits.length,
    },
    null,
    2,
  ),
);
