import type { LexiconContentPack } from "@/lib/peptide/lexiconV2/contentEngine/types";
import { fdaSource, pubmedSource } from "@/lib/peptide/lexiconV2/contentEngine/sources";

const PT141_PHASE3 = pubmedSource(
  "31599840",
  "Bremelanotide for the Treatment of Hypoactive Sexual Desire Disorder: Two Randomized Phase 3 Trials",
  "Obstet Gynecol",
  "2019",
);

const PT141_FDA = fdaSource(
  "vyleesi-bremelanotide",
  "Vyleesi (bremelanotide) FDA prescribing information",
  "https://www.accessdata.fda.gov/scripts/cder/daf/",
);

export const PT141_CONTENT: LexiconContentPack = {
  slug: "pt-141",
  contentStatus: "COMPLETE",
  shortDescriptionDe:
    "PT-141 (Bremelanotid) ist ein zyklisches Peptid und Melanocortin-Rezeptor-Agonist. In den USA ist Bremelanotid als Vyleesi® für eine spezifische Indikation zugelassen – nicht identisch mit Melanotan II.",
  identityNote: "PT-141 (Bremelanotid) ≠ Melanotan II. Getrennte Identitäten und Profile.",
  usesAndResearchDe:
    "Bremelanotid wurde in randomisierten Phase-3-Studien (RECONNECT) bei prämenopausalen Frauen mit Hypoaktivem Sexualverlangen (HSDD) untersucht. Zugelassen ist es in den USA als on-demand subkutane Therapie für diese Indikation – nicht für andere Zwecke.",
  possibleBenefitsDe:
    "In zwei identischen randomisierten, placebokontrollierten Phase-3-Studien wurden statistisch signifikante Verbesserungen bei Sexualverlangen und distress-bezogenen Endpunkten gegenüber Placebo beschrieben. Diese Befunde gelten für die geprüfte Indikation und Population – keine Übertragung auf andere Anwendungszwecke.",
  possibleRisksDe:
    "In den Phase-3-Studien traten häufiger Übelkeit, Flush und Kopfschmerzen auf als unter Placebo. Blutdruckanstiege wurden beschrieben. Für nicht zugelassene Anwendungszwecke liegen keine etablierten Fachinformationen vor.",
  applicationFormDe:
    "Zugelassen als subkutane on-demand-Injektion (Vyleesi). Im Shop geführtes PT-141 beschreibt nur die Katalog-Darreichungsform – keine Anwendungsempfehlung.",
  humanStudiesDe:
    "Randomisierte kontrollierte Studien (RCT) Phase 3 liegen für HSDD vor (RECONNECT, NCT02333071 und NCT02338960).",
  preclinicalDe:
    "Frühere Dosis-Findungsstudien und präklinische Arbeiten zur Melanocortin-Agonistik liegen vor; klinische Daten für die zugelassene Indikation sind maßgeblich.",
  studyStatusDe: "Zugelassenes Humanarzneimittel (USA: Vyleesi) für HSDD; andere Indikationen investigational.",
  sources: [PT141_PHASE3, PT141_FDA],
};

const DSIP_ORIGINAL = pubmedSource(
  "6155486",
  "A delta sleep-inducing peptide (DSIP)",
  "Eur J Pharmacol",
  "1977",
);

export const DSIP_CONTENT: LexiconContentPack = {
  slug: "dsip",
  contentStatus: "COMPLETE",
  shortDescriptionDe:
    "DSIP (Delta-Sleep-Inducing Peptide) ist ein neuropeptidartiges Forschungspeptid, das erstmals im Kontext Schlaf-Forschung beschrieben wurde.",
  usesAndResearchDe:
    "DSIP wurde in der Grundlagenforschung zu Schlaf, Stress und endokrinen Effekten untersucht. Es gibt keine zugelassene Humantherapie und keine etablierte klinische Studienlage für routinemäßige Anwendung.",
  possibleBenefitsDe:
    "In frühen Humanstudien und präklinischen Modellen wurden Effekte auf Schlafarchitektur und Stressmarker diskutiert; die Ergebnisse sind heterogen und nicht konsistent repliziert. Die Datenlage reicht nicht aus, um einen belegten Nutzen beim Menschen zuverlässig einzuschätzen.",
  possibleRisksDe:
    "Für den Human-Gebrauch außerhalb kontrollierter Forschung liegen keine belastbaren Langzeit-Sicherheitsdaten vor. Die aktuelle Datenlage reicht nicht aus, um Risiken zuverlässig zu beurteilen.",
  applicationFormDe:
    "In der Forschung wurden verschiedene Applikationswege untersucht. Im Shop als lyophilisiertes Peptid geführt – keine Anwendungsempfehlung.",
  humanStudiesDe:
    "Es existieren ältere und kleinere Humanstudien, aber keine robuste, konsistente RCT-Evidenz für eine etablierte Indikation.",
  preclinicalDe:
    "Präklinische und frühe Humanarbeiten beschreiben Schlaf- und neuroendokrine Effekte. Tier- und Einzelstudien begründen keine Humanwirksamkeit.",
  studyStatusDe: "Überwiegend Grundlagenforschung; keine zugelassene Humantherapie.",
  sources: [DSIP_ORIGINAL],
};

