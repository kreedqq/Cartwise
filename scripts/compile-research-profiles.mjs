/**
 * Compiles fetched official-API cache + curated, cited summaries into published profiles.
 * Does not invent NCT/PMID/approvals. Excludes mock studies.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BATCH_02_SLUGS,
  CURATED_02,
  EMA_02,
  PINNED_NCTS_02,
  PINNED_PMIDS_02,
  compileGlowBlend,
} from "./research-batch-02-curated.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FETCHED = resolve(ROOT, "src/research/cache/fetched");
const OUT = resolve(ROOT, "src/lib/peptide/profiles/published.json");
const ACCESS = "2026-08-28";
const COMMUNITY_MSG = "Reddit community data temporarily unavailable.";

const BATCH = [
  "retatrutide",
  "tirzepatide",
  "semaglutide",
  "liraglutide",
  "cagrilintide",
  "mazdutide",
  "orforglipron",
  "tesamorelin",
  "cjc-1295",
  "ipamorelin",
  "bpc-157",
  "tb-500",
  "ghk-cu",
  "mots-c",
  "aod-9604",
  ...BATCH_02_SLUGS,
];

const PINNED_NCTS = {
  retatrutide: ["NCT06354660", "NCT05929066", "NCT06383390"],
  tesamorelin: ["NCT06554717", "NCT03375788"],
  orforglipron: ["NCT07241390"],
  cagrilintide: ["NCT07220642"],
  "cjc-1295": ["NCT00267527"],
  ipamorelin: ["NCT00672074", "NCT01280344"],
  "bpc-157": ["NCT02637284"],
  ...PINNED_NCTS_02,
};

const PINNED_PMIDS = {
  mazdutide: ["36247927", "38092790", "41028652"],
  ipamorelin: ["9733496"],
  "ghk-cu": ["25731775", "18350235"],
  "mots-c": ["39160573", "41593376", "34445477"],
  "cjc-1295": ["16352683"],
  cagrilintide: ["34798060"],
  retatrutide: ["37366315", "37385280", "42250575"],
  ...PINNED_PMIDS_02,
};

const EXTRA_ARTICLES = {
  mazdutide: [
    {
      pmid: "41028652",
      title: "Mazdutide: First Approval.",
      source: "Drugs",
      pubdate: "2025 Dec",
      doi: "10.1007/s40265-025-02249-y",
      url: "https://pubmed.ncbi.nlm.nih.gov/41028652/",
      pubtype: ["Journal Article", "Review"],
    },
  ],
};

const EMA = {
  semaglutide: [
    { id: "ema-ozempic", title: "Ozempic EPAR", url: "https://www.ema.europa.eu/en/medicines/human/EPAR/ozempic" },
    { id: "ema-wegovy", title: "Wegovy EPAR", url: "https://www.ema.europa.eu/en/medicines/human/EPAR/wegovy" },
  ],
  tirzepatide: [{ id: "ema-mounjaro", title: "Mounjaro EPAR", url: "https://www.ema.europa.eu/en/medicines/human/EPAR/mounjaro" }],
  liraglutide: [
    { id: "ema-victoza", title: "Victoza EPAR", url: "https://www.ema.europa.eu/en/medicines/human/EPAR/victoza" },
    { id: "ema-saxenda", title: "Saxenda EPAR", url: "https://www.ema.europa.eu/en/medicines/human/EPAR/saxenda" },
  ],
  ...EMA_02,
};

function cited(text, sourceIds) {
  return { text, sourceIds };
}

function dailymed(setId) {
  return `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setId}`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function keepStudy(slug, study) {
  if (!study?.nctId || !/^NCT\d{8}$/.test(study.nctId)) return false;
  const title = study.title ?? "";
  if (/mock study|fictional study|example of a ClinicalTrials\.gov-style/i.test(title)) return false;
  if (study.sponsor === "Hudson Biotech") return false;
  if (slug === "ghk-cu" && !/ghk/i.test(title)) return false;
  if (slug === "ghk-cu" && /x39 patch/i.test(title)) return false;
  if (slug === "bpc-157" && /gummies/i.test(title)) return false;
  if (slug === "ipamorelin" && !/ipamorelin/i.test(title)) return false;
  if (slug === "tesamorelin" && !/tesamorelin|egrifta|th9507/i.test(title)) return false;
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
  if (slug === "somatropin") return /somatropin|norditropin|omnitrope|humatrope|serostim|genotropin|nutropin|saizen/i.test(title);
  return true;
}

function keepArticle(slug, article) {
  const title = article.title ?? "";
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
  if (slug === "somatropin") return /somatropin|norditropin|omnitrope|humatrope|serostim|genotropin|nutropin|saizen/i.test(title);
  return true;
}

function pubmedQuality(article) {
  const types = (article.pubtype ?? []).join(" ").toLowerCase();
  if (types.includes("meta-analysis") || types.includes("network meta-analysis")) return { keep: true, rank: 1 };
  if (types.includes("systematic review")) return { keep: true, rank: 2 };
  if (types.includes("randomized") || types.includes("phase ii") || types.includes("phase iii") || types.includes("phase 2") || types.includes("phase 3"))
    return { keep: true, rank: 3 };
  if (types.includes("clinical trial")) return { keep: true, rank: 4 };
  if (types.includes("review")) return { keep: true, rank: 5 };
  return { keep: true, rank: 6 };
}

const CURATED = {
  retatrutide: {
    evidenceLevel: "B",
    confidenceLevel: "moderate",
    regulatoryStatus: "clinical-development",
    reviewStatus: "review-recommended",
    regulatoryRegions: [],
    chemicalClass: "GIP/GLP-1/glucagon receptor agonist",
    moleculeType: "peptide",
    identityNote: "Entwicklungsname LY3437943. In der FDA-Drugs@FDA-Suche vom 28.08.2026 kein zugelassenes Produkt gefunden.",
    summary: (ids) => ({
      whatIsIt: cited(
        "Retatrutide (LY3437943) ist ein investigativer tripler Rezeptoragonist (GIP, GLP-1 und Glucagon), der in randomisierten Studien bei Adipositas und Typ-2-Diabetes untersucht wird.",
        [ids.pmid("37366315"), ids.pmid("37385280")],
      ),
      mechanism: cited(
        "In peer-reviewed Phase-2-Publikationen wird Retatrutide als Agonist an GIP-, GLP-1- und Glucagon-Rezeptoren beschrieben.",
        [ids.pmid("37366315"), ids.pmid("37385280")],
      ),
      whatHasBeenStudied: cited(
        "Untersucht wurden unter anderem Adipositas, Typ-2-Diabetes, metabolische Lebererkrankung und registrierte Phase-3-Programme; ClinicalTrials.gov listete am 28.08.2026 34 Studien zum Suchterm retatrutide.",
        [ids.nct("NCT05929066"), ids.pmid("37366315"), ids.ctCount],
      ),
      humanEvidence: cited(
        "Humane randomisierte Phase-2-Studien sind publiziert (Adipositas; Typ-2-Diabetes). Eine Phase-3-Publikation zu TRANSCEND-T2D-1 ist in PubMed indexiert. Eine FDA-Zulassung war in Drugs@FDA nicht nachweisbar.",
        [ids.pmid("37366315"), ids.pmid("37385280"), ids.pmid("42250575"), ids.fdaNone],
      ),
      preclinicalEvidence: cited(
        "Präklinische Mechanismusangaben in den klinischen Publikationen sind sekundär; eigenständige belastbare Präklinik-Datensätze wurden in diesem Scan nicht als Primärquellen kuratiert.",
        [ids.pmid("37366315")],
      ),
      safety: cited(
        "In den Phase-2-Publikationen werden gastrointestinale Ereignisse als häufige behandlungsbedingte Effekte beschrieben. Eine vollständige regulatorische Fachinformation liegt nicht vor.",
        [ids.pmid("37366315"), ids.pmid("37385280")],
      ),
      currentResearch: cited(
        "Phase-3-Programme (u. a. TRIUMPH/TRANSCEND) sind bei ClinicalTrials.gov registriert, darunter abgeschlossene und noch laufende Studien. Stand der Abfrage: 28.08.2026.",
        [ids.nct("NCT06383390"), ids.nct("NCT05929066"), ids.nct("NCT06354660")],
      ),
      unknowns: cited(
        "Langzeitsicherheit, kardiovaskuläre Endpunkte und ein abschließender Zulassungsstatus in den USA/EU sind aus den geprüften Quellen nicht als abgeschlossen belegt.",
        [ids.fdaNone, ids.nct("NCT06383390")],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "human", severity: "common", text: "Gastrointestinale unerwünschte Ereignisse wurden in randomisierten Phase-2-Studien berichtet.", sourceIds: [ids.pmid("37366315"), ids.pmid("37385280")] },
    ],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste aus einer zugelassenen Fachinformation identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [],
    reviewItems: (ids) => [
      {
        id: "retatrutide-reg-recency",
        priority: "Medium",
        topic: "Phase-3-Recency vs. fehlende Zulassung",
        note: "Phase-3-Programme und eine TRANSCEND-T2D-1-Publikation existieren. Eine FDA-/EMA-Zulassung war in den geprüften Behördquellen nicht nachweisbar. Status bleibt klinische Entwicklung, nicht zugelassen.",
        sourceIds: [ids.pmid("42250575"), ids.fdaNone],
      },
    ],
  },
  tirzepatide: {
    evidenceLevel: "A",
    confidenceLevel: "high",
    regulatoryStatus: "approved-specific",
    reviewStatus: "fresh",
    regulatoryRegions: ["US", "EU"],
    chemicalClass: "GIP/GLP-1 receptor agonist",
    moleculeType: "peptide",
    identityNote: "FDA-zugelassene Fertigarzneimittel u. a. Mounjaro (NDA215866) und Zepbound (NDA217806). Compounded/non-approved Formen sind damit nicht gleichzusetzen.",
    summary: (ids) => ({
      whatIsIt: cited(
        "Tirzepatide ist ein dualer GIP- und GLP-1-Rezeptoragonist. Zugelassene Fertigprodukte sind in der FDA-Fachinformation für Mounjaro (glykämische Kontrolle bei Typ-2-Diabetes) und Zepbound (Gewicht/OSA bei Adipositas) beschrieben.",
        [ids.fda("fda-mounjaro"), ids.fda("fda-zepbound")],
      ),
      mechanism: cited(
        "Laut FDA-Fachinformation bindet und aktiviert Tirzepatide GIP- und GLP-1-Rezeptoren; eine C20-Fettsäurediacid-Kette ermöglicht Albuminbindung und verlängert die Halbwertszeit.",
        [ids.fda("fda-mounjaro")],
      ),
      whatHasBeenStudied: cited(
        "Neben den zugelassenen Indikationen sind zahlreiche weitere Studien bei ClinicalTrials.gov registriert (Abfrage 28.08.2026: 292 Treffer zum Term tirzepatide).",
        [ids.ctCount, ids.fda("fda-mounjaro")],
      ),
      humanEvidence: cited(
        "Starke Humanevidenz liegt über zugelassene Fachinformationen und umfangreiche klinische Entwicklungsprogramme vor. EMA führt ein EPAR für Mounjaro.",
        [ids.fda("fda-mounjaro"), ids.fda("fda-zepbound"), ids.ema("ema-mounjaro")],
      ),
      preclinicalEvidence: cited(
        "Die FDA-Boxed-Warning beschreibt schilddrüsen-C-Zell-Tumoren in Nagetieren unter Tirzepatide; die Humane Relevanz ist laut Label unbestimmt.",
        [ids.fda("fda-mounjaro")],
      ),
      safety: cited(
        "FDA-Label: Boxed Warning zu Thyroid-C-Zell-Tumoren im Tiermodell; Kontraindikationen u. a. persönliche/familiäre MTC-Anamnese und MEN2; Warnungen zu Pankreatitis und gastrointestinalen Reaktionen.",
        [ids.fda("fda-mounjaro"), ids.fda("fda-zepbound")],
      ),
      currentResearch: cited(
        "Weitere klinische Fragestellungen (u. a. kardiovaskuläre und metabolische Komorbiditäten) sind in registrierten Studien abgebildet. Die zugelassenen Indikationen ergeben sich aus den Labels, nicht aus jeder CT.gov-Registrierung.",
        [ids.ctCount, ids.fda("fda-zepbound")],
      ),
      unknowns: cited(
        "Langzeitdaten außerhalb der zugelassenen Indikationen und die Übertragbarkeit auf nicht zugelassene Compounded-Produkte sind durch die geprüften Labels nicht abgedeckt.",
        [ids.fda("fda-mounjaro")],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "animal", severity: "warning", text: "FDA Boxed Warning: dosisabhängige Thyroid-C-Zell-Tumoren in Ratten; humane Relevanz unbestimmt.", sourceIds: [ids.fda("fda-mounjaro")] },
      { domain: "human", severity: "serious", text: "Fachinformation: akute Pankreatitis unter GLP-1-Rezeptoragonisten beobachtet; bei Verdacht absetzen.", sourceIds: [ids.fda("fda-mounjaro")] },
      { domain: "human", severity: "warning", text: "Zepbound-Label: schwere gastrointestinale Reaktionen; nicht empfohlen bei schwerer Gastroparese.", sourceIds: [ids.fda("fda-zepbound")] },
    ],
    interactions: (ids) => [
      { category: "established", text: "Fachinformation: kombinierte Anwendung mit Insulinsekretagogum oder Insulin kann Hypoglykämierisiko erhöhen.", sourceIds: [ids.fda("fda-mounjaro")] },
    ],
    reconstitution: (ids) =>
      cited(
        "Zugelassene Produkte sind Fertigpens/-lösungen laut FDA-Label. Keine standardisierte Rekonstitutionsanweisung für Research-Vials in den geprüften Fachinformationen identifiziert.",
        [ids.fda("fda-mounjaro")],
      ),
    conflicts: [],
    reviewItems: () => [],
  },
  semaglutide: {
    evidenceLevel: "A",
    confidenceLevel: "high",
    regulatoryStatus: "approved-specific",
    reviewStatus: "fresh",
    regulatoryRegions: ["US", "EU"],
    chemicalClass: "GLP-1 receptor agonist",
    moleculeType: "peptide",
    identityNote: "FDA-Labels u. a. für Ozempic (s.c., NDA209637) und orale Semaglutid-Tabletten (NDA213051). EMA-EPARs für Ozempic und Wegovy waren am 28.08.2026 erreichbar.",
    summary: (ids) => ({
      whatIsIt: cited(
        "Semaglutid ist ein GLP-1-Rezeptoragonist. Zugelassene Darreichungen umfassen laut FDA-Label subkutane Injektion (Ozempic) und orale Tabletten; EMA veröffentlicht EPARs für Ozempic und Wegovy.",
        [ids.fda("fda-ozempic"), ids.ema("ema-ozempic"), ids.ema("ema-wegovy")],
      ),
      mechanism: cited(
        "Laut FDA-Fachinformation ist Semaglutid ein GLP-1-Analogon mit 94 % Sequenzhomologie zu humanem GLP-1 und aktiviert den GLP-1-Rezeptor.",
        [ids.fda("fda-ozempic")],
      ),
      whatHasBeenStudied: cited(
        "Zugelassene Indikationen umfassen glykämische Kontrolle und kardiovaskuläre Risikoreduktion bei Typ-2-Diabetes (Ozempic-Label). ClinicalTrials.gov listete am 28.08.2026 773 Treffer zum Term semaglutide.",
        [ids.fda("fda-ozempic"), ids.ctCount],
      ),
      humanEvidence: cited(
        "Starke Humanevidenz über zugelassene FDA-Labels und EMA-EPARs. Zusätzlich umfangreiche PubMed-Treffer (Abfrage 28.08.2026).",
        [ids.fda("fda-ozempic"), ids.ema("ema-ozempic"), ids.pmCount],
      ),
      preclinicalEvidence: cited(
        "Boxed Warning: in Nagetieren Thyroid-C-Zell-Tumoren; humane Relevanz laut Label unbestimmt.",
        [ids.fda("fda-ozempic")],
      ),
      safety: cited(
        "FDA-Label: Boxed Warning Thyroid-C-Zell-Tumoren (Tier); Kontraindikationen MTC/MEN2; Warnungen u. a. Pankreatitis und diabetische Retinopathie-Komplikationen.",
        [ids.fda("fda-ozempic")],
      ),
      currentResearch: cited(
        "Zahlreiche laufende und geplante Studien sind registriert. Aussagen zu Off-Label-Fragestellungen folgen nicht automatisch aus der Zulassung.",
        [ids.ctCount, ids.fda("fda-ozempic")],
      ),
      unknowns: cited(
        "Nicht zugelassene Compounded-Formen sind durch die geprüften Fachinformationen nicht bewertet.",
        [ids.fda("fda-ozempic")],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "animal", severity: "warning", text: "FDA Boxed Warning: Thyroid-C-Zell-Tumoren in Nagetieren; humane Relevanz unbestimmt.", sourceIds: [ids.fda("fda-ozempic")] },
      { domain: "human", severity: "serious", text: "Fachinformation: akute Pankreatitis beobachtet; bei Verdacht absetzen.", sourceIds: [ids.fda("fda-ozempic")] },
      { domain: "human", severity: "warning", text: "Fachinformation: Komplikationen diabetischer Retinopathie in einer klinischen Studie berichtet.", sourceIds: [ids.fda("fda-ozempic")] },
    ],
    interactions: (ids) => [
      { category: "established", text: "Fachinformation: Hypoglykämie bei gleichzeitiger Verwendung von Insulinsekretagoga oder Insulin.", sourceIds: [ids.fda("fda-ozempic")] },
    ],
    reconstitution: (ids) =>
      cited(
        "Zugelassene Ozempic-Produkte sind Fertigpens laut Label. Keine Research-Vial-Rekonstitution in der geprüften Fachinformation identifiziert.",
        [ids.fda("fda-ozempic")],
      ),
    conflicts: [],
    reviewItems: () => [],
  },
  liraglutide: {
    evidenceLevel: "A",
    confidenceLevel: "high",
    regulatoryStatus: "approved-specific",
    reviewStatus: "fresh",
    regulatoryRegions: ["US", "EU"],
    chemicalClass: "GLP-1 receptor agonist",
    moleculeType: "peptide",
    identityNote: "FDA-zugelassen in mehreren Labels (u. a. glykämische Kontrolle und Gewichtsmanagement). EMA-EPARs Victoza und Saxenda waren am 28.08.2026 erreichbar.",
    summary: (ids) => ({
      whatIsIt: cited(
        "Liraglutid ist ein acylierter GLP-1-Rezeptoragonist. FDA-Labels beschreiben Indikationen zur glykämischen Kontrolle bei Typ-2-Diabetes sowie zur Gewichtsreduktion in definierten Populationen; EMA führt EPARs für Victoza und Saxenda.",
        [ids.fda("fda-liraglutide-t2d"), ids.ema("ema-victoza"), ids.ema("ema-saxenda")],
      ),
      mechanism: cited(
        "Laut FDA-Fachinformation hat Liraglutid 97 % Sequenzhomologie zu endogenem GLP-1(7–37) und aktiviert den GLP-1-Rezeptor.",
        [ids.fda("fda-liraglutide-t2d")],
      ),
      whatHasBeenStudied: cited(
        "Zugelassene Indikationen und ein großes klinisches Studienregister (ClinicalTrials.gov: 543 Treffer am 28.08.2026).",
        [ids.fda("fda-liraglutide-t2d"), ids.ctCount],
      ),
      humanEvidence: cited(
        "Starke Humanevidenz über FDA-Labels und EMA-EPARs.",
        [ids.fda("fda-liraglutide-t2d"), ids.ema("ema-victoza")],
      ),
      preclinicalEvidence: cited(
        "Boxed Warning: Thyroid-C-Zell-Tumoren in Ratten und Mäusen; humane Relevanz laut Label unbestimmt.",
        [ids.fda("fda-liraglutide-t2d")],
      ),
      safety: cited(
        "FDA-Label: Boxed Warning; Kontraindikationen MTC/MEN2; Warnungen u. a. Pankreatitis.",
        [ids.fda("fda-liraglutide-t2d")],
      ),
      currentResearch: cited(
        "Weitere registrierte Studien existieren; Zulassungsstatus richtet sich nach den Fachinformationen, nicht nach jeder Registrierung.",
        [ids.ctCount],
      ),
      unknowns: cited(
        "Unterschiedliche zugelassene Dosis- und Indikationsprofile (Diabetes vs. Gewichtsmanagement) dürfen nicht vermischt werden.",
        [ids.fda("fda-liraglutide-t2d"), ids.fda("fda-liraglutide-wt")],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "animal", severity: "warning", text: "FDA Boxed Warning: Thyroid-C-Zell-Tumoren in Nagetieren.", sourceIds: [ids.fda("fda-liraglutide-t2d")] },
      { domain: "human", severity: "serious", text: "Fachinformation: akute Pankreatitis beobachtet.", sourceIds: [ids.fda("fda-liraglutide-t2d")] },
    ],
    interactions: (ids) => [
      { category: "established", text: "Fachinformation: erhöhtes Hypoglykämierisiko mit Insulinsekretagogum oder Insulin.", sourceIds: [ids.fda("fda-liraglutide-t2d")] },
    ],
    reconstitution: (ids) =>
      cited(
        "Zugelassene Produkte sind Injektionslösungen/Pens laut Label. Keine Research-Vial-Rekonstitution identifiziert.",
        [ids.fda("fda-liraglutide-t2d")],
      ),
    conflicts: [],
    reviewItems: () => [],
  },
  cagrilintide: {
    evidenceLevel: "C",
    confidenceLevel: "moderate",
    regulatoryStatus: "clinical-development",
    reviewStatus: "review-recommended",
    regulatoryRegions: [],
    chemicalClass: "long-acting amylin analogue",
    moleculeType: "peptide",
    identityNote: "In Drugs@FDA am 28.08.2026 kein zugelassenes Produkt. Phase-1- bis Phase-3-Studien sind bei ClinicalTrials.gov registriert.",
    summary: (ids) => ({
      whatIsIt: cited(
        "Cagrilintide ist ein lang wirksames Amylin-Analogon, das in klinischen Studien — häufig in Kombination mit Semaglutid — bei Übergewicht/Adipositas untersucht wird.",
        [ids.pmid("34798060"), ids.nct("NCT07220642")],
      ),
      mechanism: cited(
        "Publizierte klinische Arbeiten beschreiben Cagrilintide als Amylin-Rezeptoragonisten; detaillierte Zulassungspharmakologie liegt nicht vor.",
        [ids.pmid("34798060")],
      ),
      whatHasBeenStudied: cited(
        "ClinicalTrials.gov listete am 28.08.2026 44 Studien. PubMed-Abfrage lieferte 49 Treffer, darunter randomisierte Studien.",
        [ids.ctCount, ids.pmCount, ids.pmid("34798060")],
      ),
      humanEvidence: cited(
        "Humane randomisierte Studien sind publiziert; eine FDA-Zulassung war nicht nachweisbar. Status daher klinische Entwicklung, nicht zugelassen.",
        [ids.pmid("34798060"), ids.fdaNone],
      ),
      preclinicalEvidence: cited(
        "Keine separat kuratierte Präklinik-Primärquelle in diesem Scan; Aussagen beschränken sich auf die zitierten Humanstudien.",
        [ids.pmid("34798060")],
      ),
      safety: cited(
        "Sicherheitsdaten stammen aus publizierten Studien, nicht aus einer zugelassenen Fachinformation. Eine vollständige Label-Warnliste liegt nicht vor.",
        [ids.pmid("34798060"), ids.fdaNone],
      ),
      currentResearch: cited(
        "Phase-3-Programme zu Gewichtsabnahme unter Cagrilintide sind registriert (Stand 28.08.2026).",
        [ids.nct("NCT07220642")],
      ),
      unknowns: cited(
        "Zulassungsentscheidungen in USA/EU, Langzeitsicherheit als Monotherapie und finale Indikationen sind aus den geprüften Quellen nicht abgeschlossen.",
        [ids.fdaNone],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "human", severity: "unknown", text: "Keine vollständige regulatorische Adverse-Event-Liste; nur studienbezogene Berichte in den zitierten Publikationen.", sourceIds: [ids.pmid("34798060")] },
    ],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste aus einer Fachinformation identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [],
    reviewItems: (ids) => [
      {
        id: "cagrilintide-evidence-b",
        priority: "Medium",
        topic: "Evidence C vs. mögliche B",
        note: "Humane randomisierte Daten und Phase-3-Registrierungen existieren. Ohne abgeschlossenes Zulassungsprogramm bleibt Evidence C; ein Upgrade auf B wäre nach Review weiterer Phase-3-Publikationen zu prüfen.",
        sourceIds: [ids.pmid("34798060"), ids.nct("NCT07220642")],
      },
    ],
  },
  mazdutide: {
    evidenceLevel: "C",
    confidenceLevel: "moderate",
    regulatoryStatus: "clinical-development",
    reviewStatus: "review-required",
    regulatoryRegions: [],
    chemicalClass: "GLP-1/glucagon receptor dual agonist",
    moleculeType: "peptide",
    identityNote: "Auch als IBI362 / LY3305677 referenziert. FDA-Drugs@FDA am 28.08.2026 ohne Treffer. Eine Nicht-FDA-Zulassung wird hier nicht behauptet, weil kein NMPA/EMA-Connector-Ergebnis als Quelle hinterlegt ist.",
    summary: (ids) => ({
      whatIsIt: cited(
        "Mazdutide ist ein dualer GLP-1-/Glucagon-Rezeptoragonist in klinischer Entwicklung. Identifikatoren IBI362 und LY3305677 wurden in der Recherche mitgeführt.",
        [ids.pmid("36247927"), ids.pmid("38092790")],
      ),
      mechanism: cited(
        "Peer-reviewed Studien beschreiben duale Agonismus-Aktivität an GLP-1- und Glucagon-Rezeptoren.",
        [ids.pmid("36247927")],
      ),
      whatHasBeenStudied: cited(
        "ClinicalTrials.gov: 40 Treffer am 28.08.2026. PubMed-Abfrage: 34 Treffer, darunter klinische Studien.",
        [ids.ctCount, ids.pmCount],
      ),
      humanEvidence: cited(
        "Humane klinische Publikationen existieren. Eine FDA-Zulassung war nicht nachweisbar. Ohne geprüfte Behördequelle wird kein Zulassungsstatus außerhalb der USA behauptet.",
        [ids.pmid("36247927"), ids.pmid("38092790"), ids.fdaNone],
      ),
      preclinicalEvidence: cited(
        "Mechanistische Angaben stammen aus den zitierten klinischen/wissenschaftlichen Publikationen; keine separat geprüfte Präklinik-Primärquelle in diesem Batch.",
        [ids.pmid("36247927")],
      ),
      safety: cited(
        "Sicherheitsdaten nur aus Studienliteratur, nicht aus FDA-Label.",
        [ids.pmid("38092790"), ids.fdaNone],
      ),
      currentResearch: cited(
        "Weitere Phase-2/3- und investigator-initiierte Studien sind registriert.",
        [ids.ctCount],
      ),
      unknowns: cited(
        "Regulatorischer Status außerhalb Drugs@FDA (z. B. andere Behörden) wurde in diesem Scan nicht als belastbare Behördquelle angebunden. Eine peer-reviewed First-Approval-Übersicht berichtet eine NMPA-Zulassung in China; ohne primäre NMPA-Quelle wird hier kein regionaler Approved-Status gesetzt.",
        [ids.fdaNone, ids.pmid("41028652")],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "human", severity: "unknown", text: "Keine FDA-Fachinformation; Sicherheitsaussagen nur studienbezogen.", sourceIds: [ids.pmid("38092790")] },
    ],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [],
    reviewItems: (ids) => [
      {
        id: "mazdutide-nmpa",
        priority: "High",
        topic: "Möglicher China-NMPA-Status ohne primäre Behördquelle",
        note: "PMID 41028652 (Drugs, First Approval) berichtet eine NMPA-Zulassung in China. Das ist eine wissenschaftliche Sekundärquelle, keine NMPA-Primärquelle. Regulatory bleibt clinical-development, nicht global approved.",
        sourceIds: [ids.pmid("41028652"), ids.fdaNone],
      },
    ],
  },
  orforglipron: {
    evidenceLevel: "A",
    confidenceLevel: "high",
    regulatoryStatus: "approved-specific",
    reviewStatus: "review-required",
    regulatoryRegions: ["US"],
    chemicalClass: "small-molecule GLP-1 receptor agonist",
    moleculeType: "small-molecule",
    identityNote: "Entwicklungsname LY3502970. FDA-Label FOUNDAYO (NDA220934), oral, Stand Label effective_time 20260729. EMA-EPAR für FOUNDAYO wurde in diesem Scan nicht geprüft.",
    summary: (ids) => ({
      whatIsIt: cited(
        "Orforglipron ist ein oraler niedermolekularer GLP-1-Rezeptoragonist. Die FDA-Fachinformation für FOUNDAYO beschreibt die Indikation zur langfristigen Gewichtsreduktion bei Erwachsenen mit Adipositas oder Übergewicht plus gewichtsbezogener Komorbidität, in Kombination mit kalorienreduzierter Ernährung und mehr Bewegung.",
        [ids.fda("fda-foundayo")],
      ),
      mechanism: cited(
        "Laut FDA-Label bindet FOUNDAYO an den humanen GLP-1-Rezeptor und aktiviert ihn. GLP-1 reguliert Appetit und Kalorienaufnahme.",
        [ids.fda("fda-foundayo")],
      ),
      whatHasBeenStudied: cited(
        "Neben dem zugelassenen Label sind weitere Studien bei ClinicalTrials.gov registriert (51 Treffer am 28.08.2026), einschließlich kardiovaskulärer Outcome-Studien.",
        [ids.fda("fda-foundayo"), ids.ctCount, ids.nct("NCT07241390")],
      ),
      humanEvidence: cited(
        "FDA-zugelassenes Label (FOUNDAYO, NDA220934) bildet die Primärquelle für zugelassene Anwendung. EMA wurde für dieses Produkt nicht als EPAR geprüft.",
        [ids.fda("fda-foundayo")],
      ),
      preclinicalEvidence: cited(
        "Boxed Warning diskutiert Thyroid-C-Zell-Tumoren als GLP-1-Rezeptor-abhängigen Nagetiereffekt; das Label stellt dar, dass Orforglipron in Ratte/Maus pharmakologisch nicht aktiv ist. Die genaue Interpretation bleibt an das Label gebunden.",
        [ids.fda("fda-foundayo")],
      ),
      safety: cited(
        "FDA-Label: Boxed Warning (Thyroid-C-Zell-Tumoren/GLP-1-Klasse); Kontraindikationen MTC/MEN2 und schwere Hypersensitivität; Warnungen u. a. Pankreatitis, schwere gastrointestinale Reaktionen, akute Nierenschädigung durch Volumenmangel.",
        [ids.fda("fda-foundayo")],
      ),
      currentResearch: cited(
        "Registrierte Phase-3-Programme laufen weiter, u. a. kardiovaskuläre Outcomes (ATTAIN-Outcomes).",
        [ids.nct("NCT07241390")],
      ),
      unknowns: cited(
        "EMA-/BfArM-Zulassungsstatus für FOUNDAYO ist in diesem Datensatz nicht belegt. Compounded-Analoga sind durch das Label nicht abgedeckt.",
        [ids.fda("fda-foundayo")],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "theoretical", severity: "warning", text: "FDA Boxed Warning zu Thyroid-C-Zell-Tumoren im Kontext von GLP-1-Rezeptoragonisten; Details siehe Label.", sourceIds: [ids.fda("fda-foundayo")] },
      { domain: "human", severity: "serious", text: "Fachinformation: akute Pankreatitis beobachtet; bei Verdacht absetzen.", sourceIds: [ids.fda("fda-foundayo")] },
      { domain: "human", severity: "warning", text: "Fachinformation: schwere gastrointestinale Reaktionen; nicht empfohlen bei schwerer Gastroparese.", sourceIds: [ids.fda("fda-foundayo")] },
    ],
    interactions: (ids) => [{ category: "unknown", text: "Keine über das Label hinausgehende Interaktionsliste in diesem Scan extra kuratiert; Fachinformation ist maßgeblich.", sourceIds: [ids.fda("fda-foundayo")] }],
    reconstitution: (ids) =>
      cited(
        "FOUNDAYO ist laut Label eine orale Tablette (ganz schlucken, nicht zerbrechen/zerkauen). Keine Injektions-Rekonstitution.",
        [ids.fda("fda-foundayo")],
      ),
    conflicts: [],
    reviewItems: (ids) => [
      {
        id: "orforglipron-ema",
        priority: "High",
        topic: "EMA-/Nicht-US-Zulassungsstatus",
        note: "FDA-Label FOUNDAYO (NDA220934, US) ist die belastbare Zulassungsquelle. EMA/BfArM/MHRA wurden für FOUNDAYO in diesem Batch nicht als EPAR/Behördquelle geprüft. Kein globales Approved.",
        sourceIds: [ids.fda("fda-foundayo")],
      },
    ],
  },
  tesamorelin: {
    evidenceLevel: "A",
    confidenceLevel: "high",
    regulatoryStatus: "approved-specific",
    reviewStatus: "fresh",
    regulatoryRegions: ["US"],
    chemicalClass: "GHRH analogue",
    moleculeType: "peptide",
    identityNote: "FDA BLA022505, Markennamen EGRIFTA SV / EGRIFTA WR. Indikation laut Label: Reduktion überschüssigen Abdominalfetts bei HIV-infizierten Erwachsenen mit Lipodystrophie — nicht als allgemeines Gewichtsmanagement.",
    summary: (ids) => ({
      whatIsIt: cited(
        "Tesamorelin ist ein GHRH-Analogon. Die FDA-Fachinformation für EGRIFTA SV/WR beschränkt die Indikation auf Reduktion von überschüssigem Abdominalfett bei HIV-assozierter Lipodystrophie.",
        [ids.fda("fda-egrifta")],
      ),
      mechanism: cited(
        "Laut Label bindet Tesamorelin in vitro humane GRF-Rezeptoren mit ähnlicher Potenz wie endogenes GRF und stimuliert die GH-Synthese in hypophysären Somatotrophen.",
        [ids.fda("fda-egrifta")],
      ),
      whatHasBeenStudied: cited(
        "Zugelassene Indikation plus weitere registrierte Studien (ClinicalTrials.gov: 24 Treffer am 28.08.2026), u. a. zu Leberfett und Kognition — diese erweiterten Fragestellungen sind nicht automatisch zugelassene Indikationen.",
        [ids.fda("fda-egrifta"), ids.ctCount],
      ),
      humanEvidence: cited(
        "FDA-zugelassenes Label ist die Primärquelle für zugelassene Anwendung.",
        [ids.fda("fda-egrifta")],
      ),
      preclinicalEvidence: cited(
        "Keine separat kuratierte Präklinik über das Label hinaus.",
        [ids.fda("fda-egrifta")],
      ),
      safety: cited(
        "Label: Kontraindikationen u. a. Störung der hypothalamisch-hypophysären Achse, aktive Malignität, Hypersensitivität, Schwangerschaft. Warnungen zu Neoplasierisiko, erhöhtem IGF-1, Flüssigkeitsretention und Glukoseintoleranz.",
        [ids.fda("fda-egrifta")],
      ),
      currentResearch: cited(
        "Weitere Studien zu körperlicher Funktion und Leberfett sind registriert; Ergebnisse einzelner Studien ersetzen nicht das Label.",
        [ids.nct("NCT06554717"), ids.nct("NCT03375788")],
      ),
      unknowns: cited(
        "Das Label stellt fest, dass langfristige kardiovaskuläre Sicherheit nicht etabliert ist und EGRIFTA nicht zur Gewichtsreduktion indiziert ist.",
        [ids.fda("fda-egrifta")],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "human", severity: "warning", text: "Fachinformation: erhöhtes Neoplasierisiko; vorbestehende Malignität soll inaktiv sein.", sourceIds: [ids.fda("fda-egrifta")] },
      { domain: "human", severity: "warning", text: "Fachinformation: Stimulation der GH-Produktion und Anstieg von IGF-1; Effekte prolongiert erhöhter IGF-1-Spiegel unbekannt.", sourceIds: [ids.fda("fda-egrifta")] },
      { domain: "human", severity: "warning", text: "Fachinformation: Glukoseintoleranz oder Diabetes mellitus.", sourceIds: [ids.fda("fda-egrifta")] },
    ],
    interactions: (ids) => [{ category: "unknown", text: "Interaktionen nur im Umfang der Fachinformation; keine zusätzliche Liste in diesem Scan extra erfasst.", sourceIds: [ids.fda("fda-egrifta")] }],
    reconstitution: (ids) =>
      cited(
        "Offizielle Rekonstitutions- und Anwendungsanweisungen stehen in der FDA-Fachinformation der jeweiligen EGRIFTA-Formulierung (SV vs. WR sind nicht austauschbar laut Label). Keine davon unabhängige Research-Vial-Standardanweisung.",
        [ids.fda("fda-egrifta")],
      ),
    conflicts: [],
    reviewItems: () => [],
  },
  "cjc-1295": {
    evidenceLevel: "C",
    confidenceLevel: "low",
    regulatoryStatus: "investigational",
    reviewStatus: "fresh",
    regulatoryRegions: [],
    chemicalClass: "long-acting GHRH analogue",
    moleculeType: "peptide",
    identityNote: "CAS 446262-90-4 (PubChem CID 91971820). FDA ohne Treffer. Eine Phase-2-Studie bei HIV-viszeraler Adipositas wurde terminiert.",
    summary: (ids) => ({
      whatIsIt: cited(
        "CJC-1295 ist ein lang wirksames GHRH-Analogon. Eine randomisierte Publikation beschrieb prolongierte GH- und IGF-I-Sekretion bei gesunden Erwachsenen.",
        [ids.pmid("16352683"), ids.pubchem],
      ),
      mechanism: cited(
        "Die zitierte Humanstudie beschreibt CJC-1295 als lang wirksames Analogon von GH-Releasing Hormone.",
        [ids.pmid("16352683")],
      ),
      whatHasBeenStudied: cited(
        "PubMed-Abfrage: 13 Treffer. ClinicalTrials.gov: 1 Studie (NCT00267527, terminiert).",
        [ids.pmid("16352683"), ids.nct("NCT00267527"), ids.pmCount],
      ),
      humanEvidence: cited(
        "Begrenzte Humanevidenz: randomisierte Studie an Gesunden (2006) und eine terminierte Phase-2-Studie. Keine FDA-Zulassung nachweisbar.",
        [ids.pmid("16352683"), ids.nct("NCT00267527"), ids.fdaNone],
      ),
      preclinicalEvidence: cited(
        "Keine separat kuratierte Präklinik-Primärquelle in diesem Scan.",
        [ids.pmid("16352683")],
      ),
      safety: cited(
        "Keine zugelassene Fachinformation. Sicherheitsdaten beschränken sich auf die zitierte Literatur und die registrierte Studie ohne publizierte CT.gov-Results.",
        [ids.pmid("16352683"), ids.fdaNone],
      ),
      currentResearch: cited(
        "Kein laufendes großes Zulassungsprogramm in den geprüften CT.gov-Treffern identifiziert.",
        [ids.nct("NCT00267527")],
      ),
      unknowns: cited(
        "Langzeitsicherheit, Standarddosierung und regulatorischer Status außerhalb 'investigational' sind nicht belegt.",
        [ids.fdaNone],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "human", severity: "unknown", text: "Keine regulatorische Adverse-Event-Liste.", sourceIds: [ids.fdaNone] },
    ],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [],
    reviewItems: () => [],
  },
  ipamorelin: {
    evidenceLevel: "C",
    confidenceLevel: "low",
    regulatoryStatus: "investigational",
    reviewStatus: "fresh",
    regulatoryRegions: [],
    chemicalClass: "ghrelin receptor agonist / GHRP analogue",
    moleculeType: "peptide",
    identityNote: "CAS 170851-70-4 (PubChem). FDA ohne Treffer. Historische Phase-2-Studien zur postoperativen Ileus-Behandlung.",
    summary: (ids) => ({
      whatIsIt: cited(
        "Ipamorelin ist ein Ghrelin-Rezeptoragonist, der in Phase-2-Studien zur Erholung der gastrointestinalen Funktion nach Operation untersucht wurde.",
        [ids.nct("NCT00672074"), ids.nct("NCT01280344"), ids.pubchem],
      ),
      mechanism: cited(
        "Ältere peer-reviewed Arbeiten beschreiben Ipamorelin als selektiven Growth-Hormone-Secretagogue; eine aktuelle Zulassungsfachinformation fehlt.",
        [ids.pmid("9733496")],
      ),
      whatHasBeenStudied: cited(
        "Zwei abgeschlossene Phase-2-Studien (Helsinn) zur postoperativen Darmfunktion sowie weitere CT.gov-Treffer. PubMed: 16 Treffer.",
        [ids.nct("NCT00672074"), ids.nct("NCT01280344"), ids.pmCount],
      ),
      humanEvidence: cited(
        "Begrenzte Humanevidenz aus Phase-2-Programmen ohne FDA-Zulassung. CT.gov-Results-Flag für die Helsinn-Studien war in der Abfrage nicht gesetzt.",
        [ids.nct("NCT01280344"), ids.fdaNone],
      ),
      preclinicalEvidence: cited(
        "Frühe pharmakologische Publikationen existieren; sie ersetzen keine Human-Sicherheitsdatenbank.",
        [ids.pmid("9733496")],
      ),
      safety: cited(
        "Keine zugelassene Fachinformation.",
        [ids.fdaNone],
      ),
      currentResearch: cited(
        "Kein FDA-zugelassenes Produkt. Neuere CT.gov-Einträge müssen nicht Ipamorelin als Intervention enthalten; nur klar zugeordnete Studien wurden übernommen.",
        [ids.nct("NCT00672074")],
      ),
      unknowns: cited(
        "Wirksamkeit für nicht untersuchte Indikationen, Langzeitsicherheit und Qualität von Research-Produkten sind nicht belegt.",
        [ids.fdaNone],
      ),
    }),
    safetyItems: (ids) => [{ domain: "human", severity: "unknown", text: "Keine regulatorische Adverse-Event-Liste.", sourceIds: [ids.fdaNone] }],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [],
    reviewItems: () => [],
  },
  "bpc-157": {
    evidenceLevel: "D",
    confidenceLevel: "low",
    regulatoryStatus: "investigational",
    reviewStatus: "fresh",
    regulatoryRegions: [],
    chemicalClass: "synthetic gastric pentadecapeptide",
    moleculeType: "peptide",
    identityNote: "CAS 137525-51-0 (PubChem CID 9941957). FDA ohne Treffer. Überwiegend präklinische Literatur; humane Daten sehr begrenzt.",
    summary: (ids) => ({
      whatIsIt: cited(
        "BPC-157 ist ein synthetisches Pentadekapeptid. Reviews fassen vor allem präklinische und patentbezogene Literatur zusammen; eine FDA-Zulassung war nicht nachweisbar.",
        [ids.pmid("40005999"), ids.pubchem, ids.fdaNone],
      ),
      mechanism: cited(
        "Mechanismusangaben in Reviews sind überwiegend präklinisch und nicht als zugelassene Pharmakologie zu lesen.",
        [ids.pmid("40005999")],
      ),
      whatHasBeenStudied: cited(
        "PubMed-Abfrage: 40 Treffer. ClinicalTrials.gov: wenige Registrierungen, darunter eine ältere Phase-1-PK-Studie (PCO-02) mit Status UNKNOWN.",
        [ids.pmCount, ids.nct("NCT02637284")],
      ),
      humanEvidence: cited(
        "Belastbare, abgeschlossene Human-RCTs mit publizierten Ergebnissen wurden in diesem Scan nicht als Primärbeleg identifiziert. Evidence daher überwiegend präklinisch.",
        [ids.pmid("40005999"), ids.nct("NCT02637284")],
      ),
      preclinicalEvidence: cited(
        "Ein Großteil der zitierten Literatur ist präklinisch bzw. Übersichtsarbeiten zu nichtklinischen Befunden.",
        [ids.pmid("40005999"), ids.pmid("29898649")],
      ),
      safety: cited(
        "Keine FDA-Fachinformation. Humane Sicherheitsdaten sind unzureichend für eine Label-äquivalente Bewertung.",
        [ids.fdaNone, ids.pmid("40005999")],
      ),
      currentResearch: cited(
        "Registrierte Studien existieren; ohne Results/Publikation werden keine Wirksamkeitsaussagen abgeleitet.",
        [ids.nct("NCT02637284")],
      ),
      unknowns: cited(
        "Humane Dosis, Reinheit kommerzieller Research-Produkte, Langzeitsicherheit und klinische Wirksamkeit bleiben offen.",
        [ids.fdaNone],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "human", severity: "unknown", text: "Keine ausreichenden belastbaren Human-Sicherheitsdaten aus zugelassenen Fachinformationen.", sourceIds: [ids.fdaNone] },
    ],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [],
    reviewItems: () => [],
  },
  "tb-500": {
    evidenceLevel: "F",
    confidenceLevel: "insufficient",
    regulatoryStatus: "insufficient",
    reviewStatus: "review-required",
    regulatoryRegions: [],
    chemicalClass: "synthetic thymosin-beta-4 fragment analogue",
    moleculeType: "peptide",
    identityNote:
      "TB-500 wird nicht automatisch mit vollständigem Thymosin Beta-4 gleichgesetzt. PubChem CID 62707662 / CAS 885340-08-9 beschreibt ein acetyliertes Fragmentpeptid, nicht das Vollprotein. Die CT.gov-Registrierung NCT07487363 kennzeichnet sich selbst als fiktives Beispielrecord und wird nicht als Studie gewertet.",
    summary: (ids) => ({
      whatIsIt: cited(
        "TB-500 wird in chemischen Datenbanken als synthetisches Fragmentpeptid geführt, nicht als identisches Vollmolekül Thymosin Beta-4. Eine FDA-Zulassung war nicht nachweisbar.",
        [ids.pubchem, ids.fdaNone],
      ),
      mechanism: cited(
        "Keine belastbare, substanzspezifische Human-Mechanismus-Fachinformation identifiziert. Mechanismusangaben für vollständiges Thymosin Beta-4 dürfen nicht automatisch übertragen werden.",
        [ids.pubchem],
      ),
      whatHasBeenStudied: cited(
        "PubMed-Abfrage zum Term TB-500 lieferte wenige Treffer, überwiegend Übersichtsarbeiten zu Peptidtherapien, nicht notwendigerweise RCTs von TB-500. Die einzige ClinicalTrials.gov-Registrierung unter diesem Term (NCT07487363) kennzeichnet sich im Brief Summary als fiktives Beispielrecord und wird nicht als Studie gewertet.",
        [ids.pmCount, ids.ctCount],
      ),
      humanEvidence: cited(
        "Keine ausreichenden belastbaren Human-Sicherheits- oder Wirksamkeitsdaten identifiziert.",
        [ids.fdaNone],
      ),
      preclinicalEvidence: cited(
        "Präklinische Befunde zu Thymosin Beta-4 sind nicht automatisch Befunde zu TB-500.",
        [ids.pubchem],
      ),
      safety: cited(
        "Keine Fachinformation. Human-Sicherheitsdaten unzureichend.",
        [ids.fdaNone],
      ),
      currentResearch: cited(
        "Keine belastbare, nicht-fiktive CT.gov-Interventionsstudie für TB-500 identifiziert. Reviews zu Peptidtherapien ersetzen keine TB-500-spezifischen Human-RCTs.",
        [ids.pmCount, ids.ctCount],
      ),
      unknowns: cited(
        "Identitätsverwirrung mit Thymosin Beta-4, fehlende Human-RCTs und fehlende regulatorische Bewertung.",
        [ids.pubchem, ids.fdaNone],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "human", severity: "unknown", text: "Keine ausreichenden belastbaren Human-Sicherheitsdaten.", sourceIds: [ids.fdaNone] },
    ],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [
      {
        topic: "Identität TB-500 vs. Thymosin Beta-4",
        note: "Quellen und Datenbanken unterscheiden ein Fragmentpeptid (TB-500) vom Vollprotein. Keine automatische Zusammenführung.",
        sourceIds: ["pubchem-tb-500"],
      },
    ],
    reviewItems: (ids) => [
      {
        id: "tb-500-fictional-nct",
        priority: "High",
        topic: "Fiktive CT.gov-Registrierung NCT07487363",
        note: "ClinicalTrials.gov Brief Summary von NCT07487363 beginnt mit „This fictional study is an example of a ClinicalTrials.gov-style record.“ Sponsor Hudson Biotech. Der Record bleibt im Rohcache, wird aber nicht als Studie oder Human-Evidenz veröffentlicht.",
        sourceIds: [ids.ctCount],
      },
    ],
  },
  "ghk-cu": {
    evidenceLevel: "D",
    confidenceLevel: "low",
    regulatoryStatus: "insufficient",
    reviewStatus: "review-required",
    regulatoryRegions: [],
    chemicalClass: "copper-binding tripeptide complex",
    moleculeType: "peptide",
    identityNote: "PubChem führt ein Kupfer-Komplex-Record (CID 139035031). FDA ohne Treffer. Kein zugelassenes systemisches Arzneimittel in Drugs@FDA.",
    summary: (ids) => ({
      whatIsIt: cited(
        "GHK-Cu ist ein Kupferkomplex des Tripeptids GHK. Die geprüfte Literatur ist überwiegend dermatologisch/präklinisch; keine FDA-Zulassung als Arzneimittel nachweisbar.",
        [ids.pubchem, ids.pmid("25731775"), ids.fdaNone],
      ),
      mechanism: cited(
        "Reviews beschreiben Kupferpeptid-Wirkungen in Hautmodellen; das ist keine zugelassene Human-Pharmakologie.",
        [ids.pmid("25731775")],
      ),
      whatHasBeenStudied: cited(
        "PubMed: 15 Treffer zur kombinierten Query. ClinicalTrials.gov-Treffer, die GHK nur als Biomarker (z. B. X39-Patch) oder unter dem Sponsor Hudson Biotech führen, wurden nicht als GHK-Cu-Interventionsstudien übernommen.",
        [ids.pmCount, ids.ctCount],
      ),
      humanEvidence: cited(
        "Begrenzte humane/kosmetische Daten in der Literatur; keine Arzneimittel-Zulassung.",
        [ids.pmid("25731775"), ids.fdaNone],
      ),
      preclinicalEvidence: cited(
        "Ein erheblicher Teil der Evidenz ist präklinisch oder in-vitro.",
        [ids.pmid("25731775"), ids.pmid("18350235")],
      ),
      safety: cited(
        "Keine FDA-Fachinformation für ein Arzneimittel GHK-Cu.",
        [ids.fdaNone],
      ),
      currentResearch: cited(
        "Keine belastbare, klar als GHK-Cu-Gabe identifizierte CT.gov-Interventionsstudie in diesem Batch übernommen.",
        [ids.ctCount],
      ),
      unknowns: cited(
        "Systemische Anwendung, Reinheit und Langzeitsicherheit von Research-Produkten sind nicht durch ein Label belegt.",
        [ids.fdaNone],
      ),
    }),
    safetyItems: (ids) => [{ domain: "human", severity: "unknown", text: "Keine Arzneimittel-Fachinformation.", sourceIds: [ids.fdaNone] }],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [],
    reviewItems: (ids) => [
      {
        id: "ghk-cu-x39-nct",
        priority: "Medium",
        topic: "NCT07706361 misst GHK-Spiegel, gibt kein GHK-Cu",
        note: "Die Registrierung untersucht ein X39-Patch und zirkulierende GHK/GHK-Cu-Spiegel. Das ist keine Interventionsstudie mit GHK-Cu-Peptidgabe und wird nicht als solche veröffentlicht.",
        sourceIds: [ids.ctCount],
      },
    ],
  },
  "mots-c": {
    evidenceLevel: "D",
    confidenceLevel: "low",
    regulatoryStatus: "investigational",
    reviewStatus: "review-required",
    regulatoryRegions: [],
    chemicalClass: "mitochondrial-derived peptide",
    moleculeType: "peptide",
    identityNote: "CAS 1627580-64-6 (PubChem CID 146675088). FDA ohne Treffer. Viele CT.gov-Treffer messen endogenes MOTS-c als Biomarker und sind keine Interventionsstudien mit MOTS-c.",
    summary: (ids) => ({
      whatIsIt: cited(
        "MOTS-c ist ein mitochondrial kodiertes Peptid. In diesem Scan wurden Interventionsstudien von Biomarker-Messungen getrennt.",
        [ids.pubchem, ids.pmid("39160573")],
      ),
      mechanism: cited(
        "Reviews und experimentelle Arbeiten beschreiben MOTS-c im Kontext mitochondrialer Peptide; ein Teil der Evidenz ist präklinisch.",
        [ids.pmid("39160573"), ids.pmid("41593376")],
      ),
      whatHasBeenStudied: cited(
        "ClinicalTrials.gov-Rohtreffer: 9. Nach Filter bleiben keine belastbaren MOTS-c-Interventionsstudien (Hudson-Cluster ausgeschlossen; Biomarker-Messungen ausgeschlossen). PubMed: 13 Treffer zur Query.",
        [ids.ctCount, ids.pmCount],
      ),
      humanEvidence: cited(
        "Belastbare, abgeschlossene Human-RCTs mit publizierten Ergebnissen zur MOTS-c-Gabe wurden nicht als Primärbeleg identifiziert.",
        [ids.fdaNone],
      ),
      preclinicalEvidence: cited(
        "Ein Teil der Literatur betrifft endogene MOTS-c-Spiegel oder tierexperimentelle Gabe, nicht zugelassene Humantherapie.",
        [ids.pmid("41593376"), ids.pmid("39160573")],
      ),
      safety: cited(
        "Keine FDA-Fachinformation.",
        [ids.fdaNone],
      ),
      currentResearch: cited(
        "Mindestens eine CT.gov-Registrierung (NCT07505745, Sponsor Hudson Biotech) gehört zum selben Sponsor-Cluster wie der als fiktiv gekennzeichnete TB-500-Record. Sie wird nicht als belastbare Humanstudie veröffentlicht.",
        [ids.ctCount],
      ),
      unknowns: cited(
        "Humane Dosierung, Sicherheit und Wirksamkeit einer exogenen MOTS-c-Gabe bleiben offen.",
        [ids.fdaNone],
      ),
    }),
    safetyItems: (ids) => [{ domain: "human", severity: "unknown", text: "Keine ausreichenden Human-Sicherheitsdaten aus Fachinformationen.", sourceIds: [ids.fdaNone] }],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [],
    reviewItems: (ids) => [
      {
        id: "mots-c-hudson-nct",
        priority: "High",
        topic: "Hudson-Biotech-Registrierung NCT07505745",
        note: "NCT07505745 hat denselben Sponsor und dieselbe Kontakt-/Standortsignatur wie NCT07487363, dessen Brief Summary sich als fiktives Beispielrecord ausweist. Ohne unabhängige Bestätigung nicht als Humanstudie werten.",
        sourceIds: [ids.ctCount],
      },
    ],
  },
  "aod-9604": {
    evidenceLevel: "E",
    confidenceLevel: "low",
    regulatoryStatus: "investigational",
    reviewStatus: "review-recommended",
    regulatoryRegions: [],
    chemicalClass: "hGH fragment analogue",
    moleculeType: "peptide",
    identityNote: "CAS 221231-10-3 (PubChem CID 71300630). FDA ohne Treffer. ClinicalTrials.gov-Suche nach AOD9604 am 28.08.2026: 0 Studien.",
    summary: (ids) => ({
      whatIsIt: cited(
        "AOD-9604 ist ein fragmentbezogenes Analogon im Kontext von hGH-Metabolismusforschung. Ältere Reviews existieren; eine aktuelle FDA-Zulassung war nicht nachweisbar.",
        [ids.pmid("15134286"), ids.pubchem, ids.fdaNone],
      ),
      mechanism: cited(
        "Historische Übersichtsarbeiten ordnen AOD-9604 metabolischen Forschungsfragen zu; das ist keine aktuelle Fachinformation.",
        [ids.pmid("15134286")],
      ),
      whatHasBeenStudied: cited(
        "PubMed-Query: 10 Treffer, überwiegend ältere Reviews/Trial-Gateways. ClinicalTrials.gov: 0 Treffer für AOD9604 am 28.08.2026.",
        [ids.pmCount, ids.ctCount],
      ),
      humanEvidence: cited(
        "Sehr begrenzte, teils veraltete Literatur. Keine aktuelle registrierte CT.gov-Studie unter diesem Term.",
        [ids.pmid("15134286"), ids.ctCount],
      ),
      preclinicalEvidence: cited(
        "Ein Teil der älteren Literatur ist präklinisch/investigativ.",
        [ids.pmid("15134286")],
      ),
      safety: cited(
        "Keine FDA-Fachinformation.",
        [ids.fdaNone],
      ),
      currentResearch: cited(
        "Kein aktuelles CT.gov-Programm unter AOD9604 identifiziert.",
        [ids.ctCount],
      ),
      unknowns: cited(
        "Aktuelle Human-RCTs, Zulassung und Sicherheitsdaten fehlen in den geprüften Quellen.",
        [ids.fdaNone, ids.ctCount],
      ),
    }),
    safetyItems: (ids) => [{ domain: "human", severity: "unknown", text: "Keine ausreichenden aktuellen Human-Sicherheitsdaten.", sourceIds: [ids.fdaNone] }],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [],
    reviewItems: (ids) => [
      {
        id: "aod-9604-ct-zero",
        priority: "Low",
        topic: "0 CT.gov-Treffer ist kein Beweis für fehlende Humanstudien",
        note: "Die Abfrage AOD9604 lieferte 0 ClinicalTrials.gov-Treffer. Ältere Literatur kann Humanstudien außerhalb dieses Terms enthalten. Evidence E bleibt, bis weitere belastbare Humanquellen kuratiert sind.",
        sourceIds: [ids.ctCount, ids.pmid("15134286")],
      },
    ],
  },
  ...CURATED_02,
};

function makeIdHelpers(slug, sources) {
  const byPmid = Object.fromEntries(sources.filter((s) => s.pmid).map((s) => [s.pmid, s.id]));
  const byNct = Object.fromEntries(sources.filter((s) => s.clinicalTrialId).map((s) => [s.clinicalTrialId, s.id]));
  const byId = Object.fromEntries(sources.map((s) => [s.id, s.id]));
  return {
    pmid: (pmid) => byPmid[pmid] ?? `missing-pmid-${pmid}`,
    nct: (nct) => byNct[nct] ?? `missing-nct-${nct}`,
    fda: (id) => byId[id] ?? `missing-${id}`,
    ema: (id) => byId[id] ?? `missing-${id}`,
    fdaNone: `fda-none-${slug}`,
    pubchem: `pubchem-${slug}`,
    ctCount: `ct-count-${slug}`,
    pmCount: `pm-count-${slug}`,
  };
}

async function compileOne(slug) {
  const raw = await readJson(resolve(FETCHED, `${slug}.json`));
  const curated = CURATED[slug];
  const sources = [];
  const ct = raw.connectors.clinicaltrials;
  const pm = raw.connectors.pubmed;
  const fda = raw.connectors.fda;
  const pc = raw.connectors.pubchem;

  sources.push({
    id: `ct-count-${slug}`,
    title: `ClinicalTrials.gov search: ${ct.query}`,
    url: `https://clinicaltrials.gov/search?term=${encodeURIComponent(ct.query)}`,
    publisher: "ClinicalTrials.gov",
    publicationDate: null,
    accessDate: ACCESS,
    doi: null,
    pmid: null,
    clinicalTrialId: null,
    sourceType: "scientific",
    sourceQuality: 3,
  });
  sources.push({
    id: `pm-count-${slug}`,
    title: `PubMed search: ${pm.query}`,
    url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(pm.query)}`,
    publisher: "NCBI PubMed",
    publicationDate: null,
    accessDate: ACCESS,
    doi: null,
    pmid: null,
    clinicalTrialId: null,
    sourceType: "scientific",
    sourceQuality: 3,
  });

  if (fda.found) {
    let labels = [];
    try {
      labels = (await readJson(resolve(FETCHED, `${slug}.fda-label.json`))).labels ?? [];
    } catch {
      labels = [];
    }
    const used = new Set();
    for (const label of labels) {
      const brand = (label.brand ?? [])[0];
      const setId = label.setId;
      const app = (label.application ?? [])[0];
      if (!setId || !brand || used.has(setId)) continue;
      used.add(setId);
      const id =
        slug === "tirzepatide" && /mounjaro/i.test(brand)
          ? "fda-mounjaro"
          : slug === "tirzepatide" && /zepbound/i.test(brand)
            ? "fda-zepbound"
            : slug === "semaglutide" && setId === "42bdd912-2393-44c4-b7e0-47672ca28991"
              ? "fda-ozempic"
              : slug === "liraglutide" && app === "NDA022341"
                ? "fda-liraglutide-t2d"
                : slug === "liraglutide" && /weight|obesity/i.test(label.indications ?? "")
                  ? "fda-liraglutide-wt"
                  : slug === "tesamorelin"
                    ? "fda-egrifta"
                    : slug === "orforglipron"
                      ? "fda-foundayo"
                    : slug === "somatropin" && /norditropin/i.test(brand)
                      ? "fda-norditropin"
                    : slug === "somatropin" && /omnitrope/i.test(brand)
                      ? "fda-omnitrope"
                    : slug === "somatropin" && /serostim/i.test(brand)
                      ? "fda-serostim"
                    : slug === "hcg"
                      ? "fda-hcg"
                      : `fda-${slug}-${setId.slice(0, 8)}`;
      if (sources.some((s) => s.id === id)) continue;
      sources.push({
        id,
        title: `${brand} (${(label.generic ?? []).join(", ") || slug}) FDA prescribing information`,
        url: dailymed(setId),
        publisher: "FDA / DailyMed",
        publicationDate: label.effectiveTime ?? null,
        accessDate: ACCESS,
        doi: null,
        pmid: null,
        clinicalTrialId: null,
        sourceType: "regulatory",
        sourceQuality: 5,
      });
    }
  } else {
    sources.push({
      id: `fda-none-${slug}`,
      title: `openFDA Drugs@FDA: no product match for ${fda.query}`,
      url: "https://open.fda.gov/apis/drug/drugsfda/",
      publisher: "openFDA",
      publicationDate: null,
      accessDate: ACCESS,
      doi: null,
      pmid: null,
      clinicalTrialId: null,
      sourceType: "regulatory",
      sourceQuality: 5,
    });
  }

  for (const ema of EMA[slug] ?? []) {
    sources.push({
      id: ema.id,
      title: ema.title,
      url: ema.url,
      publisher: "EMA",
      publicationDate: null,
      accessDate: ACCESS,
      doi: null,
      pmid: null,
      clinicalTrialId: null,
      sourceType: "regulatory",
      sourceQuality: 5,
    });
  }

  const skipPubchem = slug === "hcg" && String(pc?.cid) === "1108";
  if (pc?.cid && !skipPubchem) {
    sources.push({
      id: `pubchem-${slug}`,
      title: `PubChem CID ${pc.cid}${pc.cas ? ` (CAS ${pc.cas})` : ""}`,
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${pc.cid}`,
      publisher: "NCBI PubChem",
      publicationDate: null,
      accessDate: ACCESS,
      doi: null,
      pmid: null,
      clinicalTrialId: null,
      sourceType: "scientific",
      sourceQuality: 4,
    });
  } else if (slug === "retatrutide") {
    sources.push({
      id: `pubchem-${slug}`,
      title: "PubChem name lookup: retatrutide (no CID in this scan)",
      url: "https://pubchem.ncbi.nlm.nih.gov/",
      publisher: "NCBI PubChem",
      publicationDate: null,
      accessDate: ACCESS,
      doi: null,
      pmid: null,
      clinicalTrialId: null,
      sourceType: "scientific",
      sourceQuality: 3,
    });
  }

  const keptStudies = (ct.studies ?? []).filter((s) => keepStudy(slug, s));
  const studies = [];
  for (const nct of PINNED_NCTS[slug] ?? []) {
    const hit = (ct.studies ?? []).find((s) => s.nctId === nct);
    if (!hit) continue;
    if (hit.sponsor === "Hudson Biotech") continue;
    if (/mock study|fictional study|example of a ClinicalTrials\.gov-style/i.test(hit.title ?? "")) continue;
    if (!studies.some((row) => row.nctId === hit.nctId)) studies.push(hit);
  }
  for (const study of keptStudies) {
    if (studies.length >= 12) break;
    if (!studies.some((row) => row.nctId === study.nctId)) studies.push(study);
  }
  for (const study of studies) {
    sources.push({
      id: `nct-${study.nctId}`,
      title: study.title,
      url: study.url,
      publisher: study.sponsor,
      publicationDate: study.lastUpdate,
      accessDate: ACCESS,
      doi: null,
      pmid: null,
      clinicalTrialId: study.nctId,
      sourceType: "clinical_trial",
      sourceQuality: 5,
    });
  }

  const ranked = [...(pm.articles ?? [])]
    .map((a) => ({ ...a, ...pubmedQuality(a) }))
    .filter((a) => a.keep && a.pmid && keepArticle(slug, a))
    .sort((a, b) => a.rank - b.rank);
  const articles = [];
  for (const pmid of PINNED_PMIDS[slug] ?? []) {
    const hit =
      ranked.find((a) => a.pmid === pmid) ??
      (pm.articles ?? []).find((a) => a.pmid === pmid) ??
      (EXTRA_ARTICLES[slug] ?? []).find((a) => a.pmid === pmid);
    if (hit && hit.title && !articles.some((a) => a.pmid === hit.pmid)) articles.push({ ...hit, ...pubmedQuality(hit) });
  }
  for (const extra of EXTRA_ARTICLES[slug] ?? []) {
    if (extra.title && !articles.some((a) => a.pmid === extra.pmid)) articles.push({ ...extra, ...pubmedQuality(extra) });
  }
  for (const article of ranked) {
    if (articles.length >= 12) break;
    if (!article.title) continue;
    if (!articles.some((a) => a.pmid === article.pmid)) articles.push(article);
  }
  for (const article of articles) {
    sources.push({
      id: `pmid-${article.pmid}`,
      title: article.title,
      url: article.url,
      publisher: article.source,
      publicationDate: article.pubdate,
      accessDate: ACCESS,
      doi: article.doi,
      pmid: article.pmid,
      clinicalTrialId: null,
      sourceType: (article.pubtype ?? []).some((t) => /meta-analysis/i.test(t))
        ? "meta_analysis"
        : (article.pubtype ?? []).some((t) => /systematic review/i.test(t))
          ? "review"
          : "pubmed",
      sourceQuality: article.rank <= 2 ? 5 : article.rank <= 4 ? 4 : 3,
    });
  }

  const ids = makeIdHelpers(slug, sources);
  const summary = curated.summary(ids);
  const reconstitution = curated.reconstitution(ids);
  const reviewItems = typeof curated.reviewItems === "function" ? curated.reviewItems(ids) : [];

  const connectors = [
    { id: "fda", status: fda.status === "checked" ? (fda.found ? "checked" : "not-found") : "unavailable", note: fda.found ? "Drugs@FDA match" : fda.message ?? "checked" },
    { id: "ema", status: EMA[slug] ? "checked" : "unavailable", note: EMA[slug] ? "EPAR pages HTTP 200 on 2026-08-28" : "EMA-Connector in diesem Batch nicht für diese Substanz abgefragt" },
    { id: "bfarm", status: "unavailable", note: "BfArM-Connector nicht konfiguriert" },
    { id: "mhra", status: "unavailable", note: "MHRA-Connector nicht konfiguriert" },
    { id: "clinicaltrials", status: ct.status === "checked" ? "checked" : "unavailable", note: `${ct.totalCount ?? 0} studies for query ${ct.query}` },
    { id: "pubmed", status: pm.status === "checked" ? "checked" : "unavailable", note: `${pm.count ?? 0} publications for filtered query` },
    { id: "reddit", status: "unavailable", note: COMMUNITY_MSG },
  ];

  return {
    slug,
    publicationStatus: "published",
    lastReviewedAt: ACCESS,
    lastResearchScanAt: ACCESS,
    lastCommunityScanAt: null,
    evidenceLevel: curated.evidenceLevel,
    confidenceLevel: curated.confidenceLevel,
    regulatoryStatus: curated.regulatoryStatus,
    reviewStatus: curated.reviewStatus ?? "fresh",
    regulatoryRegions: curated.regulatoryRegions ?? [],
    identity: {
      verified: true,
      casNumber: pc?.cas ?? null,
      chemicalClass: curated.chemicalClass,
      moleculeType: curated.moleculeType,
      identityNote: curated.identityNote,
    },
    connectors,
    summary,
    pharmacology: [],
    safetyItems: curated.safetyItems(ids),
    interactions: curated.interactions(ids),
    reconstitution,
    studies: studies.map((study) => ({
      id: study.nctId,
      clinicalTrialId: study.nctId,
      title: study.title,
      phase: study.phase,
      status: study.status,
      sponsor: study.sponsor,
      enrollment: study.enrollment,
      startDate: study.start,
      completionDate: study.completion,
      lastUpdated: study.lastUpdate,
      hasResults: Boolean(study.hasResults),
      url: study.url,
    })),
    sources,
    conflicts: curated.conflicts,
    reviewItems,
    community: { available: false, message: COMMUNITY_MSG },
    researchReport: {
      identity: "Verified",
      fda: fda.found ? "Checked" : ct.status === "checked" ? "Checked — no Drugs@FDA match" : "Unavailable",
      ema: EMA[slug] ? "Checked" : "Unavailable",
      clinicalTrials: ct.totalCount ?? 0,
      pubmed: pm.count ?? 0,
      scientific: articles.length,
      community: "Unavailable",
      conflicts: curated.conflicts.length,
    },
  };
}

const profiles = {};
for (const slug of BATCH) {
  const profile = slug === "glow-blend" ? compileGlowBlend(ACCESS, COMMUNITY_MSG) : await compileOne(slug);
  const missing = JSON.stringify(profile).match(/missing-[a-z0-9-]+/gi) ?? [];
  if (missing.length) {
    console.warn(slug, "unresolved citations", [...new Set(missing)]);
  }
  profiles[slug] = profile;
  console.log(slug, profile.evidenceLevel, profile.regulatoryStatus, "src", profile.sources.length, "nct", profile.studies.length);
}

await writeFile(OUT, JSON.stringify({ accessDate: ACCESS, profiles }, null, 2));
console.log("wrote", OUT);
