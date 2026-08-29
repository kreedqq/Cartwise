import type { LexiconContentPack } from "@/lib/peptide/lexiconV2/contentEngine/types";
import { fdaSource } from "@/lib/peptide/lexiconV2/contentEngine/sources";

function approvedOralPack(
  slug: string,
  displayNameDe: string,
  innDe: string,
  approvedUseDe: string,
  fdaTitle: string,
  fdaUrl: string,
  risksDe: string,
): LexiconContentPack {
  const source = fdaSource(slug, fdaTitle, fdaUrl);
  return {
    slug,
    contentStatus: "COMPLETE",
    shortDescriptionDe: `${displayNameDe} (${innDe}) ist ein etablierter Wirkstoff mit zugelassenen Humanarzneimitteln in regulierten Märkten.`,
    usesAndResearchDe: `Zugelassen bzw. in Fachinformationen beschrieben für: ${approvedUseDe}. Dieses Profil beschreibt die etablierte medizinische Einordnung – keine Empfehlung für nicht zugelassene Anwendungszwecke.`,
    possibleBenefitsDe: `In zugelassenen Indikationen wurden Nutzen in kontrollierten Humanstudien und postmarketing-Daten beschrieben. Eine Übertragung auf andere Zwecke ist nicht abgeleitet.`,
    possibleRisksDe: risksDe,
    applicationFormDe: `${displayNameDe} ist als orale Darreichungsform im Handel etabliert. Im Shop geführte Formen beschreiben nur Katalogvarianten – keine Dosierungsempfehlung.`,
    humanStudiesDe: `Humanstudien und regulatorische Zulassungsdaten liegen für die genannten Indikationen vor.`,
    preclinicalDe: "Präklinische Daten sind für etablierte Wirkstoffe vorhanden, werden hier aber nicht gesondert ausgewertet.",
    studyStatusDe: "Zugelassener bzw. etablierter Humanwirkstoff in den genannten Indikationen.",
    sources: [source],
  };
}

export const FINASTERIDE_CONTENT = approvedOralPack(
  "finasteride",
  "Finasterid",
  "Finasteride",
  "benigne Prostatahyperplasie und androgenetische Alopezie (je nach Produkt)",
  "Finasteride — FDA approved drug products",
  "https://www.accessdata.fda.gov/scripts/cder/daf/",
  "In Fachinformationen werden u. a. sexuelle/nebenwirkungsbezogene Ereignisse beschrieben. Schwangere dürfen Finasterid nicht einnehmen (Teratogenitätsrisiko).",
);

export const SILDENAFIL_CONTENT = approvedOralPack(
  "sildenafil",
  "Sildenafil",
  "Sildenafil",
  "erektiler Dysfunktion und pulmonale arterielle Hypertonie (je nach Produkt)",
  "Sildenafil — FDA approved drug products",
  "https://www.accessdata.fda.gov/scripts/cder/daf/",
  "In Fachinformationen werden u. a. Kopfschmerzen, Flush, Verdauungsbeschwerden und seltene kardiovaskuläre Ereignisse beschrieben. Kontraindikationen mit Nitraten beachten.",
);

export const TADALAFIL_CONTENT = approvedOralPack(
  "tadalafil",
  "Tadalafil",
  "Tadalafil",
  "erektiler Dysfunktion, pulmonale arterielle Hypertonie und benignes Prostatahyperplasie-Syndrom (je nach Produkt)",
  "Tadalafil — FDA approved drug products",
  "https://www.accessdata.fda.gov/scripts/cder/daf/",
  "In Fachinformationen werden u. a. Kopfschmerzen, Rückenschmerzen und Flush beschrieben. Nitrat-Kontraindikationen gelten analog zu anderen PDE5-Hemmern.",
);

export const MINOXIDIL_CONTENT = approvedOralPack(
  "minoxidil",
  "Minoxidil",
  "Minoxidil",
  "Hypertonie (oral) bzw. androgenetische Alopezie (topisch, je nach Produkt)",
  "Minoxidil — FDA approved drug products",
  "https://www.accessdata.fda.gov/scripts/cder/daf/",
  "Systemisch können Flüssigkeitsretention und Tachykardie auftreten; topisch lokale Irritation. Indikation und Darreichungsform bestimmen das Risikoprofil.",
);

export const TAMOXIFEN_CONTENT = approvedOralPack(
  "tamoxifen",
  "Tamoxifen",
  "Tamoxifen",
  "Hormonrezeptor-positive Mammakarzinome (adjuvant/therapeutisch, je nach Schema)",
  "Tamoxifen — FDA approved drug products",
  "https://www.accessdata.fda.gov/scripts/cder/daf/",
  "In Fachinformationen werden u. a. thromboembolische Ereignisse, Endometriumveränderungen und menopausale Symptome beschrieben.",
);