const EPITHALON_TEL = pubmedSource(
  "14523363",
  "Peptide bioregulator epithalon activates telomerase in human somatic cells",
  "Bull Exp Biol Med",
  "2003",
);

export const EPITHALON_CONTENT: LexiconContentPack = {
  slug: "epithalon",
  contentStatus: "COMPLETE",
  shortDescriptionDe:
    "Epithalon (Epitalon) ist ein synthetisches Tetrapeptid (Ala-Glu-Asp-Gly), das in der Alterungs- und Telomere-Forschung diskutiert wird.",
  usesAndResearchDe:
    "Epithalon wurde in präklinischen und kleineren Humanstudien im Kontext von Telomerase-Aktivität, Alterung und oxidativem Stress untersucht. Es gibt keine zugelassene Humantherapie.",
  possibleBenefitsDe:
    "In vitro und in präklinischen Modellen wurden Telomerase-Aktivierung und zelluläre Effekte beschrieben. Humanstudien sind klein und nicht für etablierte Indikationen validiert. Die Datenlage reicht nicht aus, um Anti-Aging-Nutzen beim Menschen zu beurteilen.",
  possibleRisksDe:
    "Für den Human-Gebrauch liegen keine belastbaren Langzeit-Sicherheitsdaten vor. Die aktuelle Datenlage reicht nicht aus, um Risiken zuverlässig einzuschätzen.",
  applicationFormDe:
    "In der Forschung wurden subkutane und andere Applikationswege untersucht. Im Shop als lyophilisiertes Peptid geführt – keine Anwendungsempfehlung.",
  humanStudiesDe:
    "Kleinere Humanstudien existieren, aber keine großen randomisierten kontrollierten Studien für etablierte Indikationen.",
  preclinicalDe:
    "Präklinische Arbeiten beschreiben Telomerase-Aktivierung in humanen somatischen Zellen und Effekte in Tiermodellen. Diese Befunde begründen keine Humanwirksamkeit.",
  studyStatusDe: "Forschungspeptid ohne zugelassene Humantherapie; überwiegend präklinische und kleine Humanstudien.",
  sources: [EPITHALON_TEL],
};

const LL37_REVIEW = pubmedSource(
  "9212042",
  "The human antimicrobial and cytotoxic peptides LL-37 and alpha-defensins are expressed by specific lymphocyte and monocyte populations",
  "Blood",
  "1997",
);

export const LL37_CONTENT: LexiconContentPack = {
  slug: "ll37",
  contentStatus: "COMPLETE",
  shortDescriptionDe:
    "LL-37 ist das C-terminale Cathelicidin-Peptid (hCAP18) des angeborenen Immunsystems und wirkt antimikrobiell sowie immunmodulierend.",
  usesAndResearchDe:
    "LL-37 wird in der Immun- und Wundheilungsforschung untersucht, u. a. im Kontext von Infektion, Entzündung und Gewebeheilung. Es gibt keine zugelassene Humantherapie als exogenes Peptid.",
  possibleBenefitsDe:
    "In präklinischen Modellen wurden antimikrobielle, immunmodulierende und wundheilungsbezogene Effekte beschrieben. Die Datenlage reicht nicht aus, um einen belegten therapeutischen Nutzen beim Menschen einzuschätzen.",
  possibleRisksDe:
    "LL-37 kann je nach Kontext pro- oder antiinflammatorisch wirken. Für exogene Humananwendung liegen keine etablierten Sicherheitsdaten vor.",
  applicationFormDe:
    "In der Forschung wurden topische und systemische Applikationswege untersucht. Im Shop als lyophilisiertes Peptid geführt – keine Anwendungsempfehlung.",
  humanStudiesDe:
    "Endogenes LL-37 ist beim Menschen gut charakterisiert; kontrollierte Humanstudien zu exogener Therapie sind begrenzt.",
  preclinicalDe:
    "Umfangreiche präklinische Literatur zu antimikrobieller Aktivität, Immunzell-Expression und Gewebereparatur. Tierbefunde begründen keine Humanwirksamkeit.",
  studyStatusDe: "Endogenes Peptid gut beschrieben; exogene Therapie investigational.",
  sources: [LL37_REVIEW],
};

