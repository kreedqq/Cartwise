/**
 * Curated, cited Batch 02 overlays. No invented NCT/PMID/approvals.
 */
export function cited(text, sourceIds) {
  return { text, sourceIds };
}

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
];

export const PINNED_NCTS_02 = {
  "thymosin-beta-4": ["NCT05555589", "NCT04555850", "NCT05984134", "NCT03937882"],
  "thymosin-alpha-1": ["NCT06821100", "NCT04428008", "NCT07780721"],
};

export const PINNED_PMIDS_02 = {
  sermorelin: ["8329825"],
  semax: ["29798983"],
  selank: ["25176261", "18454096", "26356395"],
  kpv: ["39252648", "28343991"],
  "igf-1-lr3": ["42395176"],
  "melanotan-ii": ["9760697", "22724573"],
  "thymosin-beta-4": ["22074294", "41229390"],
  "thymosin-alpha-1": ["38308608"],
};

export const EMA_02 = {
  somatropin: [{ id: "ema-omnitrope", title: "Omnitrope EPAR", url: "https://www.ema.europa.eu/en/medicines/human/EPAR/omnitrope" }],
  hcg: [
    {
      id: "ema-ovitrelle",
      title: "Ovitrelle EPAR (choriogonadotropin alfa; related recombinant, not urinary hCG)",
      url: "https://www.ema.europa.eu/en/medicines/human/EPAR/ovitrelle",
    },
  ],
};

