import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const published = JSON.parse(
  readFileSync(resolve(root, "src/lib/peptide/profiles/published.json"), "utf8"),
);
const migrationPath = resolve(root, "supabase/migrations/0027_research_regulatory_and_review.sql");
const MARKER = "-- BEGIN GENERATED SEED";

function inferAuthority(url) {
  const value = (url ?? "").toLowerCase();
  if (value.includes("ema.europa.eu")) return "ema";
  if (value.includes("bfarm.de")) return "bfarm";
  if (value.includes("mhra.gov") || value.includes("gov.uk/mhra") || value.includes("yellowcard")) {
    return "mhra";
  }
  if (
    value.includes("fda.gov") ||
    value.includes("dailymed.nlm.nih.gov") ||
    value.includes("accessdata.fda.gov") ||
    value.includes("open.fda.gov")
  ) {
    return "fda";
  }
  return "other";
}

function mapOverlay(status) {
  if (status === "approved") return "approved";
  if (status === "approved-specific") return "approved_specific_indication";
  if (status === "clinical-development") return "clinical_development";
  if (status === "investigational") return "investigational";
  if (status === "not-approved") return "not_approved";
  if (status === "insufficient") return "insufficient_information";
  return "unknown";
}

function productNameFromTitle(title) {
  if (/no product match/i.test(title) || /no blend NDA searched/i.test(title)) return null;
  const epar = /^(.*?)\s+EPAR\b/i.exec(title);
  if (epar) return epar[1].trim();
  const fda = /^(.*?)\s+FDA prescribing information/i.exec(title);
  if (fda) return fda[1].trim();
  return null;
}

function applicationId(profile, source) {
  const note = profile.identity?.identityNote ?? "";
  const title = source.title;
  if (source.id === "fda-foundayo" || /foundayo/i.test(title)) {
    const match = /FOUNDAYO \(NDA(\d+)\)/i.exec(note);
    return match ? `NDA${match[1]}` : null;
  }
  if (source.id === "fda-mounjaro" || /^MOUNJARO/i.test(title)) {
    const match = /Mounjaro \(NDA(\d+)\)/i.exec(note);
    return match ? `NDA${match[1]}` : null;
  }
  if (source.id === "fda-zepbound" || /^Zepbound/i.test(title)) {
    const match = /Zepbound \(NDA(\d+)\)/i.exec(note);
    return match ? `NDA${match[1]}` : null;
  }
  if (/ORAL SEMAGLUTIDE/i.test(title)) {
    const match = /orale Semaglutid-Tabletten \(NDA(\d+)\)/i.exec(note);
    return match ? `NDA${match[1]}` : null;
  }
  if (source.id === "fda-ozempic" || (/^Ozempic \(SEMAGLUTIDE\)/i.test(title) && !/oral/i.test(title))) {
    const match = /Ozempic \(s\.c\., NDA(\d+)\)/i.exec(note);
    return match ? `NDA${match[1]}` : null;
  }
  if (source.id === "fda-egrifta") {
    const match = /BLA(\d+)/i.exec(note);
    return match ? `BLA${match[1]}` : null;
  }
  if (source.id === "fda-norditropin") {
    const match = /Norditropin \(BLA(\d+)\)/i.exec(note);
    return match ? `BLA${match[1]}` : null;
  }
  if (source.id === "fda-hcg") {
    const match = /BLA(\d+)/i.exec(note);
    return match ? `BLA${match[1]}` : null;
  }
  return null;
}

function indication(profile, source) {
  if (source.id !== "fda-egrifta") return null;
  const note = profile.identity?.identityNote ?? "";
  const match = /Indikation laut Label:\s*(.+)$/i.exec(note);
  return match ? match[1].trim() : null;
}

const records = [];
const reviewActions = [];