export const LETROZOLE_CONTENT = approvedOralPack(
  "letrozole",
  "Letrozol",
  "Letrozole",
  "Hormonrezeptor-positive Mammakarzinome bei postmenopausalen Frauen",
  "Letrozole — FDA approved drug products",
  "https://www.accessdata.fda.gov/scripts/cder/daf/",
  "Aromatasehemmer – Risiken u. a. Knochendichte, muskuloskelettale Beschwerden, kardiovaskuläre Ereignisse laut Fachinformation.",
);

export const ANASTROZOLE_CONTENT = approvedOralPack(
  "anastrozole",
  "Anastrozol",
  "Anastrozole",
  "Hormonrezeptor-positive Mammakarzinome bei postmenopausalen Frauen",
  "Anastrozole — FDA approved drug products",
  "https://www.accessdata.fda.gov/scripts/cder/daf/",
  "Aromatasehemmer – Risiken u. a. Knochendichte, muskuloskelettale Beschwerden laut Fachinformation.",
);

export const EXEMESTANE_CONTENT = approvedOralPack(
  "exemestane",
  "Exemestan",
  "Exemestane",
  "Hormonrezeptor-positive Mammakarzinome nach Tamoxifen-Therapie (je nach Schema)",
  "Exemestane — FDA approved drug products",
  "https://www.accessdata.fda.gov/scripts/cder/daf/",
  "Steroidaler Aromatase-Inaktivator – Risiken u. a. Knochendichte, muskuloskelettale Beschwerden laut Fachinformation.",
);

export const DUTASTERIDE_CONTENT = approvedOralPack(
  "dutasteride",
  "Dutasterid",
  "Dutasteride",
  "benigne Prostatahyperplasie",
  "Dutasteride — FDA approved drug products",
  "https://www.accessdata.fda.gov/scripts/cder/daf/",
  "5α-Reduktasehemmer – in Fachinformationen u. a. sexuelle Funktionsstörungen; Teratogenitätsrisiko für Schwangere.",
);

export const OXANDROLONE_CONTENT = approvedOralPack(
  "oxandrolone",
  "Oxandrolon",
  "Oxandrolone",
  "Gewichtsverlust nach Operation, Trauma oder chronischer Infektion (Oxandrin, USA)",
  "Oxandrolone — FDA approved drug products",
  "https://www.accessdata.fda.gov/scripts/cder/daf/",
  "Anabolisches Steroid – Lebertoxizität, lipidverändernde Effekte und virilisierende Nebenwirkungen sind in Fachinformationen beschrieben. Missbrauch birgt erhebliche Risiken.",
);

export const IVERMECTIN_CONTENT = approvedOralPack(
  "ivermectin",
  "Ivermectin",
  "Ivermectin",
  "bestimmte parasitäre Infektionen (je nach Produkt und Region)",
  "Ivermectin — FDA approved drug products",
  "https://www.accessdata.fda.gov/scripts/cder/daf/",
  "In zugelassenen Indikationen beschriebene Nebenwirkungen u. a. gastrointestinal, neurologisch. Nicht für unzugelassene Indikationen empfohlen.",
);

export const CLOMIPHENE_CONTENT = approvedOralPack(
  "clomiphene",
  "Clomifen",
  "Clomiphene",
  "Ovulationsinduktion bei bestimmten Formen der weiblichen Unfruchtbarkeit (Clomid, USA)",
  "Clomiphene — FDA approved drug products",
  "https://www.accessdata.fda.gov/scripts/cder/daf/",
  "In Fachinformationen werden u. a. ovarielle Hyperstimulation, visuelle Störungen und Thromboembolie-Risiken beschrieben.",
);

export const CABERGOLINE_CONTENT = approvedOralPack(
  "cabergoline",
  "Cabergolin",
  "Cabergoline",
  "Hyperprolaktinämie und Parkinson-Krankheit (je nach Produkt)",
  "Cabergoline — FDA approved drug products",
  "https://www.accessdata.fda.gov/scripts/cder/daf/",
  "In Fachinformationen werden u. a. Übelkeit, Hypotonie und seltene Herzklappenveränderungen beschrieben.",
);

