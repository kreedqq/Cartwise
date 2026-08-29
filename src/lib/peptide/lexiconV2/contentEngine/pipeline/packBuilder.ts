import { INSUFFICIENT_DATA_DE } from "@/lib/peptide/lexiconV2/contentEngine/constants";
import type { LexiconContentPack, LexiconContentStatus } from "@/lib/peptide/lexiconV2/contentEngine/types";
import type { ProfileSource } from "@/lib/peptide/profiles/types";
import { emaSource, fdaSource, pubmedSource } from "@/lib/peptide/lexiconV2/contentEngine/sources";

export interface SubstanceCatalogEntry {
  slug: string;
  contentStatus: LexiconContentStatus;
  displayNameDe: string;
  substanceClassDe: string;
  shortDescriptionDe: string;
  usesAndResearchDe: string;
  possibleBenefitsDe: string;
  possibleRisksDe: string;
  applicationFormDe: string;
  humanStudiesDe: string;
  preclinicalDe: string;
  studyStatusDe: string;
  sources: ProfileSource[];
  identityNote?: string;
  blendComponentSlugs?: string[];
}

export function entryToPack(entry: SubstanceCatalogEntry): LexiconContentPack {
  return {
    slug: entry.slug,
    contentStatus: entry.contentStatus,
    identityNote: entry.identityNote,
    blendComponentSlugs: entry.blendComponentSlugs,
    shortDescriptionDe: entry.shortDescriptionDe,
    usesAndResearchDe: entry.usesAndResearchDe,
    possibleBenefitsDe: entry.possibleBenefitsDe,
    possibleRisksDe: entry.possibleRisksDe,
    applicationFormDe: entry.applicationFormDe,
    humanStudiesDe: entry.humanStudiesDe,
    preclinicalDe: entry.preclinicalDe,
    studyStatusDe: entry.studyStatusDe,
    sources: entry.sources,
  };
}

const FDA_DAF = "https://www.accessdata.fda.gov/scripts/cder/daf/";

export function fdaApprovedOral(
  slug: string,
  displayNameDe: string,
  innDe: string,
  approvedUseDe: string,
  risksDe: string,
): SubstanceCatalogEntry {
  return {
    slug,
    contentStatus: "COMPLETE",
    displayNameDe,
    substanceClassDe: "orales Humanarzneimittel",
    shortDescriptionDe: `${displayNameDe} (${innDe}) ist ein etablierter Wirkstoff mit zugelassenen Humanarzneimitteln in regulierten Märkten.`,
    usesAndResearchDe: `Zugelassen bzw. in Fachinformationen beschrieben für: ${approvedUseDe}. Dieses Profil beschreibt die etablierte medizinische Einordnung – keine Empfehlung für nicht zugelassene Anwendungszwecke.`,
    possibleBenefitsDe:
      "In zugelassenen Indikationen wurden Nutzen in kontrollierten Humanstudien und postmarketing-Daten beschrieben. Eine Übertragung auf andere Zwecke ist nicht abgeleitet.",
    possibleRisksDe: risksDe,
    applicationFormDe: `${displayNameDe} ist als orale Darreichungsform im Handel etabliert. Im Shop geführte Formen beschreiben nur Katalogvarianten – keine Dosierungsempfehlung.`,
    humanStudiesDe: "Humanstudien und regulatorische Zulassungsdaten liegen für die genannten Indikationen vor.",
    preclinicalDe:
      "Präklinische Daten sind für etablierte Wirkstoffe vorhanden, werden hier aber nicht gesondert ausgewertet.",
    studyStatusDe: "Zugelassener bzw. etablierter Humanwirkstoff in den genannten Indikationen.",
    sources: [fdaSource(slug, `${displayNameDe} — FDA prescribing information`, FDA_DAF)],
  };
}

export function fdaApprovedOil(
  slug: string,
  displayNameDe: string,
  innDe: string,
  approvedUseDe: string,
  risksDe: string,
): SubstanceCatalogEntry {
  return {
    slug,
    contentStatus: "COMPLETE",
    displayNameDe,
    substanceClassDe: "injizierbare Öl-/Esterlösung",
    shortDescriptionDe: `${displayNameDe} (${innDe}) ist ein etablierter Wirkstoff mit zugelassenen injizierbaren Humanarzneimitteln in regulierten Märkten.`,
    usesAndResearchDe: `In Fachinformationen beschrieben für: ${approvedUseDe}. Dieses Profil beschreibt die etablierte medizinische Einordnung – keine Empfehlung für nicht zugelassene oder missbräuchliche Anwendungszwecke.`,
    possibleBenefitsDe:
      "In zugelassenen Indikationen wurden Nutzen in kontrollierten Humanstudien beschrieben. Eine Übertragung auf andere Zwecke ist nicht abgeleitet.",
    possibleRisksDe: risksDe,
    applicationFormDe: `${displayNameDe} wird in regulierten Märkten als intramuskuläre Öl-in-Öl-Injektion geführt. Im Shop beschreibt die Darreichungsform nur den Katalogeintrag – keine Injektionsanleitung.`,
    humanStudiesDe: "Humanstudien und regulatorische Zulassungsdaten liegen für die genannten Indikationen vor.",
    preclinicalDe:
      "Präklinische Daten sind für etablierte Wirkstoffe vorhanden, werden hier aber nicht gesondert ausgewertet.",
    studyStatusDe: "Zugelassener Humanwirkstoff in den genannten Indikationen.",
    sources: [fdaSource(slug, `${displayNameDe} — FDA prescribing information`, FDA_DAF)],
  };
}

