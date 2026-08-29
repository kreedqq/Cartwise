import { getSubstanceBySlug } from "@/lib/peptide/catalog";
import { catalogNamesForSlug } from "@/lib/peptide/shopCoverage/names";
import type { PublicLexiconEntry } from "@/lib/peptide/lexiconV2/publicTypes";
import { buildReconstitutionProfile } from "@/lib/peptide/lexiconV2/reconstitution";
import type { ShopCoverageCategory } from "@/lib/peptide/shopCoverage/types";
import { publishedContentStatus } from "@/lib/peptide/lexiconV2/contentEngine/applyContent";
import { germanDisplayNameForSlug } from "@/lib/peptide/lexiconV2/germanNames";
import type { SubstanceProfile } from "@/lib/peptide/profiles/types";

function studyStatusDe(profile: SubstanceProfile): string {
  if (profile.studies.length === 0) {
    return "Keine kuratierten Studieneinträge in diesem Profil.";
  }
  const phases = [...new Set(profile.studies.map((study) => study.phase).filter(Boolean))];
  const statuses = [...new Set(profile.studies.map((study) => study.status).filter(Boolean))];
  return `${profile.studies.length} registrierte Studien${phases.length ? ` · Phasen: ${phases.join(", ")}` : ""}${statuses.length ? ` · Status: ${statuses.slice(0, 3).join(", ")}` : ""}.`;
}

function applicationFormDe(category: ShopCoverageCategory, displayName: string): string {
  switch (category) {
    case "PEPTIDES":
      return `${displayName} wird im Forschungskontext als Peptid betrachtet. Darreichungsformen in Studien können variieren; dieses Profil ersetzt keine Fachinformation.`;
    case "ORALS":
      return `${displayName} wird in der Forschung u. a. im oralen Kontext diskutiert. Keine Anwendungsempfehlung.`;
    case "OILS / INJECTABLES":
      return `${displayName} wird im Kontext injizierbarer bzw. öliger Darreichungsformen diskutiert. Keine Anwendungsempfehlung.`;
    case "BLENDS":
      return `${displayName} ist eine Mischung mehrerer Wirkstoffe. Blend-Identität und Einzelkomponenten bleiben getrennt dokumentiert.`;
    default:
      return `${displayName} – Darreichungsform nur soweit in den Quellen beschrieben. Keine Anwendungsempfehlung.`;
  }
}

export function mapPublishedProfileToEntry(
  profile: SubstanceProfile,
  category: ShopCoverageCategory,
  vialLabels: string[] = [],
): PublicLexiconEntry {
  const substance = getSubstanceBySlug(profile.slug);
  const displayNameDe = germanDisplayNameForSlug(profile.slug, substance?.displayName ?? profile.slug);
  const aliases = [
    ...(substance?.aliases ?? []),
    ...(substance?.developmentNames ?? []),
    ...catalogNamesForSlug(profile.slug),
    substance?.name ?? "",
  ].filter(Boolean);

  const safetyLines = profile.safetyItems.map((item) => `${item.domain}: ${item.text}`).join(" ");
  const risks = [profile.summary.safety.text, safetyLines].filter(Boolean).join(" ");

  const reconstitutionFromProfile = buildReconstitutionProfile(profile.slug, category, vialLabels);
  if (reconstitutionFromProfile && profile.reconstitution?.text) {
    reconstitutionFromProfile.noteDe = profile.reconstitution.text;
  }

  return {
    slug: profile.slug,
    displayNameDe,
    category,
    searchTerms: [displayNameDe, profile.slug, ...aliases],
    publicationStatus: "published",
    contentStatus: publishedContentStatus(),
    identityNote: profile.identity.identityNote ?? substance?.identityNote ?? null,
    shortDescriptionDe: profile.summary.whatIsIt.text,
    usesAndResearchDe: profile.summary.whatHasBeenStudied.text,
    possibleBenefitsDe: profile.summary.humanEvidence.text,
    possibleRisksDe: risks || "Sicherheitsinformationen sind in den Quellen am Ende dieses Profils zusammengefasst.",
    applicationFormDe: applicationFormDe(category, displayNameDe),
    reconstitution: reconstitutionFromProfile,
    studyLandscape: {
      humanStudiesDe: profile.summary.humanEvidence.text,
      preclinicalDe: profile.summary.preclinicalEvidence.text,
      studyStatusDe: studyStatusDe(profile),
    },
    community: {
      available: profile.community.available,
      noticeDe: profile.community.message,
      channels: [
        { kind: "reddit", enabled: false, reports: [] },
        { kind: "forum", enabled: false, reports: [] },
        { kind: "blog", enabled: false, reports: [] },
        {
          kind: "user-report",
          enabled: (profile.community.reports ?? []).length > 0,
          reports: (profile.community.reports ?? []).map((report) => ({
            id: report.id,
            title: report.title,
            sourceUrl: report.sourceUrl,
            excerpt: null,
          })),
        },
      ],
    },
    sources: [...profile.sources, ...(profile.sourceReferences ?? [])],
    blendComponentSlugs: substance?.blendComponentSlugs ?? [],
  };
}
