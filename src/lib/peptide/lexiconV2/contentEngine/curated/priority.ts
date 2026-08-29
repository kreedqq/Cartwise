import type { LexiconContentPack } from "@/lib/peptide/lexiconV2/contentEngine/types";
import { fdaSource, pubmedSource } from "@/lib/peptide/lexiconV2/contentEngine/sources";

const SS31_BARth = pubmedSource(
  "33077895",
  "A phase 2/3 randomized clinical trial followed by an open-label extension to evaluate the effectiveness of elamipretide in Barth syndrome",
  "Genet Med",
  "2021",
);

const SS31_PNAS = pubmedSource(
  "32637531",
  "Mitochondrial protein interaction landscape of SS-31",
  "Proc Natl Acad Sci U S A",
  "2020",
);

const SS31_FDA = fdaSource(
  "forzinity-elamipretide",
  "FDA Grants Accelerated Approval to Forzinity (elamipretide) for Barth Syndrome",
  "https://www.fda.gov/news-events/press-announcements/fda-grants-accelerated-approval-first-treatment-barth-syndrome",
);

export const SS31_CONTENT: LexiconContentPack = {
  slug: "ss-31",
  contentStatus: "COMPLETE",
  shortDescriptionDe:
    "SS-31 (Elamipretid) ist ein synthetisches, mitochondrien-zielendes Tetrapeptid. In der Fachliteratur wird es u. a. als Elamipretide bezeichnet; es interagiert mit Cardiolipin in der inneren mitochondrialen Membran.",
  usesAndResearchDe:
    "Elamipretide wurde in klinischen Studien u. a. bei mitochondrialen Erkrankungen, Barth-Syndrom und primärer mitochondrialer Myopathie untersucht. Die Forschung fokussiert auf die Verbesserung mitochondrialer Bioenergetik – nicht auf allgemeine Leistungs- oder Lifestyle-Anwendungen.",
  possibleBenefitsDe:
    "In einer randomisierten, placebokontrollierten Studie beim Barth-Syndrom wurden Effekte auf Belastbarkeit und Symptomskalen untersucht; die Ergebnisse sind kontext- und endpunktabhängig. Die FDA erteilte 2025 eine beschleunigte Zulassung für Forzinity (Elamipretid) beim Barth-Syndrom auf Basis einer Muskelkraft-Messung am Knie – nicht als allgemeiner Nutzen für andere Indikationen.",
  possibleRisksDe:
    "In klinischen Studien wurden u. a. Reaktionen an der Injektionsstelle berichtet. Für nicht zugelassene Anwendungszwecke liegen keine etablierten Fachinformationen vor. Die Datenlage reicht nicht aus, um Wirksamkeit oder Sicherheit außerhalb der geprüften Indikationen zu beurteilen.",
  applicationFormDe:
    "In zugelassenen und klinischen Kontexten wurde Elamipretid als subkutane Injektion untersucht. Im Shop wird SS-31 als lyophilisiertes Peptid geführt – dies beschreibt nur die Katalog-Darreichungsform, keine Anwendungsempfehlung.",
  humanStudiesDe:
    "Humane randomisierte kontrollierte Studien (RCT) liegen u. a. zum Barth-Syndrom vor. Primäre Endpunkte wie Gehstrecke oder Fatigue-Scores waren in der randomisierten Phase nicht durchgängig statistisch positiv; in offenen Verlängerungen wurden teils Veränderungen beschrieben.",
  preclinicalDe:
    "Präklinische Arbeiten beschreiben die Bindung an Cardiolipin und Effekte auf mitochondriale Proteinkomplexe. Diese Befunde begründen keine automatische Übertragbarkeit auf den Menschen.",
  studyStatusDe:
    "Mehrere klinische Programme (u. a. Barth-Syndrom, mitochondriale Myopathie). Zulassung (beschleunigt) in den USA für Forzinity beim Barth-Syndrom – andere Indikationen bleiben investigational.",
  sources: [SS31_BARth, SS31_PNAS, SS31_FDA],
};

const ADIPOTIDE_2004 = pubmedSource(
  "15133506",
  "Reversal of obesity by targeted ablation of adipose tissue",
  "Nat Med",
  "2004",
);

const ADIPOTIDE_PRIMATE = pubmedSource(
  "21273446",
  "An adipose tissue vascular endothelial cell marker that is induced by obesity and targeted by adipotide",
  "Sci Transl Med",
  "2011",
);

