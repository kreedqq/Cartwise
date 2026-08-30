import type { PublicLexiconEntry } from "@/lib/peptide/lexiconV2/publicTypes";
import type { PdfResearchProfile } from "@/lib/peptide/lexiconV2/pdfResearch/types";
import { slugForPdfProfileName } from "@/lib/peptide/lexiconV2/pdfResearch/slugMap";

export function mapPdfProfileToEntry(profile: PdfResearchProfile): PublicLexiconEntry {
  const slug = slugForPdfProfileName(profile.name);
  const codes = profile.catalogVariants.map((v) => v.code);

  return {
    slug,
    displayNameDe: profile.name,
    category: profile.category,
    searchTerms: [profile.name, slug, ...codes],
    publicationStatus: "published",
    contentStatus: "COMPLETE",
    identityNote: profile.evidenceGrade === "U" ? profile.shortDescription : null,
    shortDescriptionDe: profile.shortDescription,
    usesAndResearchDe: profile.uses,
    possibleBenefitsDe: profile.benefits,
    possibleRisksDe: profile.risks,
    applicationFormDe: profile.administration,
    reconstitution: null,
    studyLandscape: {
      humanStudiesDe: "",
      preclinicalDe: "",
      studyStatusDe: profile.evidence,
    },
    community: {
      available: false,
      noticeDe:
        "Community-Berichte sind im Lexikon von der wissenschaftlichen Bewertung getrennt und erhöhen nicht die Evidenzstufe.",
      channels: [],
    },
    sources: [],
    blendComponentSlugs: [],
    pdfEvidenceGrade: profile.evidenceGrade,
    approvalStatusDe: profile.approvalStatus,
    catalogVariants: profile.catalogVariants.map((v) => ({
      code: v.code,
      displayLabel: v.displayLabel,
      status: v.status,
    })),
  };
}

export function overlayPdfProfileOnEntry(
  entry: PublicLexiconEntry,
  profile: PdfResearchProfile,
): PublicLexiconEntry {
  const mapped = mapPdfProfileToEntry(profile);
  return {
    ...entry,
    displayNameDe: mapped.displayNameDe,
    category: mapped.category,
    searchTerms: [...new Set([...entry.searchTerms, ...mapped.searchTerms])],
    publicationStatus: "published",
    contentStatus: "COMPLETE",
    shortDescriptionDe: mapped.shortDescriptionDe,
    usesAndResearchDe: mapped.usesAndResearchDe,
    possibleBenefitsDe: mapped.possibleBenefitsDe,
    possibleRisksDe: mapped.possibleRisksDe,
    applicationFormDe: mapped.applicationFormDe,
    studyLandscape: mapped.studyLandscape,
    pdfEvidenceGrade: mapped.pdfEvidenceGrade,
    approvalStatusDe: mapped.approvalStatusDe,
    catalogVariants: mapped.catalogVariants,
    identityNote: mapped.identityNote ?? entry.identityNote,
    reconstitution: entry.reconstitution ?? mapped.reconstitution,
    sources: entry.sources.length > 0 ? entry.sources : mapped.sources,
    blendComponentSlugs:
      entry.blendComponentSlugs.length > 0 ? entry.blendComponentSlugs : mapped.blendComponentSlugs,
  };
}
