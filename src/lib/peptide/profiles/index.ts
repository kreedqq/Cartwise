import published from "@/lib/peptide/profiles/published.json";
import type { PeptideSubstance } from "@/lib/peptide/types";
import type { SubstanceProfile } from "@/lib/peptide/profiles/types";
import { everyStatementCited } from "@/lib/peptide/profiles/types";

const DATA = published as { accessDate: string; profiles: Record<string, SubstanceProfile> };

export const RESEARCH_ACCESS_DATE = DATA.accessDate;

export function getPublishedProfile(slug: string): SubstanceProfile | undefined {
  return DATA.profiles[slug];
}

export function listPublishedProfiles(): SubstanceProfile[] {
  return Object.values(DATA.profiles);
}

export function applyPublishedProfile(base: PeptideSubstance): PeptideSubstance {
  const profile = DATA.profiles[base.slug];
  if (!profile) return base;
  return {
    ...base,
    casNumber: profile.identity.casNumber ?? base.casNumber,
    chemicalClass: profile.identity.chemicalClass ?? base.chemicalClass,
    moleculeType: profile.identity.moleculeType ?? base.moleculeType,
    identityNote: profile.identity.identityNote ?? base.identityNote,
    evidenceLevel: profile.evidenceLevel,
    confidenceLevel: profile.confidenceLevel,
    regulatoryStatus: profile.regulatoryStatus,
    reviewStatus: profile.reviewStatus,
    lastReviewedAt: profile.lastReviewedAt,
    lastResearchScanAt: profile.lastResearchScanAt,
    lastCommunityScanAt: profile.lastCommunityScanAt,
    description: profile.summary.whatIsIt.text,
  };
}

export function publishedSourceCount(): number {
  return listPublishedProfiles().reduce((sum, profile) => sum + profile.sources.length, 0);
}

export function allPublishedStatementsCited(): boolean {
  return listPublishedProfiles().every(everyStatementCited);
}

export function formatReviewedDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function researchReports() {
  return listPublishedProfiles().map((profile) => ({
    slug: profile.slug,
    ...profile.researchReport,
    evidenceLevel: profile.evidenceLevel,
    regulatoryStatus: profile.regulatoryStatus,
    lastResearch: profile.lastResearchScanAt,
  }));
}
