/**
 * Official-API research fetch. Writes compact cache JSON.
 * ClinicalTrials.gov API v2, NCBI E-utilities, openFDA, PubChem PUG.
 * No scraping. No Reddit.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "src/research/cache/fetched");
const UA = "PeptixResearch/1.0 (scientific catalog; official APIs only)";
const ACCESS = new Date().toISOString().slice(0, 10);

const BATCH = [
  { slug: "retatrutide", terms: ["retatrutide", "LY3437943"], fda: ["retatrutide"] },
  { slug: "tirzepatide", terms: ["tirzepatide", "LY3298176"], fda: ["tirzepatide"] },
  { slug: "semaglutide", terms: ["semaglutide"], fda: ["semaglutide"] },
  { slug: "liraglutide", terms: ["liraglutide"], fda: ["liraglutide"] },
  { slug: "cagrilintide", terms: ["cagrilintide"], fda: ["cagrilintide"] },
  { slug: "mazdutide", terms: ["mazdutide", "IBI362", "LY3305677"], fda: ["mazdutide"] },
  { slug: "orforglipron", terms: ["orforglipron", "LY3502970"], fda: ["orforglipron"] },
  { slug: "tesamorelin", terms: ["tesamorelin"], fda: ["tesamorelin"] },
  { slug: "cjc-1295", terms: ["CJC-1295", "CJC1295"], fda: ["CJC-1295"] },
  { slug: "ipamorelin", terms: ["ipamorelin"], fda: ["ipamorelin"] },
  { slug: "bpc-157", terms: ["BPC-157", "BPC157", '"body protection compound 157"'], fda: ["BPC-157"] },
  { slug: "tb-500", terms: ["TB-500", "TB500"], fda: ["TB-500"] },
  { slug: "ghk-cu", terms: ["GHK-Cu", '"glycyl-L-histidyl-L-lysine" copper'], fda: ["GHK-Cu"] },
  { slug: "mots-c", terms: ["MOTS-c", "MOTS-C"], fda: ["MOTS-c"] },
  { slug: "aod-9604", terms: ["AOD9604", "AOD-9604"], fda: ["AOD-9604"] },
];

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { parseError: true, preview: text.slice(0, 400) };
  }
  return { ok: res.ok, status: res.status, body };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchTrials(term) {
  const fields = [
    "NCTId",
    "BriefTitle",
    "OfficialTitle",
    "OverallStatus",
    "Phase",
    "LeadSponsorName",
    "StartDateStruct",
    "PrimaryCompletionDateStruct",
    "CompletionDateStruct",
    "EnrollmentCount",
    "HasResults",
    "LastUpdatePostDateStruct",
  ].join("%2C");
  const url = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(term)}&pageSize=20&countTotal=true&sort=LastUpdatePostDate%3Adesc&fields=${fields}`;
  return getJson(url);
}

function compactTrials(body) {
  const studies = Array.isArray(body?.studies) ? body.studies : [];
  return {
    totalCount: body?.totalCount ?? studies.length,
    studies: studies.map((study) => {
      const p = study.protocolSection ?? {};
      const id = p.identificationModule ?? {};
      const status = p.statusModule ?? {};
      const sponsor = p.sponsorCollaboratorsModule ?? {};
      const design = p.designModule ?? {};
      return {
        nctId: id.nctId ?? null,
        title: id.briefTitle ?? id.officialTitle ?? null,
        status: status.overallStatus ?? null,
        phase: Array.isArray(design.phases) ? design.phases.join(", ") : (design.phase ?? null),
        sponsor: sponsor.leadSponsor?.name ?? null,
        enrollment: design.enrollmentInfo?.count ?? null,
        start: status.startDateStruct?.date ?? null,
        completion: status.completionDateStruct?.date ?? status.primaryCompletionDateStruct?.date ?? null,
        lastUpdate: status.lastUpdatePostDateStruct?.date ?? null,
        hasResults: study.hasResults ?? false,
        url: id.nctId ? `https://clinicaltrials.gov/study/${id.nctId}` : null,
      };
    }),
  };
}

async function fetchPubmed(term) {
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=15&sort=relevance&term=${encodeURIComponent(term)}&tool=peptix&email=research@localhost`;
  const search = await getJson(searchUrl);
  const ids = search.body?.esearchresult?.idlist ?? [];
  const count = Number(search.body?.esearchresult?.count ?? 0);
  if (ids.length === 0) return { ok: search.ok, status: search.status, count, articles: [] };
  await sleep(350);
  const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}&tool=peptix&email=research@localhost`;
  const summary = await getJson(summaryUrl);
  const result = summary.body?.result ?? {};
  const articles = ids.map((pmid) => {
    const row = result[pmid] ?? {};
    const articleIds = Array.isArray(row.articleids) ? row.articleids : [];
    const doi = articleIds.find((item) => item.idtype === "doi")?.value ?? null;
    return {
      pmid,
      title: row.title ?? null,
      source: row.source ?? null,
      pubdate: row.pubdate ?? null,
      authors: Array.isArray(row.authors) ? row.authors.slice(0, 6).map((a) => a.name).filter(Boolean) : [],
      pubtype: Array.isArray(row.pubtype) ? row.pubtype : [],
      doi,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    };
  });
  return { ok: search.ok && summary.ok, status: summary.status, count, articles };
}

async function fetchFda(name) {
  const url = `https://api.fda.gov/drug/drugsfda.json?search=${encodeURIComponent(`openfda.generic_name:"${name}"`)}&limit=5`;
  const res = await getJson(url);
  if (!res.ok) {
    return {
      ok: res.status === 404,
      status: res.status,
      found: false,
      message: res.body?.error?.message ?? "not found or error",
      products: [],
    };
  }
  const results = Array.isArray(res.body?.results) ? res.body.results : [];
  return {
    ok: true,
    status: res.status,
    found: results.length > 0,
    products: results.map((row) => ({
      sponsor: row.sponsor_name ?? null,
      application: row.application_number ?? null,
      products: (row.products ?? []).slice(0, 8).map((p) => ({
        brand: p.brand_name ?? null,
        active: p.active_ingredients ?? null,
        marketing: p.marketing_status ?? null,
        dosageForm: p.dosage_form ?? null,
        route: p.route ?? null,
      })),
    })),
  };
}

async function fetchPubchem(name) {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES/JSON`;
  const res = await getJson(url);
  const props = res.body?.PropertyTable?.Properties?.[0] ?? null;
  let cid = props?.CID ?? null;
  let cas = null;
  if (cid) {
    await sleep(200);
    const syn = await getJson(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/synonyms/JSON`);
    const list = syn.body?.InformationList?.Information?.[0]?.Synonym ?? [];
    cas = list.find((item) => /^\d{2,7}-\d{2}-\d$/.test(item)) ?? null;
  }
  return {
    ok: Boolean(props),
    status: res.status,
    cid,
    cas,
    formula: props?.MolecularFormula ?? null,
    iupac: props?.IUPACName ?? null,
  };
}

await mkdir(OUT, { recursive: true });

for (const item of BATCH) {
  const record = {
    slug: item.slug,
    accessDate: ACCESS,
    queries: item.terms,
    connectors: {},
  };

  const trialTerm = item.terms[0];
  const trials = await fetchTrials(trialTerm);
  record.connectors.clinicaltrials = {
    status: trials.ok ? "checked" : "unavailable",
    httpStatus: trials.status,
    query: trialTerm,
    ...(trials.ok ? compactTrials(trials.body) : { error: trials.body }),
  };
  await sleep(400);

  const pubmedTerm = `${item.terms[0]} AND (clinical trial OR randomized OR safety OR pharmacokinetics OR systematic review)`;
  const pubmed = await fetchPubmed(pubmedTerm);
  record.connectors.pubmed = {
    status: pubmed.ok ? "checked" : "unavailable",
    httpStatus: pubmed.status,
    query: pubmedTerm,
    count: pubmed.count,
    articles: pubmed.articles,
  };
  await sleep(400);

  const fda = await fetchFda(item.fda[0]);
  record.connectors.fda = {
    status: fda.ok || fda.status === 404 ? "checked" : "unavailable",
    httpStatus: fda.status,
    query: item.fda[0],
    found: fda.found ?? false,
    products: fda.products ?? [],
    message: fda.message ?? null,
  };
  await sleep(400);

  const pubchem = await fetchPubchem(item.terms[0]);
  record.connectors.pubchem = {
    status: pubchem.status === 200 || pubchem.status === 404 ? "checked" : "unavailable",
    httpStatus: pubchem.status,
    ...pubchem,
  };

  const path = resolve(OUT, `${item.slug}.json`);
  await writeFile(path, JSON.stringify(record, null, 2));
  console.log(`wrote ${item.slug} trials=${record.connectors.clinicaltrials.totalCount ?? 0} pubmed=${pubmed.count ?? 0} fda=${record.connectors.fda.found}`);
  await sleep(500);
}

console.log("done", ACCESS);