const ARA290_PHASE2 = pubmedSource(
  "23433727",
  "ARA 290, a nonerythropoietic peptide engineered from erythropoietin, improves nerve function and quality of life in patients with small fiber neuropathy",
  "Mol Med",
  "2013",
);

export const ARA290_CONTENT: LexiconContentPack = {
  slug: "ara-290",
  contentStatus: "COMPLETE",
  shortDescriptionDe:
    "ARA-290 (Cibinetid) ist ein aus Erythropoietin abgeleitetes, nicht-erythropoetisches Peptid (11 Aminosäuren), das den Innate-Repair-Receptor aktiviert.",
  usesAndResearchDe:
    "ARA-290 wurde in klinischen Studien bei neuropathischem Schmerz und kleinfaseriger Neuropathie untersucht. Es gibt keine breite zugelassene Humantherapie.",
  possibleBenefitsDe:
    "In einer Phase-2-Studie bei Patienten mit kleinfaseriger Neuropathie wurden Verbesserungen von Nervenfunktion und Lebensqualität beschrieben. Diese Befunde stammen aus einer begrenzten Studie – keine allgemeine Wirksamkeit.",
  possibleRisksDe:
    "In klinischen Studien wurden überwiegend milde Nebenwirkungen berichtet; die Langzeit-Sicherheit ist nicht etabliert. Für nicht untersuchte Indikationen liegen keine belastbaren Daten vor.",
  applicationFormDe:
    "In klinischen Studien intravenös untersucht. Im Shop als lyophilisiertes Peptid geführt – keine Anwendungsempfehlung.",
  humanStudiesDe:
    "Phase-2-Humanstudien bei neuropathischem Schmerz liegen vor; größere Phase-3-Programme sind nicht etabliert.",
  preclinicalDe:
    "Präklinische Arbeiten beschreiben Innate-Repair-Receptor-Signalweg und neuroprotektive Effekte in Modellen. Tierbefunde begründen keine allgemeine Humanwirksamkeit.",
  studyStatusDe: "Investigational; Phase-2-Daten bei Neuropathie, keine breite Zulassung.",
  sources: [ARA290_PHASE2],
};

const HUMANIN_DISCOVERY = pubmedSource(
  "10856282",
  "A humanin-like peptide in the Alzheimer's disease brain",
  "Proc Natl Acad Sci U S A",
  "2000",
);

export const HUMANIN_CONTENT: LexiconContentPack = {
  slug: "humanin",
  contentStatus: "COMPLETE",
  shortDescriptionDe:
    "Humanin ist ein mitochondriales Peptid, das erstmals im Kontext neurodegenerativer Erkrankungen identifiziert wurde.",
  usesAndResearchDe:
    "Humanin wird in der Langlebigkeits-, Neurodegenerations- und Stoffwechsel-Forschung untersucht. Es gibt keine zugelassene Humantherapie.",
  possibleBenefitsDe:
    "In präklinischen Modellen wurden zytoprotektive und stoffwechselbezogene Effekte beschrieben. Die Datenlage reicht nicht aus, um Nutzen beim Menschen zuverlässig einzuschätzen.",
  possibleRisksDe:
    "Für exogene Humananwendung liegen keine belastbaren Sicherheitsdaten vor. Die aktuelle Datenlage reicht nicht aus, um Risiken zu beurteilen.",
  applicationFormDe:
    "In der Forschung wurden verschiedene Applikationswege untersucht. Im Shop als lyophilisiertes Peptid geführt – keine Anwendungsempfehlung.",
  humanStudiesDe:
    "Endogenes Humanin ist beim Menschen beschrieben; kontrollierte Therapiestudien mit exogenem Humanin fehlen weitgehend.",
  preclinicalDe:
    "Präklinische Arbeiten beschreiben neuro- und zytoprotektive Effekte in Zell- und Tiermodellen. Diese Befunde begründen keine Humanwirksamkeit.",
  studyStatusDe: "Forschungspeptid; überwiegend präklinische Daten.",
  sources: [HUMANIN_DISCOVERY],
};

