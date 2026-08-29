/**
 * Batch 03 recency/coverage analysis vs published.json.
 * Does not write production. Does not mutate published.json.
 * New hits stay review-required unless they already exist as published rows.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FETCHED = resolve(ROOT, "src/research/cache/fetched/batch03");
const PUBLISHED = resolve(ROOT, "src/lib/peptide/profiles/published.json");
const ACCESS = new Date().toISOString().slice(0, 10);

const HUDSON = new Set(["NCT07487363", "NCT07437560"]);
const UNRESOLVED_REGULATORY = ["hcg:ema-ovitrelle", "semaglutide:fda-semaglutide-27f15fac"];
const UNRESOLVED_MAPPING = ["BT*", "MT1", "KL80", "multi-INN blends", "fragments", "amides"];

function keepStudy(slug, study) {
  if (!study?.nctId || !/^NCT\d{8}$/.test(study.nctId)) return false;
  if (HUDSON.has(study.nctId)) return false;
  const title = study.title ?? "";
  if (/mock study|fictional study|example of a ClinicalTrials\.gov-style/i.test(title)) return false;
  if (study.sponsor === "Hudson Biotech") return false;
  if (slug === "ghk-cu" && !/ghk/i.test(title)) return false;
  if (slug === "ghk-cu" && /x39 patch/i.test(title)) return false;
  if (slug === "bpc-157" && /gummies/i.test(title)) return false;
  if (slug === "ipamorelin" && !/ipamorelin/i.test(title)) return false;
  if (slug === "tesamorelin" && !/tesamorelin|egrifta|th9507/i.test(title)) return false;
  if (slug === "retatrutide") return /retatrutide|ly3437943/i.test(title);
  if (slug === "tirzepatide") return /tirzepatide|ly3298176|mounjaro|zepbound/i.test(title);
  if (slug === "semaglutide") return /semaglutide|ozempic|wegovy|rybelsus/i.test(title);
  if (slug === "liraglutide") return /liraglutide|victoza|saxenda/i.test(title);
  if (slug === "cagrilintide") return /cagrilintide/i.test(title);
  if (slug === "mazdutide") return /mazdutide|ibi362|ly3305677/i.test(title);
  if (slug === "cjc-1295") return /cjc-?1295/i.test(title);
  if (slug === "aod-9604") return /aod-?9604/i.test(title);
  if (slug === "orforglipron" && !/orforglipron|ly3502970|foundayo/i.test(title)) return false;
  if (slug === "mots-c") {
    if (!/mots/i.test(title)) return false;
    if (/anesthesia|fasting|breast cancer|sglt2/i.test(title) && !/mots-c for /i.test(title)) return false;
    if (/platelet|b-amyloid|mortality of type/i.test(title)) return false;
  }
  if (slug === "tb-500" && /thymosin beta 4(?! 17-23)/i.test(title) && !/fragment/i.test(title)) return false;
  if (slug === "thymosin-beta-4") {
    if (/tb-500/i.test(title) && /fragment/i.test(title)) return false;
    return /thymosin beta|rgn-259|timbetasin|nl005/i.test(title);
  }
  if (slug === "thymosin-alpha-1") return /thymalfasin|thymosin.?alpha|tα1|ta1\b|zadaxin/i.test(title);
  if (slug === "sermorelin") return /sermorelin|geref/i.test(title);
  if (slug === "semax") return /semax/i.test(title);
  if (slug === "selank") return /selank/i.test(title);
  if (slug === "kpv") return /\bkpv\b|lys-pro-val|lysine-proline-valine/i.test(title);
  if (slug === "igf-1-lr3") return /lr3|long r3/i.test(title);
  if (slug === "melanotan-ii") return /melanotan/i.test(title) && !/afamelanotide|scenesse/i.test(title);
  if (slug === "gonadorelin") return /gonadorelin|factrel|lutrelef/i.test(title);
  if (slug === "hcg") return /chorionic gonadotropin|\bhcg\b|choriogonadotropin/i.test(title);
  if (slug === "somatropin") {
    return /somatropin|norditropin|omnitrope|humatrope|serostim|genotropin|nutropin|saizen/i.test(title);
  }
  return true;
}

function keepArticle(slug, article) {
  const title = article.title ?? "";
  if (!title) return false;
  if (slug === "selank") return /selank/i.test(title);
  if (slug === "semax") return /semax/i.test(title);
  if (slug === "sermorelin") return /sermorelin|geref|ghrh\s*\(?1-29|grf\s*\(?1-29/i.test(title);
  if (slug === "melanotan-ii") return /melanotan/i.test(title) && !/afamelanotide|scenesse/i.test(title);
  if (slug === "igf-1-lr3") return /lr3|long r3/i.test(title) && !/sheep|rumen/i.test(title);
  if (slug === "kpv") return /\bkpv\b|lysine-proline-valine|lys-pro-val/i.test(title);
  if (slug === "thymosin-beta-4") return /thymosin\s*beta|tβ4|rgn-259|timbetasin/i.test(title) && !/tb-500/i.test(title);
  if (slug === "thymosin-alpha-1") return /thymosin\s*alpha|thymalfasin|zadaxin|tα1/i.test(title);
  if (slug === "gonadorelin") return /gonadorelin|factrel|lutrelef/i.test(title);
  if (slug === "hcg") return /chorionic gonadotropin|\bhcg\b|choriogonadotropin/i.test(title);
  if (slug === "somatropin") {
    return /somatropin|norditropin|omnitrope|humatrope|serostim|genotropin|nutropin|saizen/i.test(title);
  }
  if (slug === "retatrutide") return /retatrutide|ly3437943/i.test(title);
  if (slug === "tirzepatide") return /tirzepatide|ly3298176|mounjaro|zepbound/i.test(title);
  if (slug === "semaglutide") return /semaglutide|ozempic|wegovy|rybelsus/i.test(title);
  if (slug === "liraglutide") return /liraglutide|victoza|saxenda/i.test(title);
  if (slug === "cagrilintide") return /cagrilintide/i.test(title);
  if (slug === "mazdutide") return /mazdutide|ibi362|ly3305677/i.test(title);
  if (slug === "cjc-1295") return /cjc-?1295/i.test(title);
  if (slug === "aod-9604") return /aod-?9604/i.test(title);
  return true;
}

function rejectReason(slug, study) {
  if (!study?.nctId) return "missing-nct";
  if (HUDSON.has(study.nctId)) return "hudson-exclusion";
  if (/mock study|fictional study|example of a ClinicalTrials\.gov-style/i.test(study.title ?? "")) {
    return "fictional-or-mock";
  }
  if (study.sponsor === "Hudson Biotech") return "hudson-sponsor";
  if (!keepStudy(slug, study)) return "title-or-identity-filter";
  return null;
}

function articleRejectReason(slug, article) {
  if (!article?.pmid) return "missing-pmid";
  if (!keepArticle(slug, article)) return "title-or-identity-filter";
  return null;
}

const published = JSON.parse(await readFile(PUBLISHED, "utf8"));
const profiles = published.profiles ?? published;
const files = (await readdir(FETCHED)).filter((name) => name.endsWith(".json") && !name.includes("regulatory") && !name.includes("analysis") && !name.includes("run"));

let regulatory = null;
try {
  regulatory = JSON.parse(await readFile(resolve(FETCHED, "regulatory-check.json"), "utf8"));
} catch {
  regulatory = null;
}

const substances = [];
const sourcesAccepted = [];
const sourcesRejected = [];
const studiesAccepted = [];
const studiesRejected = [];
const studiesPublishedExisting = [];
let sourcesQueried = 0;
let studiesFound = 0;

for (const file of files.sort()) {
  const cache = JSON.parse(await readFile(resolve(FETCHED, file), "utf8"));
  const slug = cache.slug;
  const profile = profiles[slug];
  const publishedNcts = new Set((profile?.studies ?? []).map((row) => row.clinicalTrialId).filter(Boolean));
  const publishedPmids = new Set((profile?.sources ?? []).map((row) => row.pmid).filter(Boolean));

  const ct = cache.connectors?.clinicaltrials ?? {};
  const pm = cache.connectors?.pubmed ?? {};
  const fda = cache.connectors?.fda ?? {};
  const rawStudies = Array.isArray(ct.studies) ? ct.studies : [];
  const rawArticles = Array.isArray(pm.articles) ? pm.articles : [];
  sourcesQueried += 1 + rawStudies.length + rawArticles.length + (fda.found ? 1 : 1);
  studiesFound += Number(ct.totalCount ?? rawStudies.length);

  const latestTrial = rawStudies
    .filter((row) => keepStudy(slug, row))
    .sort((a, b) => String(b.lastUpdate ?? "").localeCompare(String(a.lastUpdate ?? "")))[0] ?? null;
  const latestArticle = rawArticles
    .filter((row) => keepArticle(slug, row))
    .sort((a, b) => String(b.pubdate ?? "").localeCompare(String(a.pubdate ?? "")))[0] ?? null;

  for (const study of rawStudies) {
    const reason = rejectReason(slug, study);
    if (reason) {
      studiesRejected.push({ slug, nctId: study.nctId, title: study.title, sponsor: study.sponsor, reason });
      sourcesRejected.push({ slug, kind: "clinical_trial", id: study.nctId, reason });
      continue;
    }
    const already = publishedNcts.has(study.nctId);
    const row = {
      slug,
      nctId: study.nctId,
      title: study.title,
      sponsor: study.sponsor,
      phase: study.phase,
      status: study.status,
      intervention: study.intervention,
      condition: study.condition,
      lastUpdate: study.lastUpdate,
      url: study.url,
      alreadyPublished: already,
      publication: already ? "already-published" : "review-required",
    };
    if (already) studiesPublishedExisting.push(row);
    else studiesAccepted.push(row);
    sourcesAccepted.push({
      slug,
      kind: "clinical_trial",
      id: study.nctId,
      title: study.title,
      quality: "clinical_trial",
      alreadyPublished: already,
      publication: already ? "already-published" : "review-required",
    });
  }

  for (const article of rawArticles) {
    const reason = articleRejectReason(slug, article);
    if (reason) {
      sourcesRejected.push({ slug, kind: "pubmed", id: article.pmid, title: article.title, reason });
      continue;
    }
    const already = publishedPmids.has(article.pmid);
    sourcesAccepted.push({
      slug,
      kind: "pubmed",
      id: article.pmid,
      title: article.title,
      doi: article.doi,
      pubdate: article.pubdate,
      quality: "primary",
      alreadyPublished: already,
      publication: already ? "already-published" : "review-required",
    });
  }

  substances.push({
    slug,
    lastReviewedPublished: profile?.lastReviewedAt ?? null,
    lastReviewedBatch03: ACCESS,
    evidenceLevel: profile?.evidenceLevel ?? null,
    regulatoryStatus: profile?.regulatoryStatus ?? null,
    reviewStatus: profile?.reviewStatus ?? null,
    publishedSources: (profile?.sources ?? []).length,
    publishedStudies: (profile?.studies ?? []).length,
    rawTrialHits: Number(ct.totalCount ?? 0),
    rawPubmedCount: Number(pm.count ?? 0),
    fdaFound: Boolean(fda.found),
    latestScientificSource: latestArticle
      ? { pmid: latestArticle.pmid, title: latestArticle.title, pubdate: latestArticle.pubdate }
      : null,
    latestClinicalTrial: latestTrial
      ? {
          nctId: latestTrial.nctId,
          title: latestTrial.title,
          lastUpdate: latestTrial.lastUpdate,
          status: latestTrial.status,
          phase: latestTrial.phase,
        }
      : null,
    latestRegulatory:
      slug === "orforglipron" || slug === "retatrutide" || slug === "mazdutide"
        ? "see regulatory-check.json"
        : fda.found
          ? "Drugs@FDA match (existing published label policy unchanged)"
          : "Drugs@FDA no match — not treated as not_approved",
  });
}

const glow = profiles["glow-blend"];
substances.push({
  slug: "glow-blend",
  lastReviewedPublished: glow?.lastReviewedAt ?? null,
  lastReviewedBatch03: ACCESS,
  evidenceLevel: glow?.evidenceLevel ?? null,
  regulatoryStatus: glow?.regulatoryStatus ?? null,
  reviewStatus: glow?.reviewStatus ?? null,
  publishedSources: (glow?.sources ?? []).length,
  publishedStudies: (glow?.studies ?? []).length,
  rawTrialHits: 0,
  rawPubmedCount: 0,
  fdaFound: false,
  latestScientificSource: null,
  latestClinicalTrial: null,
  latestRegulatory: "blend — not a unique INN; no separate approval search",
  note: "Product blend (GHK-Cu + TB-500 + BPC-157). Not fetched as a unique substance.",
});

const orforglipronEma = (regulatory?.ema ?? []).filter((row) => /orforglipron|foundayo/i.test(row.slug));
const retatrutideEma = (regulatory?.ema ?? []).find((row) => row.slug === "retatrutide");
const mazdutideEma = (regulatory?.ema ?? []).find((row) => row.slug === "mazdutide");
const orforglipronFda = (regulatory?.fda ?? []).find((row) => row.query === "orforglipron");
const retatrutideFda = (regulatory?.fda ?? []).find((row) => row.query === "retatrutide");

const analysis = {
  batch: "batch-03",
  accessDate: ACCESS,
  productionWrite: false,
  publishedJsonMutated: false,
  community: "unavailable",
  hudsonExclusions: [...HUDSON],
  unresolvedRegulatory: UNRESOLVED_REGULATORY,
  unresolvedMapping: UNRESOLVED_MAPPING,
  evidencePolicy: {
    overlayAFUnchanged: true,
    reviewRequiredNotAutoApproved: true,
    communityCannotRaiseEvidence: true,
  },
  identity: {
    "tb-500_ne_thymosin-beta-4": true,
    "melanotan-ii_ne_afamelanotide": true,
    "igf-1-lr3_ne_mecasermin": true,
    "glow-blend_is_blend": true,
    "hcg_urinary_not_merged_with_ovitrelle": true,
  },
  regulatoryHighlights: {
    orforglipronFdaFound: Boolean(orforglipronFda?.found),
    orforglipronEma: orforglipronEma,
    retatrutideFdaFound: Boolean(retatrutideFda?.found),
    retatrutideEma: retatrutideEma ?? null,
    mazdutideEma: mazdutideEma ?? null,
    retatrutideNotApproved: true,
    orforglipronUsOnlyUntilEmaPrimary: true,
    tesamorelinEmaEgrifta: "withdrawn-2012-not-eu-approval",
  },
  totals: {
    substancesReviewed: substances.length,
    cacheFiles: files.length,
    sourcesQueried,
    sourcesAccepted: sourcesAccepted.length,
    sourcesAcceptedNewReviewRequired: sourcesAccepted.filter((row) => row.publication === "review-required").length,
    sourcesAcceptedAlreadyPublished: sourcesAccepted.filter((row) => row.alreadyPublished).length,
    sourcesRejected: sourcesRejected.length,
    studiesFound,
    studiesValidatedNew: studiesAccepted.length,
    studiesAlreadyPublished: studiesPublishedExisting.length,
    studiesRejected: studiesRejected.length,
    claimsAdded: 0,
    claimsUpdated: 0,
    evidenceChanges: 0,
    regulatoryChanges: 0,
    identityCorrections: 0,
  },
  substances,
  sourcesAccepted,
  sourcesRejected,
  studiesAccepted,
  studiesPublishedExisting,
  studiesRejected,
};

await mkdir(FETCHED, { recursive: true });
await writeFile(resolve(FETCHED, "analysis.json"), JSON.stringify(analysis, null, 2));
console.log(
  JSON.stringify(
    {
      substancesReviewed: analysis.totals.substancesReviewed,
      sourcesAccepted: analysis.totals.sourcesAccepted,
      sourcesAcceptedNew: analysis.totals.sourcesAcceptedNewReviewRequired,
      sourcesRejected: analysis.totals.sourcesRejected,
      studiesNew: analysis.totals.studiesValidatedNew,
      studiesRejected: analysis.totals.studiesRejected,
    },
    null,
    2,
  ),
);