export const ADIPOTIDE_CONTENT: LexiconContentPack = {
  slug: "adipotide",
  contentStatus: "COMPLETE",
  shortDescriptionDe:
    "Adipotide (FTPP) ist ein synthetisches chimäres Peptid aus einer Wirkstoffziel-Sequenz (CKGGRAKDC) und einem pro-apoptotischen Domäne-Peptid. Es wurde in der Forschung entwickelt, um die Gefäßversorgung von weißem Fettgewebe anzugreifen.",
  usesAndResearchDe:
    "Adipotide wurde in präklinischen Modellen der Adipositas und in einem Onkologie-Kontext untersucht. Es gibt keine etablierte zugelassene Humantherapie zur Gewichtsreduktion.",
  possibleBenefitsDe:
    "In präklinischen Studien an adipösen Mäusen wurden Gewichts- und Fettmasse-Reduktionen beschrieben. In Rhesusaffen zeigte eine Studie etwa 11 % Gewichtsverlust über vier Wochen – dies sind Modellbefunde, keine Humanwirksamkeit.",
  possibleRisksDe:
    "In Primatenmodellen wurde eine dosisabhängige Nephrotoxizität beschrieben, vermutlich durch Prohibin-Expression in der Niere. Humanstudien zur Adipositas wurden nicht etabliert; die klinische Entwicklung für diesen Zweck wurde nicht fortgesetzt.",
  applicationFormDe:
    "In der Forschung wurde Adipotide subkutan untersucht. Im Shop wird es als lyophilisiertes Peptid geführt – keine Anwendungsempfehlung.",
  humanStudiesDe:
    "Es liegen keine veröffentlichten, belastbaren Humanstudien zur Adipositas-Indikation vor. Die Datenlage reicht nicht aus, um Nutzen oder Risiken beim Menschen zuverlässig einzuschätzen.",
  preclinicalDe:
    "Mehrere präklinische Arbeiten (Maus, teils Primaten) beschreiben Fettgewebs- und Stoffwechseleffekte sowie renale Nebenwirkungen. Diese Befunde dürfen nicht als Humanwirksamkeit interpretiert werden.",
  studyStatusDe: "Präklinische Forschung; keine zugelassene Humantherapie zur Gewichtsreduktion.",
  sources: [ADIPOTIDE_2004, ADIPOTIDE_PRIMATE],
};

const AMQ_PRIMARY = pubmedSource(
  "29155147",
  "Selective and membrane-permeable small molecule inhibitors of nicotinamide N-methyltransferase reverse high fat diet-induced obesity in mice",
  "Biochem Pharmacol",
  "2018",
);

export const AMINO_1MQ_CONTENT: LexiconContentPack = {
  slug: "5-amino-1mq",
  contentStatus: "COMPLETE",
  shortDescriptionDe:
    "5-Amino-1MQ (5-Amino-1-methylchinolinium) ist ein kleines Molekül und kein Peptid. Es wirkt als selektiver Inhibitor der Enzym-Nicotinamid-N-Methyltransferase (NNMT).",
  usesAndResearchDe:
    "In der Forschung wurde 5-Amino-1MQ im Kontext von Adipositas und Stoffwechsel untersucht, primär als NNMT-Inhibitor. Es gibt keine zugelassene Humantherapie und keine etablierte klinische Studienlage für diese Substanz.",
  possibleBenefitsDe:
    "In einer präklinischen Mausstudie wurden unter Hochfett-Diät reduzierte Körpergewichte und weiße Fettmasse beschrieben – ohne messbare Änderung der Futteraufnahme. Diese Befunde belegen keinen Nutzen beim Menschen.",
  possibleRisksDe:
    "Für den Human-Gebrauch liegen keine belastbaren Sicherheitsdaten vor. Die FDA führt 5-Amino-1MQ nicht als zulässigen Bulk-Stoff für compounding. Die Datenlage reicht nicht aus, um Risiken beim Menschen zuverlässig zu beurteilen.",
  applicationFormDe:
    "In präklinischen Studien wurde 5-Amino-1MQ u. a. subkutan untersucht; im Shop als oral/tablettenartige Darreichungsform geführt – keine Dosierungsempfehlung.",
  humanStudiesDe:
    "Es liegen keine veröffentlichten Humanstudien mit belastbarer Wirksamkeits- oder Sicherheitsbewertung vor. Die aktuelle Datenlage reicht nicht aus, um Humanwirksamkeit zu beurteilen.",
  preclinicalDe:
    "Präklinische Arbeiten beschreiben NNMT-Hemmung, veränderte NAD+-Verhältnisse und Effekte auf Adipozyten und Fettmasse bei Mäusen. Tierstudien begründen keine Humanwirksamkeit.",
  studyStatusDe: "Überwiegend präklinische Daten; keine zugelassene Humantherapie.",
  sources: [AMQ_PRIMARY],
};

export const PRIORITY_CURATED_PACKS: Record<string, LexiconContentPack> = {
  "ss-31": SS31_CONTENT,
  adipotide: ADIPOTIDE_CONTENT,
  "5-amino-1mq": AMINO_1MQ_CONTENT,
};