const DIHEXA_COGNITION = pubmedSource(
  "17396161",
  "The procognitive and synaptogenic effects of angiotensin IV-derived peptides",
  "Regul Pept",
  "2007",
);

export const DIHEXA_CONTENT: LexiconContentPack = {
  slug: "dihexa",
  contentStatus: "COMPLETE",
  shortDescriptionDe:
    "Dihexa ist ein synthetisches Angiotensin-IV-Analogon (kleines Molekül, kein klassisches Peptid) aus der kognitiven Forschung.",
  usesAndResearchDe:
    "Dihexa wurde in präklinischen Modellen im Kontext von Synaptogenese und kognitiver Funktion untersucht. Es gibt keine zugelassene Humantherapie und keine etablierten klinischen Studien.",
  possibleBenefitsDe:
    "In präklinischen Modellen wurden procognitive und synaptogene Effekte beschrieben. Die Datenlage reicht nicht aus, um Nutzen beim Menschen einzuschätzen.",
  possibleRisksDe:
    "Für den Human-Gebrauch liegen keine belastbaren Sicherheitsdaten vor. Die aktuelle Datenlage reicht nicht aus, um Risiken zuverlässig zu beurteilen.",
  applicationFormDe:
    "In präklinischen Studien oral untersucht; im Shop als orale Darreichungsform geführt – keine Dosierungsempfehlung.",
  humanStudiesDe:
    "Es liegen keine veröffentlichten, belastbaren Humanstudien mit etablierten Endpunkten vor.",
  preclinicalDe:
    "Präklinische Arbeiten beschreiben HGF/c-Met-Signalweg und synaptogene Effekte in Tiermodellen. Tierbefunde begründen keine Humanwirksamkeit.",
  studyStatusDe: "Überwiegend präklinische Forschung; keine zugelassene Humantherapie.",
  sources: [DIHEXA_COGNITION],
};

const IBUTAMOREN_GH = pubmedSource(
  "18981431",
  "Two-month growth hormone secretagogue treatment preserves lean body mass in healthy men",
  "J Clin Endocrinol Metab",
  "2008",
);

export const IBUTAMOREN_CONTENT: LexiconContentPack = {
  slug: "ibutamoren",
  contentStatus: "COMPLETE",
  shortDescriptionDe:
    "MK-677 (Ibutamoren) ist ein nicht-peptidischer Ghrelin-Rezeptor-Agonist (GHS-R), der Wachstumshormon und IGF-1 anregen kann.",
  usesAndResearchDe:
    "Ibutamoren wurde in Humanstudien bei GH-Mangel, Sarkopenie und verwandten Kontexten untersucht. Es ist kein zugelassenes Humanarzneimittel.",
  possibleBenefitsDe:
    "In kontrollierten Humanstudien wurden Anstiege von GH/IGF-1 und Erhalt von Magermasse beschrieben. Diese Befunde gelten für die untersuchten Populationen und Endpunkte – keine allgemeine Empfehlung.",
  possibleRisksDe:
    "In Studien traten u. a. erhöhter Appetit, periphere Ödeme und veränderte Glukosewerte auf. Langzeit-Sicherheit und Nutzen sind nicht etabliert.",
  applicationFormDe:
    "In Studien oral untersucht. Im Shop als orale Darreichungsform geführt – keine Dosierungsempfehlung.",
  humanStudiesDe:
    "Mehrere Humanstudien (u. a. gesunde Probanden, GH-Mangel) liegen vor; keine Zulassung als Arzneimittel.",
  preclinicalDe:
    "Präklinische Daten zur GHS-R-Agonistik liegen vor; Humanstudien sind für die Einordnung maßgeblich.",
  studyStatusDe: "Investigational; Humanstudien vorhanden, keine Zulassung.",
  sources: [IBUTAMOREN_GH],
};

export const RESEARCH_PEPTIDE_PACKS: Record<string, LexiconContentPack> = {
  "pt-141": PT141_CONTENT,
  dsip: DSIP_CONTENT,
  epithalon: EPITHALON_CONTENT,
  ll37: LL37_CONTENT,
  "ara-290": ARA290_CONTENT,
  humanin: HUMANIN_CONTENT,
  dihexa: DIHEXA_CONTENT,
  ibutamoren: IBUTAMOREN_CONTENT,
};