export const DAPOXETINE_CONTENT = approvedOralPack(
  "dapoxetine",
  "Dapoxetin",
  "Dapoxetine",
  "vorzeitiger Samenerguss (in einigen Ländern zugelassen, z. B. EU)",
  "Dapoxetine — EMA EPAR",
  "https://www.ema.europa.eu/en/medicines/human/EPAR/priligy",
  "In Fachinformationen werden u. a. Übelkeit, Schwindel und Syncope beschrieben. Nicht in allen Ländern zugelassen.",
);

export const CLENBUTEROL_CONTENT: LexiconContentPack = {
  slug: "clenbuterol",
  contentStatus: "COMPLETE",
  shortDescriptionDe:
    "Clenbuterol ist ein β2-Sympathomimetikum. In einigen Ländern ist es als Asthma-Medikament zugelassen – kein Peptid und kein anaboles Steroid.",
  usesAndResearchDe:
    "Clenbuterol ist in mehreren Ländern als Bronchodilatator für obstruktive Atemwegserkrankungen zugelassen. Außerhalb dieser Indikationen wird es in der Forschung und im Missbrauchskontext diskutiert – ohne etablierte Humantherapie für andere Zwecke.",
  possibleBenefitsDe:
    "In zugelassenen Indikationen wurde bronchodilatatorische Wirkung beschrieben. Für andere Anwendungszwecke (z. B. Körperzusammensetzung) liegen keine belastbaren Humanstudien vor.",
  possibleRisksDe:
    "In Fachinformationen werden u. a. Tachykardie, Tremor, Hypokaliämie und kardiovaskuläre Ereignisse beschrieben. Missbrauch birgt erhebliche kardiovaskuläre Risiken.",
  applicationFormDe:
    "Zugelassen als orale/tablettenartige Darreichungsform in regulierten Märkten. Im Shop geführte Formen beschreiben nur Katalogvarianten – keine Dosierungsempfehlung.",
  humanStudiesDe:
    "Humanstudien und regulatorische Daten liegen für die zugelassenen bronchodilatatorischen Indikationen vor.",
  preclinicalDe:
    "Präklinische Daten zu β2-Agonismus liegen vor; für andere Indikationen keine etablierte Humanstudienlage.",
  studyStatusDe: "Zugelassenes Bronchodilatator in einigen Märkten; andere Anwendungszwecke nicht etabliert.",
  sources: [
    fdaSource(
      "clenbuterol",
      "Clenbuterol — regulatory reference (bronchodilator in select markets)",
      "https://www.accessdata.fda.gov/scripts/cder/daf/",
    ),
  ],
};

export const T3_CONTENT = approvedOralPack(
  "t3",
  "Liothyronin (T3)",
  "Liothyronine",
  "Hypothyreose und bestimmte Schilddrüsenerkrankungen (je nach Produkt)",
  "Liothyronine — FDA approved drug products",
  "https://www.accessdata.fda.gov/scripts/cder/daf/",
  "Schilddrüsenhormon – Risiken bei Über- oder Unterdosierung u. a. kardiovaskulär, Knochenstoffwechsel. Nur unter medizinischer Indikation.",
);

export const T4_CONTENT = approvedOralPack(
  "t4",
  "Levothyroxin (T4)",
  "Levothyroxine",
  "Hypothyreose und Schilddrüsenunterfunktion",
  "Levothyroxine — FDA approved drug products",
  "https://www.accessdata.fda.gov/scripts/cder/daf/",
  "Schilddrüsenhormon – Risiken bei Über- oder Unterdosierung u. a. kardiovaskulär, Knochenstoffwechsel. Nur unter medizinischer Indikation.",
);

export const APPROVED_ORAL_PACKS: Record<string, LexiconContentPack> = {
  finasteride: FINASTERIDE_CONTENT,
  sildenafil: SILDENAFIL_CONTENT,
  tadalafil: TADALAFIL_CONTENT,
  minoxidil: MINOXIDIL_CONTENT,
  tamoxifen: TAMOXIFEN_CONTENT,
  letrozole: LETROZOLE_CONTENT,
  anastrozole: ANASTROZOLE_CONTENT,
  exemestane: EXEMESTANE_CONTENT,
  dutasteride: DUTASTERIDE_CONTENT,
  oxandrolone: OXANDROLONE_CONTENT,
  ivermectin: IVERMECTIN_CONTENT,
  clomiphene: CLOMIPHENE_CONTENT,
  cabergoline: CABERGOLINE_CONTENT,
  dapoxetine: DAPOXETINE_CONTENT,
  clenbuterol: CLENBUTEROL_CONTENT,
  t3: T3_CONTENT,
  t4: T4_CONTENT,
};