export const CURATED_02 = {
  sermorelin: {
    evidenceLevel: "C",
    confidenceLevel: "low",
    regulatoryStatus: "investigational",
    reviewStatus: "review-recommended",
    regulatoryRegions: [],
    chemicalClass: "GHRH (1-29) analogue",
    moleculeType: "peptide",
    identityNote:
      "Sermorelin entspricht GRF(1-29)/Geref. In der openFDA-Drugs@FDA-Suche vom 28.08.2026 kein aktuelles Produkt. Fehlender Treffer ist kein Beweis, dass nie eine Zulassung bestand.",
    summary: (ids) => ({
      whatIsIt: cited(
        "Sermorelin ist das Amid von GHRH(1-29). Eine randomisierte Humanstudie untersuchte Pharmakokinetik und GH-Stimulation nach intravenöser oder intranasaler Gabe von GHRH(1-29)-NH2.",
        [ids.pmid("8329825"), ids.pubchem],
      ),
      mechanism: cited(
        "Die zitierte Studie beschreibt GHRH(1-29)-NH2 als Stimulator der Wachstumshormonsekretion bei gesunden Probanden.",
        [ids.pmid("8329825")],
      ),
      whatHasBeenStudied: cited(
        "ClinicalTrials.gov lieferte am 28.08.2026 42 Treffer zum Term sermorelin; viele Titel betreffen andere GHRH-Analoga. Nur titelgeprüfte Records werden veröffentlicht. PubMed-Query: 54 Treffer.",
        [ids.ctCount, ids.pmCount, ids.pmid("8329825")],
      ),
      humanEvidence: cited(
        "Begrenzte Humanevidenz aus älteren GHRH(1-29)-Studien. Eine aktuelle Drugs@FDA-Zulassung war in dieser Abfrage nicht nachweisbar.",
        [ids.pmid("8329825"), ids.fdaNone],
      ),
      preclinicalEvidence: cited(
        "Keine separat kuratierte Präklinik-Primärquelle in diesem Scan.",
        [ids.pmid("8329825")],
      ),
      safety: cited(
        "Keine aktuelle FDA-Fachinformation in dieser Abfrage. Sicherheitsdaten beschränken sich auf die zitierte ältere Literatur.",
        [ids.fdaNone, ids.pmid("8329825")],
      ),
      currentResearch: cited(
        "Kein titelgeprüftes, laufendes Zulassungsprogramm unter Sermorelin/Geref in den kuratierten CT.gov-Treffern identifiziert. Stand: 28.08.2026.",
        [ids.ctCount],
      ),
      unknowns: cited(
        "Aktueller US-/EU-Zulassungsstatus, Langzeitsicherheit und Standarddosierung für Research-Produkte sind aus den geprüften Quellen nicht belegt.",
        [ids.fdaNone],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "human", severity: "unknown", text: "Keine aktuelle regulatorische Adverse-Event-Liste identifiziert.", sourceIds: [ids.fdaNone] },
    ],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste aus einer aktuellen Fachinformation identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [],
    reviewItems: (ids) => [
      {
        id: "sermorelin-historical-geref",
        priority: "Medium",
        topic: "Historische Geref-Zulassung vs. aktueller Drugs@FDA-Leerstand",
        note: "Die Identität Geref/GRF 1-29 ist katalogisiert. openFDA lieferte am 28.08.2026 keinen Produktmatch. Das ist kein Nachweis „never approved“. Historische Labels wurden in diesem Batch nicht als DailyMed-Set rekonstruiert.",
        sourceIds: [ids.fdaNone, ids.pmid("8329825")],
      },
    ],
  },
  "thymosin-beta-4": {
    evidenceLevel: "C",
    confidenceLevel: "moderate",
    regulatoryStatus: "clinical-development",
    reviewStatus: "review-recommended",
    regulatoryRegions: [],
    chemicalClass: "actin-sequestering peptide",
    moleculeType: "peptide",
    identityNote:
      "Vollständiges Thymosin Beta-4 (PubChem CID 45382195). Nicht identisch mit TB-500 (Fragment). RGN-259 ist eine ophthalmologische Formulierung von Thymosin Beta-4; das ist kein automatischer Beleg für Research-Vials.",
    summary: (ids) => ({
      whatIsIt: cited(
        "Thymosin β4 ist ein regeneratives Peptid. Übersichtsarbeiten beschreiben klinische Anwendungsversuche; eine FDA-Zulassung war in Drugs@FDA nicht nachweisbar.",
        [ids.pmid("22074294"), ids.pubchem, ids.fdaNone],
      ),
      mechanism: cited(
        "Die zitierte Übersicht ordnet Thymosin β4 regenerative und zellbiologische Funktionen zu; das ist keine zugelassene Fachinformation.",
        [ids.pmid("22074294")],
      ),
      whatHasBeenStudied: cited(
        "ClinicalTrials.gov listete am 28.08.2026 18 Treffer zum Term thymosin beta-4, darunter Phase-1–3-Programme zu injizierbarem Thymosin Beta-4 und RGN-259. Der Hudson-Biotech-Record NCT07487363 (TB-500-Fragment, fiktives Beispielcluster) wird nicht veröffentlicht.",
        [ids.nct("NCT04555850"), ids.nct("NCT05555589"), ids.nct("NCT05984134"), ids.ctCount],
      ),
      humanEvidence: cited(
        "Humane Phase-1-Daten (gesunde Probanden) und kardiologische/ophthalmologische Studienprogramme sind registriert. Eine Publikation berichtet rhTB4 bei STEMI-Patientinnen und -Patienten sowie Mäusen. Keine FDA-Zulassung in dieser Abfrage.",
        [ids.nct("NCT04555850"), ids.pmid("41229390"), ids.fdaNone],
      ),
      preclinicalEvidence: cited(
        "PMID 41229390 enthält zusätzlich Mausdaten zur ischämischen kardialen Dysfunktion; das ist von den Humananteilen zu trennen.",
        [ids.pmid("41229390")],
      ),
      safety: cited(
        "Keine FDA-Fachinformation. Sicherheitsdaten stammen aus registrierten Studien und Übersichten, nicht aus einem zugelassenen Label.",
        [ids.fdaNone, ids.pmid("22074294")],
      ),
      currentResearch: cited(
        "Unter anderem SEER-2 (RGN-259, NCT05555589) und AMI-Programme (NCT05984134) waren zum Abfragedatum registriert.",
        [ids.nct("NCT05555589"), ids.nct("NCT05984134"), ids.nct("NCT03937882")],
      ),
      unknowns: cited(
        "Übertragbarkeit von RGN-259-Augentropfen oder rhTB4-AMI-Programmen auf Research-Vials, Langzeitsicherheit und Zulassung bleiben offen.",
        [ids.fdaNone, ids.nct("NCT05555589")],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "human", severity: "unknown", text: "Keine zugelassene Adverse-Event-Liste; Humandaten nur aus Studien/Reviews.", sourceIds: [ids.fdaNone, ids.pmid("22074294")] },
    ],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [],
    reviewItems: (ids) => [
      {
        id: "tb4-rgn259-not-tb500",
        priority: "High",
        topic: "RGN-259 und TB-500 nicht mit Thymosin Beta-4-Vials vermengen",
        note: "RGN-259-Studien (z. B. NCT05555589) untersuchen eine ophthalmologische Formulierung. TB-500 bleibt ein getrennter Identity-Record. NCT07487363 ist Hudson Biotech und wird nicht veröffentlicht.",
        sourceIds: [ids.nct("NCT05555589"), ids.ctCount],
      },
    ],
  },
  semax: {
    evidenceLevel: "C",
    confidenceLevel: "low",
    regulatoryStatus: "investigational",
    reviewStatus: "review-recommended",
    regulatoryRegions: [],
    chemicalClass: "ACTH(4-10) analogue",
    moleculeType: "peptide",
    identityNote: "PubChem CID 9811102. ClinicalTrials.gov-Suche „semax“ am 28.08.2026: 0 Studien. 0 CT.gov-Treffer ist kein Beweis für fehlende Humanforschung.",
    summary: (ids) => ({
      whatIsIt: cited(
        "Semax ist ein ACTH(4-10)-Analog. Russischsprachige klinische Publikationen beschreiben den Einsatz bei ischämischem Schlaganfall; eine FDA-Zulassung war nicht nachweisbar.",
        [ids.pmid("29798983"), ids.pubchem, ids.fdaNone],
      ),
      mechanism: cited(
        "Die zitierte klinische Arbeit betrifft Wirksamkeit in Stadien des ischämischen Schlaganfalls; detaillierte Rezeptorpharmakologie stammt in diesem Scan nicht aus einer Fachinformation.",
        [ids.pmid("29798983")],
      ),
      whatHasBeenStudied: cited(
        "PubMed-Query: 23 Treffer (28.08.2026). ClinicalTrials.gov: 0 Treffer. Titelgefiltert bleiben u. a. klinische Semax-Publikationen.",
        [ids.pmCount, ids.ctCount, ids.pmid("29798983")],
      ),
      humanEvidence: cited(
        "Begrenzte Humanevidenz aus klinischen Publikationen (u. a. ischämischer Schlaganfall). Keine bei ClinicalTrials.gov registrierte Studie unter diesem Term. Keine FDA-Zulassung in dieser Abfrage.",
        [ids.pmid("29798983"), ids.ctCount, ids.fdaNone],
      ),
      preclinicalEvidence: cited(
        "Weitere PubMed-Treffer betreffen u. a. Rattenhirn-Bindung und Proteolyse; sie werden nicht als Humanwirksamkeit gewertet.",
        [ids.pmCount],
      ),
      safety: cited(
        "Keine FDA-Fachinformation. Eine vollständige, behördlich geprüfte Sicherheitsliste liegt in den geprüften Quellen nicht vor.",
        [ids.fdaNone],
      ),
      currentResearch: cited(
        "Kein CT.gov-Programm unter Semax identifiziert. Die Humanliteratur liegt überwiegend außerhalb von ClinicalTrials.gov.",
        [ids.ctCount, ids.pmid("29798983")],
      ),
      unknowns: cited(
        "Unabhängige Replikation, englischsprachige RCTs, Langzeitsicherheit und regulatorischer Status in US/EU sind nicht als abgeschlossen belegt.",
        [ids.fdaNone, ids.ctCount],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "human", severity: "unknown", text: "Keine regulatorische Adverse-Event-Liste identifiziert.", sourceIds: [ids.fdaNone] },
    ],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [],
    reviewItems: (ids) => [
      {
        id: "semax-ctgov-zero",
        priority: "Medium",
        topic: "0 CT.gov-Treffer ≠ keine Humanforschung",
        note: "Die Abfrage semax lieferte 0 ClinicalTrials.gov-Treffer. PMID 29798983 und weitere titelgeprüfte PubMed-Einträge belegen Humanliteratur außerhalb dieses Registers.",
        sourceIds: [ids.ctCount, ids.pmid("29798983")],
      },
    ],
  },
  selank: {
    evidenceLevel: "C",
    confidenceLevel: "low",
    regulatoryStatus: "investigational",
    reviewStatus: "review-recommended",
    regulatoryRegions: [],
    chemicalClass: "tuftsin analogue",
    moleculeType: "peptide",
    identityNote:
      "PubChem CID 11765600. ClinicalTrials.gov lieferte 10 Treffer zum Term selank; die gecachten Titel enthalten nicht Selank (Substring-/Noise-Hits) und werden nicht veröffentlicht.",
    summary: (ids) => ({
      whatIsIt: cited(
        "Selank ist ein Tuftsin-Analog. Russischsprachige klinische Arbeiten vergleichen u. a. anxiolytische Wirkung mit Phenazepam; eine FDA-Zulassung war nicht nachweisbar.",
        [ids.pmid("25176261"), ids.pubchem, ids.fdaNone],
      ),
      mechanism: cited(
        "PMID 18454096 diskutiert mögliche Wirkmechanismen bei generalisierten Angststörungen und Neurasthenie; das ist keine Fachinformation.",
        [ids.pmid("18454096")],
      ),
      whatHasBeenStudied: cited(
        "PubMed-Query: titelgeprüfte klinische und tierexperimentelle Selank-Arbeiten. Die 10 CT.gov-Treffer vom 28.08.2026 werden wegen fehlender Substanz im Titel nicht als Selank-Studien veröffentlicht.",
        [ids.pmid("25176261"), ids.pmid("26356395"), ids.ctCount, ids.pmCount],
      ),
      humanEvidence: cited(
        "Begrenzte Humanevidenz aus klinischen Publikationen zu Angststörungen. Keine titelgeprüfte ClinicalTrials.gov-Studie. Keine FDA-Zulassung in dieser Abfrage.",
        [ids.pmid("25176261"), ids.pmid("18454096"), ids.fdaNone],
      ),
      preclinicalEvidence: cited(
        "PMID 26356395 vergleicht pharmakologische Effekte nach intranasaler vs. intraperitonealer Gabe bei Mäusen — präklinisch, nicht Humanwirksamkeit.",
        [ids.pmid("26356395")],
      ),
      safety: cited(
        "Die Phenazepam-Vergleichsarbeit spricht Verträglichkeit an; eine regulatorische Fachinformation fehlt.",
        [ids.pmid("25176261"), ids.fdaNone],
      ),
      currentResearch: cited(
        "Kein valides CT.gov-Programm unter Selank in diesem Scan. Humanliteratur liegt außerhalb des Registers bzw. in nicht-englischen Journals.",
        [ids.ctCount],
      ),
      unknowns: cited(
        "Unabhängige westliche RCTs, Langzeitsicherheit und US-/EU-Zulassung sind nicht belegt.",
        [ids.fdaNone, ids.ctCount],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "human", severity: "unknown", text: "Keine FDA-Adverse-Event-Liste; Verträglichkeit nur aus zitierter klinischer Literatur.", sourceIds: [ids.fdaNone, ids.pmid("25176261")] },
      { domain: "animal", severity: "unknown", text: "Mausdaten zur Applikationsroute sind nicht auf Human-Sicherheit übertragbar.", sourceIds: [ids.pmid("26356395")] },
    ],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [],
    reviewItems: (ids) => [
      {
        id: "selank-ctgov-noise",
        priority: "High",
        topic: "CT.gov-Treffer ohne Selank im Titel",
        note: "10 ClinicalTrials.gov-Hits zum Term selank betrafen in den gecachten Titeln andere kognitive/neurologische Interventionen. Sie werden nicht veröffentlicht. 10 Noise-Hits ≠ 10 Selank-Studien.",
        sourceIds: [ids.ctCount],
      },
    ],
  },
  "thymosin-alpha-1": {
    evidenceLevel: "C",
    confidenceLevel: "moderate",
    regulatoryStatus: "clinical-development",
    reviewStatus: "review-required",
    regulatoryRegions: [],
    chemicalClass: "thymic peptide",
    moleculeType: "peptide",
    identityNote:
      "Thymalfasin / Zadaxin / Tα1 (PubChem CID 16130571). Drugs@FDA-Suche thymalfasin am 28.08.2026 ohne Match. Das belegt nicht, dass in anderen Regionen keine Zulassung besteht — ohne Primärquelle kein regionales Approved.",
    summary: (ids) => ({
      whatIsIt: cited(
        "Thymosin Alpha-1 (Thymalfasin) ist ein thymisches Peptid. Ein als Systematic Review indexierter Überblick fasst Sicherheit und Wirksamkeit in Humanstudien zusammen. Eine FDA-Zulassung war in dieser Abfrage nicht nachweisbar.",
        [ids.pmid("38308608"), ids.pubchem, ids.fdaNone],
      ),
      mechanism: cited(
        "Die zitierte Übersicht und die registrierten Studien behandeln immunmodulatorische Anwendungen; eine FDA-Fachinformation liegt nicht vor.",
        [ids.pmid("38308608")],
      ),
      whatHasBeenStudied: cited(
        "ClinicalTrials.gov: 66 Treffer zum Term thymosin alpha-1 (28.08.2026), darunter COVID-Booster (NCT06821100), Dialyse/COVID-Prävention (NCT04428008) und onkologische Kombinationen (NCT07780721).",
        [ids.nct("NCT06821100"), ids.nct("NCT04428008"), ids.nct("NCT07780721"), ids.ctCount],
      ),
      humanEvidence: cited(
        "Mehrere Humanstudien und ein Systematic Review. Keine Drugs@FDA-Zulassung in dieser Abfrage. Regionale Zulassungen (z. B. historische Zadaxin-Nennungen) ohne Primärbehörde bleiben ungeprüft.",
        [ids.pmid("38308608"), ids.nct("NCT04428008"), ids.fdaNone],
      ),
      preclinicalEvidence: cited(
        "Zusätzliche Literatur kann präklinisch sein; in diesem Scan werden Humanstudien und der Review priorisiert.",
        [ids.pmid("38308608")],
      ),
      safety: cited(
        "Keine FDA-Fachinformation. Sicherheitsaussagen des Reviews ersetzen kein Label.",
        [ids.pmid("38308608"), ids.fdaNone],
      ),
      currentResearch: cited(
        "Laufende und abgeschlossene CT.gov-Programme zu Impfantwort, Infektion und Onkologie (Stand 28.08.2026).",
        [ids.nct("NCT06821100"), ids.nct("NCT04428008"), ids.nct("NCT07780721")],
      ),
      unknowns: cited(
        "US-/EU-Zulassungsstatus, Standardindikation und Übertragbarkeit auf Research-Vials sind nicht als abgeschlossen belegt.",
        [ids.fdaNone],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "human", severity: "unknown", text: "Keine FDA-Adverse-Event-Liste; Human-Sicherheit nur aus Studien/Review.", sourceIds: [ids.fdaNone, ids.pmid("38308608")] },
    ],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste aus einer FDA-Fachinformation identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [],
    reviewItems: (ids) => [
      {
        id: "ta1-zadaxin-non-us",
        priority: "High",
        topic: "Zadaxin/Thymalfasin außerhalb Drugs@FDA",
        note: "Alias Zadaxin ist katalogisiert. openFDA/thymalfasin war am 28.08.2026 ohne Match. Ohne EMA/NMPA/andere Primärquelle kein regionales Approved. Status bleibt klinische Entwicklung / insufficient für US-Label.",
        sourceIds: [ids.fdaNone, ids.pmid("38308608")],
      },
    ],
  },
  kpv: {
    evidenceLevel: "D",
    confidenceLevel: "low",
    regulatoryStatus: "investigational",
    reviewStatus: "fresh",
    regulatoryRegions: [],
    chemicalClass: "alpha-MSH fragment (Lys-Pro-Val)",
    moleculeType: "peptide",
    identityNote: "KPV = Lys-Pro-Val, C-terminales α-MSH-Fragment. ClinicalTrials.gov-Suche „KPV peptide“ am 28.08.2026: 0 Studien. PubChem ohne CID in diesem Scan.",
    summary: (ids) => ({
      whatIsIt: cited(
        "KPV ist das Tripeptid Lys-Pro-Val. Publizierte Arbeiten betreffen vor allem Formulierung, transdermale Iontophorese an humaner Haut (ex vivo) und präklinische Nanodrug-Modelle. Keine FDA-Zulassung nachweisbar.",
        [ids.pmid("28343991"), ids.pmid("39252648"), ids.fdaNone],
      ),
      mechanism: cited(
        "KPV wird in der Literatur als α-MSH-bezogenes Fragment mit antiinflammatorischem Forschungskontext geführt; das ist keine Fachinformation.",
        [ids.pmid("28343991")],
      ),
      whatHasBeenStudied: cited(
        "PubMed-Query: 7 Treffer. ClinicalTrials.gov: 0 Treffer. 0 Registertreffer ist kein Beweis für weltweit fehlende Humanstudien, zeigt aber keine registrierte KPV-Studie unter diesem Term.",
        [ids.pmCount, ids.ctCount, ids.pmid("39252648")],
      ),
      humanEvidence: cited(
        "PMID 28343991 untersucht Iontophorese über mikroporierte humane Haut — Ex-vivo-Permeation, keine klinische Wirksamkeitsstudie. Keine CT.gov-Humanstudie unter diesem Term.",
        [ids.pmid("28343991"), ids.ctCount],
      ),
      preclinicalEvidence: cited(
        "PMID 39252648 beschreibt selbstassemblierte KPV/RAPA-Nanodrugs in einem vaskulären Kalzifikationsmodell — präklinisch.",
        [ids.pmid("39252648")],
      ),
      safety: cited(
        "Keine FDA-Fachinformation und keine ausreichenden belastbaren Human-Sicherheitsdaten aus zugelassenen Labels.",
        [ids.fdaNone],
      ),
      currentResearch: cited(
        "Kein CT.gov-Programm unter KPV peptide identifiziert (28.08.2026).",
        [ids.ctCount],
      ),
      unknowns: cited(
        "Klinische Wirksamkeit, Humandosierung, Rekonstitution und Zulassung bleiben ungeklärt.",
        [ids.fdaNone, ids.ctCount],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "human", severity: "unknown", text: "Keine ausreichenden Human-Sicherheitsdaten aus Fachinformationen.", sourceIds: [ids.fdaNone] },
      { domain: "in-vitro", severity: "unknown", text: "Ex-vivo-Hautpermeation (PMID 28343991) ist keine klinische Sicherheitsstudie.", sourceIds: [ids.pmid("28343991")] },
    ],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [],
    reviewItems: () => [],
  },
  "igf-1-lr3": {
    evidenceLevel: "F",
    confidenceLevel: "insufficient",
    regulatoryStatus: "investigational",
    reviewStatus: "review-recommended",
    regulatoryRegions: [],
    chemicalClass: "IGF-1 analogue (Long R3)",
    moleculeType: "peptide",
    identityNote:
      "IGF-1 LR3 (Long R3 IGF-1) wird nicht mit rhIGF-1/Mecasermin (Increlex) gleichgesetzt. PubChem ohne CID in diesem Scan. PMID 22227200 (Schaf-Pansenepithel, IGF-1) wurde als Fehlzuordnung ausgeschlossen.",
    summary: (ids) => ({
      whatIsIt: cited(
        "IGF-1 LR3 ist ein Long-R3-Analogon von IGF-1. In diesem Scan keine Drugs@FDA-Zulassung und 0 ClinicalTrials.gov-Treffer unter „IGF-1 LR3“. Ein Review zur GH-IGF1-Achse und Self-Administration erwähnt performance-enhancing peptides, belegt aber keine LR3-Zulassung.",
        [ids.pmid("42395176"), ids.fdaNone, ids.ctCount],
      ),
      mechanism: cited(
        "Der zitierte Review diskutiert Peptide der GH-IGF1-Achse im Spannungsfeld klinischer Evidenz vs. Self-Administration; das ersetzt keine LR3-Fachinformation.",
        [ids.pmid("42395176")],
      ),
      whatHasBeenStudied: cited(
        "PubMed-Query: 2 Treffer. Davon PMID 22227200 ausgeschlossen (Schaf, nicht LR3). ClinicalTrials.gov: 0 Treffer. 0 Registertreffer ≠ Nachweis, dass nirgends Humanforschung existiert.",
        [ids.pmCount, ids.ctCount, ids.pmid("42395176")],
      ),
      humanEvidence: cited(
        "Keine titelgeprüfte Humanstudie speziell zu IGF-1 LR3 in diesem Scan. Mecasermin-Literatur wird nicht als LR3-Evidenz verwendet.",
        [ids.pmid("42395176"), ids.ctCount, ids.fdaNone],
      ),
      preclinicalEvidence: cited(
        "Keine separat kuratierte LR3-Präklinik-Primärquelle nach Ausschluss der Schaf-IGF-1-Arbeit.",
        [ids.pmid("42395176")],
      ),
      safety: cited(
        "Keine FDA-Fachinformation für IGF-1 LR3. Keine ausreichenden belastbaren Human-Sicherheitsdaten in den geprüften Quellen.",
        [ids.fdaNone],
      ),
      currentResearch: cited(
        "Kein CT.gov-Programm unter IGF-1 LR3 identifiziert (28.08.2026).",
        [ids.ctCount],
      ),
      unknowns: cited(
        "Humane PK, Sicherheit, Dosis und regulatorischer Status von IGF-1 LR3 bleiben ungeklärt. Increlex ist ein anderes Produkt.",
        [ids.fdaNone, ids.ctCount],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "human", severity: "unknown", text: "Keine ausreichenden belastbaren Human-Sicherheitsdaten für IGF-1 LR3.", sourceIds: [ids.fdaNone] },
    ],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [],
    reviewItems: (ids) => [
      {
        id: "igf-lr3-not-mecasermin",
        priority: "High",
        topic: "Nicht mit Mecasermin/Increlex zusammenführen",
        note: "0 CT.gov- und 0 FDA-Treffer für IGF-1 LR3. rhIGF-1-Zulassungen gelten nicht automatisch für Long R3. PMID 22227200 (Schaf) bleibt ausgeschlossen.",
        sourceIds: [ids.fdaNone, ids.ctCount, ids.pmid("42395176")],
      },
    ],
  },
  somatropin: {
    evidenceLevel: "A",
    confidenceLevel: "high",
    regulatoryStatus: "approved-specific",
    reviewStatus: "fresh",
    regulatoryRegions: ["US", "EU"],
    chemicalClass: "recombinant human growth hormone",
    moleculeType: "peptide",
    identityNote:
      "Rekombinantes humanes Wachstumshormon. FDA-Labels u. a. Norditropin (BLA021148), Omnitrope, Serostim. EMA-EPAR Omnitrope HTTP 200 am 28.08.2026. EPAR-URL Norditropin lieferte 404 — kein globales „Approved“ über nicht geprüfte Marken.",
    summary: (ids) => ({
      whatIsIt: cited(
        "Somatropin ist rekombinantes humanes Wachstumshormon. Zugelassene US-Fertigprodukte umfassen laut FDA-Fachinformation u. a. Norditropin (pädiatrische und weitere gelistete Indikationen), Omnitrope und Serostim. In der EU ist Omnitrope über ein EMA-EPAR dokumentiert.",
        [ids.fda("fda-norditropin"), ids.fda("fda-omnitrope"), ids.fda("fda-serostim"), ids.ema("ema-omnitrope")],
      ),
      mechanism: cited(
        "Laut Norditropin-Fachinformation bindet Somatropin dimere GH-Rezeptoren und induziert u. a. IGF-1-abhängige Transkription; direkte Gewebe- und Stoffwechseleffekte werden im Label beschrieben.",
        [ids.fda("fda-norditropin")],
      ),
      whatHasBeenStudied: cited(
        "Zugelassene Indikationen stehen in den jeweiligen Labels (nicht alle Marken teilen dieselben Indikationen; Serostim vs. Norditropin nicht gleichsetzen). ClinicalTrials.gov listete am 28.08.2026 1299 Treffer zum Term somatropin — nur titelgeprüfte Records werden als Studienzeilen veröffentlicht.",
        [ids.fda("fda-norditropin"), ids.fda("fda-serostim"), ids.ctCount],
      ),
      humanEvidence: cited(
        "Starke Humanevidenz über zugelassene FDA-Labels und das EMA-EPAR Omnitrope.",
        [ids.fda("fda-norditropin"), ids.ema("ema-omnitrope")],
      ),
      preclinicalEvidence: cited(
        "Labels enthalten tierexperimentelle Warnhinweise im Umfang der Fachinformation; Research-Vials sind davon nicht abgedeckt.",
        [ids.fda("fda-norditropin")],
      ),
      safety: cited(
        "Norditropin-Label: u. a. erhöhtes Mortalitätsrisiko bei akut kritisch Kranken, plötzlicher Tod bei bestimmten Prader-Willi-Konstellationen, Neoplasien, Glukoseintoleranz/Diabetes. Vollständige Listen stehen in der Fachinformation.",
        [ids.fda("fda-norditropin")],
      ),
      currentResearch: cited(
        "Umfangreiche CT.gov- und PubMed-Treffer zum Term somatropin (28.08.2026). Labels bleiben die primäre Indikationsquelle.",
        [ids.ctCount, ids.pmCount, ids.fda("fda-norditropin")],
      ),
      unknowns: cited(
        "Nicht zugelassene Compounded- oder Research-Produkte sind durch diese Labels nicht abgedeckt. Norditropin-EPAR-URL war 404; andere EU-Marken wurden nicht vollständig geprüft.",
        [ids.fda("fda-norditropin"), ids.ema("ema-omnitrope")],
      ),
    }),
    safetyItems: (ids) => [
      {
        domain: "human",
        severity: "warning",
        text: "Norditropin kontraindiziert u. a. bei akut kritischer Krankheit nach großen Operationen/Trauma oder akutem Atemversagen wegen erhöhter Mortalität unter pharmakologischen Somatropin-Dosen.",
        sourceIds: [ids.fda("fda-norditropin")],
      },
      {
        domain: "human",
        severity: "warning",
        text: "Label: Glukoseintoleranz und Diabetes mellitus; Monitoring laut Fachinformation.",
        sourceIds: [ids.fda("fda-norditropin")],
      },
      {
        domain: "human",
        severity: "warning",
        text: "Label: erhöhtes Neoplasierisiko / Zweitneoplasien bei manchen Kinderkrebs-Überlebenden; vorbestehende Tumoren überwachen.",
        sourceIds: [ids.fda("fda-norditropin")],
      },
    ],
    interactions: (ids) => [
      {
        category: "potential",
        text: "Glukosestoffwechsel: Somatropin kann die Insulinsensitivität senken (Norditropin-Warnhinweise). Weitere Interaktionen nur im Umfang der jeweiligen Fachinformation.",
        sourceIds: [ids.fda("fda-norditropin")],
      },
    ],
    reconstitution: (ids) =>
      cited(
        "Zugelassene Produkte werden laut FDA-Label subkutan angewendet (Norditropin: u. a. Oberarm, Abdomen, Gesäß, Oberschenkel, Rotationsschema). Offizielle Zubereitung steht in der jeweiligen Fachinformation. Keine unabhängige Research-Vial-Standardanweisung.",
        [ids.fda("fda-norditropin")],
      ),
    conflicts: [],
    reviewItems: (ids) => [
      {
        id: "somatropin-norditropin-ema-404",
        priority: "Low",
        topic: "Norditropin-EPAR-URL 404",
        note: "https://www.ema.europa.eu/en/medicines/human/EPAR/norditropin lieferte HTTP 404. EU-Region stützt sich in diesem Batch auf Omnitrope EPAR (200), nicht auf die fehlgeschlagene Norditropin-URL.",
        sourceIds: [ids.ema("ema-omnitrope")],
      },
    ],
  },
  hcg: {
    evidenceLevel: "A",
    confidenceLevel: "high",
    regulatoryStatus: "approved-specific",
    reviewStatus: "review-recommended",
    regulatoryRegions: ["US"],
    chemicalClass: "glycoprotein hormone (chorionic gonadotropin)",
    moleculeType: "biologics",
    identityNote:
      "Urinäres/chorionisches Gonadotropin (FDA DailyMed, BLA017067). Rekombinantes Choriogonadotropin alfa (Ovitrelle, EMA EPAR) ist verwandt, aber nicht dasselbe INN. PubChem CID 1108 aus der Namenssuche wurde als Fehlzuordnung verworfen.",
    summary: (ids) => ({
      whatIsIt: cited(
        "Humanes Choriongonadotropin (hCG) wirkt laut FDA-Fachinformation weitgehend LH-gleich und stimuliert die gonadale Steroidproduktion. Zugelassene US-Indikationen in der geprüften DailyMed-Information umfassen u. a. präpubertären Kryptorchismus ohne anatomische Obstruktion. Das Label stellt ausdrücklich fest, dass hCG nicht als wirksame adjuvante Adipositastherapie belegt ist.",
        [ids.fda("fda-hcg")],
      ),
      mechanism: cited(
        "Laut Label ist die Wirkung praktisch identisch mit hypophysärem LH, mit geringer FSH-Aktivität; Stimulation der Leydig-Zellen bzw. des Corpus luteum.",
        [ids.fda("fda-hcg")],
      ),
      whatHasBeenStudied: cited(
        "US-Labelindikationen und die explizite Nicht-Indikation Adipositas. ClinicalTrials.gov und PubMed liefern sehr große Trefferzahlen zum Term chorionic gonadotropin; nur titelgeprüfte Records werden veröffentlicht. EMA-EPAR Ovitrelle (Choriogonadotropin alfa) ist eine verwandte, nicht identische Zubereitung (EU).",
        [ids.fda("fda-hcg"), ids.ctCount, ids.pmCount, ids.ema("ema-ovitrelle")],
      ),
      humanEvidence: cited(
        "Starke Humanevidenz für die im US-Label genannten Indikationen. Für Gewichtsverlust widerspricht das Label einer evidenzbasierten Nutzung.",
        [ids.fda("fda-hcg")],
      ),
      preclinicalEvidence: cited(
        "Mechanismusangaben stehen im Label; separate Präklinik wurde in diesem Scan nicht extra kuratiert.",
        [ids.fda("fda-hcg")],
      ),
      safety: cited(
        "Label: u. a. Kopfschmerz, Reizbarkeit, Ödeme, vorzeitige Pubertät, Gynäkomastie, Injektionsschmerz; Kontraindikationen vorzeitige Pubertät, androgenabhängige Neoplasien, allergische Reaktion. Zusammen mit Menotropinen OHSS-Risiko.",
        [ids.fda("fda-hcg")],
      ),
      currentResearch: cited(
        "Sehr große CT.gov-/PubMed-Trefferzahlen (28.08.2026) sind nicht mit zusätzlichen zugelassenen Indikationen gleichzusetzen. Primär bleibt das US-Label.",
        [ids.ctCount, ids.pmCount, ids.fda("fda-hcg")],
      ),
      unknowns: cited(
        "Research-/Compounded-hCG ist durch BLA017067 nicht abgedeckt. EU-Status von urinärem hCG wurde nicht als eigenes EPAR geprüft; Ovitrelle ist rekombinantes alfa.",
        [ids.fda("fda-hcg"), ids.ema("ema-ovitrelle")],
      ),
    }),
    safetyItems: (ids) => [
      {
        domain: "human",
        severity: "common",
        text: "Label: Kopfschmerz, Reizbarkeit, Unruhe, Depression, Müdigkeit, Ödem, vorzeitige Pubertät, Gynäkomastie, Injektionsschmerz.",
        sourceIds: [ids.fda("fda-hcg")],
      },
      {
        domain: "human",
        severity: "serious",
        text: "Label: ovarielles Überstimulationssyndrom als ernstes Risiko in Kombination mit Menotropinen.",
        sourceIds: [ids.fda("fda-hcg")],
      },
      {
        domain: "human",
        severity: "warning",
        text: "Kontraindiziert bei vorzeitiger Pubertät, Prostatakarzinom oder anderer androgenabhängiger Neoplasie sowie bekannter hCG-Allergie.",
        sourceIds: [ids.fda("fda-hcg")],
      },
    ],
    interactions: (ids) => [
      {
        category: "established",
        text: "Label: Kombination mit humanen menopausalen Gonadotropinen nur durch in der Infertilität erfahrene Ärztinnen/Ärzte; OHSS-Risiko.",
        sourceIds: [ids.fda("fda-hcg")],
      },
    ],
    reconstitution: (ids) =>
      cited(
        "Laut FDA-Fachinformation intramuskuläre Anwendung; Dosierungsregimes stehen in der DailyMed-Information. Keine unabhängige Research-Vial-Standardanweisung.",
        [ids.fda("fda-hcg")],
      ),
    conflicts: [
      {
        topic: "Urinäres hCG vs. rekombinantes Choriogonadotropin alfa",
        note: "US-DailyMed beschreibt chorionic gonadotropin (BLA017067). EMA-EPAR Ovitrelle betrifft choriogonadotropin alfa. Nicht als identische Substanz zusammenführen.",
        sourceIds: ["fda-hcg", "ema-ovitrelle"],
      },
    ],
    reviewItems: (ids) => [
      {
        id: "hcg-ovitrelle-identity",
        priority: "Medium",
        topic: "Ovitrelle nicht als urinäres hCG-Label werten",
        note: "EU-EPAR Ovitrelle (HTTP 200) ist als verwandte rekombinante Quelle hinterlegt, erweitert aber nicht automatisch die US-Indikationen und setzt regulatoryRegions nicht auf EU für urinäres hCG.",
        sourceIds: [ids.fda("fda-hcg"), ids.ema("ema-ovitrelle")],
      },
    ],
  },
  gonadorelin: {
    evidenceLevel: "E",
    confidenceLevel: "low",
    regulatoryStatus: "insufficient",
    reviewStatus: "review-required",
    regulatoryRegions: [],
    chemicalClass: "GnRH / LHRH",
    moleculeType: "peptide",
    identityNote:
      "Gonadorelin (PubChem CID 638793); Aliase Factrel, historisch Lutrelef. openFDA-Suche gonadorelin am 28.08.2026: kein Match. EMA-URL /EPAR/lutrelef: HTTP 404. CT.gov- und PubMed-Queries sind stark verrauscht (GnRH-Klasse, hCG, Onkologie).",
    summary: (ids) => ({
      whatIsIt: cited(
        "Gonadorelin ist natives GnRH. In diesem Scan keine aktuelle FDA-Fachinformation und kein erreichbares Lutrelef-EPAR unter der geprüften URL. PubChem bestätigt eine Compound-Identität (CID 638793).",
        [ids.pubchem, ids.fdaNone],
      ),
      mechanism: cited(
        "Die chemische Klasse ist GnRH/LHRH laut Identity/PubChem; eine zitierfähige Fachinformations-Mechanismuspassage liegt in diesem Scan nicht vor.",
        [ids.pubchem],
      ),
      whatHasBeenStudied: cited(
        "ClinicalTrials.gov: 1331 Treffer zum Term gonadorelin (28.08.2026); die gecachten Titel betreffen überwiegend andere Interventionen. PubMed-Query: 95 Treffer, ohne titelgeprüftes „gonadorelin“ in den gecachten Artikeln. Weder 1331 noch 95 Treffer werden als Gonadorelin-Studien veröffentlicht.",
        [ids.ctCount, ids.pmCount],
      ),
      humanEvidence: cited(
        "Historische Arzneimittelnamen (Factrel/Lutrelef) sind katalogisiert, aber ohne bestätigte aktuelle Behördenseite in diesem Scan. Keine titelgeprüfte Humanstudie aus dem Cache veröffentlicht. Das ist begrenzte bis unzureichende kuratierte Humanevidenz, nicht der Nachweis fehlender Weltliteratur.",
        [ids.fdaNone, ids.ctCount, ids.pmCount],
      ),
      preclinicalEvidence: cited(
        "Keine separat kuratierte Präklinik-Primärquelle nach Titel-Filter.",
        [ids.pubchem],
      ),
      safety: cited(
        "Keine FDA- oder EMA-Fachinformation in den geprüften Endpunkten. Keine Adverse-Event-Liste aus Label.",
        [ids.fdaNone],
      ),
      currentResearch: cited(
        "Kein titelgeprüftes CT.gov-Programm. Die Roh-Trefferzahl dokumentiert Query-Rauschen, nicht ein Gonadorelin-Entwicklungsprogramm.",
        [ids.ctCount],
      ),
      unknowns: cited(
        "Aktueller Zulassungsstatus (US/EU/UK), PK und Sicherheit aus Labels sowie valide Registerstudien bleiben in diesem Batch ungeprüft bzw. ungefiltert zu verrauscht.",
        [ids.fdaNone, ids.ctCount],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "human", severity: "unknown", text: "Keine Label-Sicherheitsliste identifiziert.", sourceIds: [ids.fdaNone] },
    ],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [],
    reviewItems: (ids) => [
      {
        id: "gonadorelin-query-noise",
        priority: "High",
        topic: "CT.gov/PubMed-Rauschen und fehlende aktuelle Labels",
        note: "Factrel/Lutrelef sind Identity-Aliase. FDA 404 und EMA lutrelef 404 sind keine globale Nicht-Zulassung. 1331 CT.gov-Treffer ohne „gonadorelin“ im Titel dürfen nicht als Studienlage gelten. Nächste Recherche: Title-restricted PubMed und alternative EPAR-Slugs.",
        sourceIds: [ids.fdaNone, ids.ctCount, ids.pmCount],
      },
    ],
  },
  "melanotan-ii": {
    evidenceLevel: "F",
    confidenceLevel: "low",
    regulatoryStatus: "investigational",
    reviewStatus: "review-recommended",
    regulatoryRegions: [],
    chemicalClass: "melanocortin receptor agonist",
    moleculeType: "peptide",
    identityNote:
      "Melanotan II (PubChem CID 92432) ist nicht Afamelanotid/Scenesse (NDP-MSH). Der einzige CT.gov-Treffer NCT07437560 (Hudson Biotech) wird nicht veröffentlicht.",
    summary: (ids) => ({
      whatIsIt: cited(
        "Melanotan II ist ein melanotropes Analog, das in Entwicklungsübersichten neben Melanotan-I beschrieben wird. Keine FDA-Zulassung in dieser Abfrage. Nicht mit Afamelanotid gleichsetzen.",
        [ids.pmid("9760697"), ids.pubchem, ids.fdaNone],
      ),
      mechanism: cited(
        "Die zitierte Entwicklungsübersicht ordnet Melanotan-I und -II melanogenen Forschungsprogrammen zu; das ist keine aktuelle Fachinformation.",
        [ids.pmid("9760697")],
      ),
      whatHasBeenStudied: cited(
        "ClinicalTrials.gov: 1 Treffer (NCT07437560, Hudson Biotech) — ausgeschlossen. PubMed-Query: 26 Treffer; titelgeprüft u. a. Entwicklungsreview und ein Case Report zu Melanotan-assoziiertem Melanoma in situ.",
        [ids.ctCount, ids.pmCount, ids.pmid("9760697"), ids.pmid("22724573")],
      ),
      humanEvidence: cited(
        "Keine validierte registrierte Humanstudie in diesem Scan. Ein Case Report beschreibt Melanoma in situ im Zusammenhang mit Melanotan — das ist keine Wirksamkeits-Evidenz und keine Häufigkeitsangabe.",
        [ids.pmid("22724573"), ids.ctCount, ids.fdaNone],
      ),
      preclinicalEvidence: cited(
        "Historische Entwicklungsarbeiten existieren; in diesem Scan keine separat als RCT kuratierte Präklinik-Primärquelle neben dem Review.",
        [ids.pmid("9760697")],
      ),
      safety: cited(
        "Keine FDA-Fachinformation. Der Case Report ist ein humanes Sicherheitssignal auf Einzelfallniveau, kein Beleg für Inzidenz.",
        [ids.fdaNone, ids.pmid("22724573")],
      ),
      currentResearch: cited(
        "Kein veröffentlichtes CT.gov-Programm nach Ausschluss des Hudson-Records (28.08.2026).",
        [ids.ctCount],
      ),
      unknowns: cited(
        "Belastbare Human-Sicherheits- und Wirksamkeitsdaten, PK und Zulassung fehlen in den geprüften Quellen. Scenesse-Daten gelten nicht automatisch.",
        [ids.fdaNone, ids.ctCount],
      ),
    }),
    safetyItems: (ids) => [
      { domain: "human", severity: "unknown", text: "Keine Label-Sicherheitsliste. Case Report: Melanotan-assoziiertes Melanoma in situ (Einzelfall).", sourceIds: [ids.fdaNone, ids.pmid("22724573")] },
    ],
    interactions: (ids) => [{ category: "unknown", text: "Keine etablierte Interaktionsliste identifiziert.", sourceIds: [ids.fdaNone] }],
    reconstitution: () => null,
    conflicts: [],
    reviewItems: (ids) => [
      {
        id: "mt2-hudson-and-afamelanotide",
        priority: "High",
        topic: "Hudson-NCT ausgeschlossen; nicht Afamelanotid",
        note: "NCT07437560 ist Hudson Biotech und wird nicht veröffentlicht. Melanotan II bleibt von Afamelanotid/Scenesse getrennt. 1 ausgeschlossener CT.gov-Hit ≠ Nachweis fehlender weltweiter Humanforschung, zeigt aber kein valides Registerprogramm in diesem Scan.",
        sourceIds: [ids.ctCount, ids.pmid("9760697")],
      },
    ],
  },
};

export function compileGlowBlend(ACCESS, COMMUNITY_MSG) {
  const sources = [
    {
      id: "identity-glow-blend",
      title: "Identity mapping: shop blend GHK-Cu + TB-500 + BPC-157 (not a unique INN)",
      url: "https://pubchem.ncbi.nlm.nih.gov/",
      publisher: "Peptix identity catalog",
      publicationDate: null,
      accessDate: ACCESS,
      doi: null,
      pmid: null,
      clinicalTrialId: null,
      sourceType: "scientific",
      sourceQuality: 3,
    },
    {
      id: "pubchem-ghk-cu-component",
      title: "Component identity GHK-Cu: PubChem CID 139035031",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/139035031",
      publisher: "NCBI PubChem",
      publicationDate: null,
      accessDate: ACCESS,
      doi: null,
      pmid: null,
      clinicalTrialId: null,
      sourceType: "scientific",
      sourceQuality: 4,
    },
    {
      id: "pubchem-tb-500-component",
      title: "Component identity TB-500: PubChem CID 62707662 (CAS 885340-08-9)",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/62707662",
      publisher: "NCBI PubChem",
      publicationDate: null,
      accessDate: ACCESS,
      doi: null,
      pmid: null,
      clinicalTrialId: null,
      sourceType: "scientific",
      sourceQuality: 4,
    },
    {
      id: "pubchem-bpc-157-component",
      title: "Component identity BPC-157: PubChem CID 9941957 (CAS 137525-51-0)",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/9941957",
      publisher: "NCBI PubChem",
      publicationDate: null,
      accessDate: ACCESS,
      doi: null,
      pmid: null,
      clinicalTrialId: null,
      sourceType: "scientific",
      sourceQuality: 4,
    },
    {
      id: "fda-none-glow-blend",
      title: "openFDA Drugs@FDA: blend products are not a unique INN; no blend NDA searched as a single substance",
      url: "https://open.fda.gov/apis/drug/drugsfda/",
      publisher: "openFDA",
      publicationDate: null,
      accessDate: ACCESS,
      doi: null,
      pmid: null,
      clinicalTrialId: null,
      sourceType: "regulatory",
      sourceQuality: 5,
    },
  ];
  const ids = {
    map: "identity-glow-blend",
    ghk: "pubchem-ghk-cu-component",
    tb: "pubchem-tb-500-component",
    bpc: "pubchem-bpc-157-component",
    fdaNone: "fda-none-glow-blend",
  };
  return {
    slug: "glow-blend",
    publicationStatus: "published",
    lastReviewedAt: ACCESS,
    lastResearchScanAt: ACCESS,
    lastCommunityScanAt: null,
    evidenceLevel: "F",
    confidenceLevel: "insufficient",
    regulatoryStatus: "insufficient",
    reviewStatus: "fresh",
    regulatoryRegions: [],
    identity: {
      verified: true,
      casNumber: null,
      chemicalClass: "product blend (GHK-Cu + TB-500 + BPC-157)",
      moleculeType: "blend",
      identityNote:
        "Shop-Blend, keine eigenständige wissenschaftliche INN. Wissenschaftliche Aussagen stehen auf den Komponentenprofilen GHK-Cu, TB-500 und BPC-157. TB-500 bleibt von Thymosin Beta-4 getrennt.",
    },
    connectors: [
      { id: "fda", status: "not-found", note: "Blend not queried as a unique NDA/INN" },
      { id: "ema", status: "unavailable", note: "No blend EPAR" },
      { id: "bfarm", status: "unavailable", note: "BfArM-Connector nicht konfiguriert" },
      { id: "mhra", status: "unavailable", note: "MHRA-Connector nicht konfiguriert" },
      { id: "clinicaltrials", status: "unavailable", note: "Blends are not unique trial interventions in this catalog" },
      { id: "pubmed", status: "unavailable", note: "Literature is attached to component substances" },
      { id: "reddit", status: "unavailable", note: COMMUNITY_MSG },
    ],
    summary: {
      whatIsIt: cited(
        "GHK-Cu + TB-500 + BPC-157 ist ein Shop-Produktblend aus drei getrennten Substanzen. Es wird nicht als eigenes INN oder als synergistisches Arzneimittel recherchiert.",
        [ids.map, ids.ghk, ids.tb, ids.bpc],
      ),
      mechanism: cited(
        "Es gibt keinen blend-eigenen, behördlich geprüften Mechanismus. Mechanismen — sofern belegt — stehen in den Komponentenprofilen.",
        [ids.map, ids.ghk, ids.tb, ids.bpc],
      ),
      whatHasBeenStudied: cited(
        "Studien und Labels wurden nicht dem Blend als Ganzes zugeordnet. Siehe GHK-Cu, TB-500 und BPC-157.",
        [ids.map],
      ),
      humanEvidence: cited(
        "Keine Humanevidenz für die Dreierkombination als eigene Intervention in diesem Scan. Komponenten-Evidenz darf nicht addiert werden.",
        [ids.map, ids.fdaNone],
      ),
      preclinicalEvidence: cited(
        "Keine Blend-Präklinik kuratiert.",
        [ids.map],
      ),
      safety: cited(
        "Keine Fachinformation für das Blend. Sicherheitsdaten der Komponenten gelten nicht automatisch für die Kombination.",
        [ids.fdaNone],
      ),
      currentResearch: cited(
        "Kein eigenes CT.gov-/Label-Programm für diesen Shop-Blend identifiziert.",
        [ids.fdaNone],
      ),
      unknowns: cited(
        "Wechselwirkungen der drei Peptide in einer gemeinsamen Zubereitung, Dosierung und Qualität von Research-Blends sind nicht regulatorisch bewertet.",
        [ids.fdaNone, ids.map],
      ),
    },
    pharmacology: [],
    safetyItems: [
      {
        domain: "theoretical",
        severity: "unknown",
        text: "Keine Label-Sicherheitsliste für das Blend; Komponentenprofile nicht als Kombinationssicherheit lesen.",
        sourceIds: [ids.fdaNone, ids.map],
      },
    ],
    interactions: [
      { category: "unknown", text: "Keine etablierte Interaktionsliste für die Dreierkombination identifiziert.", sourceIds: [ids.fdaNone] },
    ],
    reconstitution: null,
    studies: [],
    sources,
    conflicts: [],
    reviewItems: [
      {
        id: "glow-blend-components-only",
        priority: "Low",
        topic: "Wissenschaft nur über Komponenten",
        note: "Research Complete für den Blend bedeutet: Identity und Mapping geprüft, keine Pseudo-INN-Recherche. Neue wissenschaftliche Aussagen gehören in die drei Komponentenprofile.",
        sourceIds: [ids.map, ids.ghk, ids.tb, ids.bpc],
      },
    ],
    community: { available: false, message: COMMUNITY_MSG },
    researchReport: {
      identity: "Verified (blend mapping)",
      fda: "Checked — blend is not a unique INN",
      ema: "Unavailable",
      clinicalTrials: 0,
      pubmed: 0,
      scientific: 0,
      community: "Unavailable",
      conflicts: 0,
    },
  };
}