export function researchPartial(
  slug: string,
  displayNameDe: string,
  substanceClassDe: string,
  shortDescriptionDe: string,
  usesDe: string,
  benefitsDe: string,
  risksDe: string,
  applicationDe: string,
  humanDe: string,
  preclinicalDe: string,
  studyStatusDe: string,
  sources: ProfileSource[] = [],
  identityNote?: string,
): SubstanceCatalogEntry {
  return {
    slug,
    contentStatus: "PARTIAL",
    displayNameDe,
    substanceClassDe,
    shortDescriptionDe,
    usesAndResearchDe: usesDe,
    possibleBenefitsDe: benefitsDe,
    possibleRisksDe: risksDe,
    applicationFormDe: applicationDe,
    humanStudiesDe: humanDe,
    preclinicalDe,
    studyStatusDe,
    sources,
    identityNote,
  };
}

export function researchComplete(
  slug: string,
  displayNameDe: string,
  substanceClassDe: string,
  shortDescriptionDe: string,
  usesDe: string,
  benefitsDe: string,
  risksDe: string,
  applicationDe: string,
  humanDe: string,
  preclinicalDe: string,
  studyStatusDe: string,
  sources: ProfileSource[],
  identityNote?: string,
): SubstanceCatalogEntry {
  return {
    ...researchPartial(
      slug,
      displayNameDe,
      substanceClassDe,
      shortDescriptionDe,
      usesDe,
      benefitsDe,
      risksDe,
      applicationDe,
      humanDe,
      preclinicalDe,
      studyStatusDe,
      sources,
      identityNote,
    ),
    contentStatus: "COMPLETE",
  };
}

export function blendPartialEntry(
  slug: string,
  displayNameDe: string,
  componentSlugs: string[],
  componentNamesDe: string,
  identityNote?: string,
): SubstanceCatalogEntry {
  return {
    slug,
    contentStatus: "PARTIAL",
    displayNameDe,
    substanceClassDe: "Blend-Mischung",
    blendComponentSlugs: componentSlugs,
    identityNote,
    shortDescriptionDe: `${displayNameDe} ist eine Shop-Blend-Mischung aus ${componentNamesDe}. Blends werden im Katalog als eigene Identität geführt – nicht als einheitlich untersuchter Wirkstoff.`,
    usesAndResearchDe: `Die Einzelkomponenten (${componentNamesDe}) können in der medizinischen oder Forschungsliteratur separat beschrieben sein. Für die Blend-Mischung selbst liegen keine einheitlichen Humanstudien vor. ${INSUFFICIENT_DATA_DE}`,
    possibleBenefitsDe: `Für die Blend-Mischung als Ganzes liegen keine belastbaren Humanstudien vor. Aussagen zu Einzelkomponenten dürfen nicht automatisch auf die Mischung übertragen werden. ${INSUFFICIENT_DATA_DE}`,
    possibleRisksDe: `Risiken ergeben sich potenziell aus der Kombination der Einzelkomponenten; für die spezifische Shop-Blend-Formulierung liegen keine etablierten Sicherheitsdaten vor. ${INSUFFICIENT_DATA_DE}`,
    applicationFormDe: `${displayNameDe} wird im Shop als fertige Blend-Darreichungsform geführt. Dies beschreibt nur die Katalogform – keine Anwendungsempfehlung.`,
    humanStudiesDe:
      "Keine Humanstudien zur Blend-Mischung als Ganzes identifiziert. Einzelkomponenten können separate Studienlagen haben.",
    preclinicalDe:
      "Präklinische Blend-spezifische Daten: nicht identifiziert. Einzelkomponenten können separate präklinische Literatur haben.",
    studyStatusDe: "Blend ohne einheitliche Humanstudie; Einzelkomponenten separat zu prüfen.",
    sources: [],
  };
}

export function insufficientEntry(
  slug: string,
  displayNameDe: string,
  substanceClassDe: string,
  reasonDe: string,
): SubstanceCatalogEntry {
  return {
    slug,
    contentStatus: "INSUFFICIENT_DATA",
    displayNameDe,
    substanceClassDe,
    shortDescriptionDe: `${displayNameDe} ist im Shop-Katalog als ${substanceClassDe} geführt. ${reasonDe}`,
    usesAndResearchDe: `Identität ist im Katalog dokumentiert. ${INSUFFICIENT_DATA_DE}`,
    possibleBenefitsDe: INSUFFICIENT_DATA_DE,
    possibleRisksDe: INSUFFICIENT_DATA_DE,
    applicationFormDe: `${displayNameDe} wird im Shop geführt. Dies beschreibt nur die Katalog-Darreichungsform – keine Anwendungsempfehlung.`,
    humanStudiesDe: "Humane Studienlage: nicht ausreichend dokumentiert. " + INSUFFICIENT_DATA_DE,
    preclinicalDe: "Präklinische Forschung: nicht ausreichend dokumentiert. " + INSUFFICIENT_DATA_DE,
    studyStatusDe: "Unzureichende belastbare Datenlage für eine vollständige wissenschaftliche Einordnung.",
    sources: [],
  };
}

export function pmid(
  id: string,
  title: string,
  journal: string | null = null,
  year: string | null = null,
): ProfileSource {
  return pubmedSource(id, title, journal, year);
}

export function ema(entrySlug: string, title: string, url: string): ProfileSource {
  return emaSource(entrySlug, title, url);
}
