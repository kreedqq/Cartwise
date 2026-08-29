import { germanDisplayNameForSlug } from "@/lib/peptide/lexiconV2/germanNames";

import { buildReconstitutionProfile } from "@/lib/peptide/lexiconV2/reconstitution";

import { enrichDraftProfileWithContent } from "@/lib/peptide/lexiconV2/contentEngine/applyContent";

import type { LexiconV2FamilyBundle, LexiconV2Profile } from "@/lib/peptide/lexiconV2/types";

import type { ShopCoverageCategory } from "@/lib/peptide/shopCoverage/types";



function applicationFormDe(category: ShopCoverageCategory, displayName: string): string {

  switch (category) {

    case "PEPTIDES":

      return `${displayName} wird im Shop typischerweise als lyophilisiertes Peptid zur Rekonstitution geführt. Diese Angabe beschreibt nur die Darreichungsform im Katalog – keine Anwendungs- oder Dosierungsempfehlung.`;

    case "ORALS":

      return `${displayName} wird im Shop als orale Darreichungsform (Tabletten/Kapseln) geführt. Keine Dosierungsempfehlung.`;

    case "OILS / INJECTABLES":

      return `${displayName} wird im Shop als injizierbare Öl-/Esterlösung geführt. Keine Anwendungsempfehlung und keine Injektionsanleitung.`;

    case "BLENDS":

      return `${displayName} ist eine im Shop geführte Mischung (Blend). Einzelkomponenten und Blend-Identität sind getrennt dokumentiert; der Blend selbst wurde nicht automatisch als einheitlicher Humanstudien-Gegenstand behandelt.`;

    case "HILFSSTOFFE":

      return `${displayName} ist ein Hilfsstoff (z. B. Rekonstitutionsflüssigkeit), kein Wirkstoffprofil.`;

    default:

      return `${displayName} ist im Shop unter Sonstige geführt. Darreichungsform und Identität sind katalogbasiert – keine medizinische Einordnung.`;

  }

}



export function buildDraftLexiconProfile(family: LexiconV2FamilyBundle): LexiconV2Profile {

  const displayNameDe = germanDisplayNameForSlug(family.slug, family.substanceLabel);



  const skeleton: LexiconV2Profile = {

    slug: family.slug,

    displayNameDe,

    category: family.category,

    publicationStatus: "draft",

    contentStatus: "INSUFFICIENT_DATA",

    evidenceLevel: "F",

    confidenceLevel: "insufficient",

    reviewStatus: "incomplete",

    identityNote: null,

    shortDescriptionDe: displayNameDe,

    usesAndResearchDe: { text: "", sourceIds: [] },

    possibleBenefitsDe: { text: "", sourceIds: [] },

    possibleRisksDe: { text: "", sourceIds: [] },

    applicationFormDe: {

      text: applicationFormDe(family.category, displayNameDe),

      sourceIds: [],

    },

    reconstitution: buildReconstitutionProfile(family.slug, family.category, family.vialLabels),

    studyLandscapeDe: {
      humanStudiesNoteDe: "",
      preclinicalNoteDe: "",
      studyStatusDe: "",
      sourceIds: [],
    },

    community: {

      separatedFromScience: true,

      available: false,

      noticeDe: "",

      channels: [],

    },

    sources: [],

    blendComponentSlugs: [],

  };



  return enrichDraftProfileWithContent(skeleton, family);

}