for (const profile of Object.values(published.profiles)) {
  for (const source of profile.sources ?? []) {
    if (source.sourceType !== "regulatory") continue;
    const authority = inferAuthority(source.url);
    const noMatch = /no product match/i.test(source.title) || /no blend NDA searched/i.test(source.title);
    const ovitrelle = source.id === "ema-ovitrelle" || /not urinary hCG/i.test(source.title);
    const overlay = mapOverlay(profile.regulatoryStatus);
    const oral = /ORAL SEMAGLUTIDE/i.test(source.title);
    let status;
    let region;
    let isCurrent = true;
    let reviewStatus = "approved";
    let note = null;
    if (ovitrelle) {
      status = "unknown";
      region = "EU";
      isCurrent = false;
      reviewStatus = "review-required";
      note =
        "Related recombinant choriogonadotropin alfa (Ovitrelle), not urinary hCG. Not stored as a current EU approval for the urinary hCG substance.";
    } else if (noMatch) {
      status = overlay === "not_approved" ? "insufficient_information" : overlay;
      region = authority === "fda" ? "US" : authority === "ema" ? "EU" : "unspecified";
      note = "openFDA/label search found no product match; that is not stored as not_approved.";
    } else if (authority === "fda") {
      status = "approved_specific_indication";
      region = "US";
    } else if (authority === "ema") {
      status = "approved_specific_indication";
      region = "EU";
    } else {
      status = overlay;
      region = "unspecified";
      reviewStatus = "review-required";
    }
    if (oral) {
      reviewStatus = "review-required";
      note =
        "DailyMed title says OZEMPIC (ORAL SEMAGLUTIDE); identityNote lists oral tablets as NDA213051. Not treated as a second current Ozempic s.c. NDA.";
    }
    records.push({
      stable_key: `${profile.slug}:${source.id}`,
      substance_slug: profile.slug,
      authority,
      region,
      status,
      indication: indication(profile, source),
      product_name: productNameFromTitle(source.title),
      application_id: applicationId(profile, source),
      legacy_source_id: source.id,
      effective_date: source.publicationDate,
      last_checked: source.accessDate,
      is_current: isCurrent,
      note,
      review_status: reviewStatus,
    });
  }
  for (const item of profile.reviewItems ?? []) {
    reviewActions.push({
      entity_type: "substance",
      entity_stable_key: profile.slug,
      action: "request_review",
      previous_status: null,
      new_status: profile.reviewStatus,
      reason: `[${item.priority}] ${item.topic}: ${item.note}`,
    });
  }
}

const seed = `
insert into public.regulatory_records (
  stable_key, substance_id, authority, region, status, indication, product_name,
  application_id, source_id, effective_date, last_checked, is_current, note, review_status
)
select
  x.stable_key,
  sub.id,
  x.authority,
  x.region,
  x.status,
  x.indication,
  x.product_name,
  x.application_id,
  src.id,
  x.effective_date,
  x.last_checked,
  x.is_current,
  x.note,
  x.review_status
from jsonb_to_recordset($phase4_regulatory$
${JSON.stringify(records)}
$phase4_regulatory$::jsonb) as x(
  stable_key text,
  substance_slug text,
  authority text,
  region text,
  status text,
  indication text,
  product_name text,
  application_id text,
  legacy_source_id text,
  effective_date text,
  last_checked text,
  is_current boolean,
  note text,
  review_status text
)
join public.substances sub on sub.slug = x.substance_slug
join public.sources src on src.legacy_ids @> array[x.legacy_source_id];

insert into public.review_actions (
  entity_type, entity_id, entity_stable_key, action, previous_status, new_status, reason
)
select
  x.entity_type,
  sub.id,
  x.entity_stable_key,
  x.action,
  x.previous_status,
  x.new_status,
  x.reason
from jsonb_to_recordset($phase4_review_actions$
${JSON.stringify(reviewActions)}
$phase4_review_actions$::jsonb) as x(
  entity_type text,
  entity_stable_key text,
  action text,
  previous_status text,
  new_status text,
  reason text
)
join public.substances sub on sub.slug = x.entity_stable_key;
`;

const existing = readFileSync(migrationPath, "utf8");
const markerAt = existing.indexOf(MARKER);
if (markerAt < 0) throw new Error("missing BEGIN GENERATED SEED marker");
writeFileSync(migrationPath, existing.slice(0, markerAt + MARKER.length) + seed);

console.log(
  JSON.stringify(
    {
      regulatory_records: records.length,
      review_actions: reviewActions.length,
      history: 0,
      authorities: [...new Set(records.map((row) => row.authority))],
      regions: [...new Set(records.map((row) => row.region))],
      not_approved: records.filter((row) => row.status === "not_approved").length,
      review_required_records: records.filter((row) => row.review_status === "review-required").length,
      current: records.filter((row) => row.is_current).length,
    },
    null,
    2,
  ),
);
