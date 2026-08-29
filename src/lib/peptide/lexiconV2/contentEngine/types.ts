import type { ProfileSource } from "@/lib/peptide/profiles/types";
import type { ShopCoverageCategory } from "@/lib/peptide/shopCoverage/types";

export type LexiconContentStatus = "COMPLETE" | "PARTIAL" | "REVIEW_REQUIRED" | "INSUFFICIENT_DATA";

export interface LexiconContentPack {
  slug: string;
  contentStatus: LexiconContentStatus;
  identityNote?: string | null;
  blendComponentSlugs?: string[];
  shortDescriptionDe: string;
  usesAndResearchDe: string;
  possibleBenefitsDe: string;
  possibleRisksDe: string;
  applicationFormDe: string;
  humanStudiesDe: string;
  preclinicalDe: string;
  studyStatusDe: string;
  sources: ProfileSource[];
}

export interface IdentityBrief {
  shortDescriptionDe: string;
  identityNote?: string | null;
  /** Optional non-clinical context (structure/class only). */
  structureNoteDe?: string;
  blendComponentSlugs?: string[];
}

export interface LexiconContentReport {
  totalProfiles: number;
  complete: number;
  partial: number;
  reviewRequired: number;
  insufficientData: number;
  byCategory: Record<ShopCoverageCategory, number>;
  sourceCount: number;
  communityVerifiedReports: number;
  reconstitutionProfiles: number;
  profilesWithGermanDescription: number;
  profilesWithStudyLandscape: number;
  profilesWithRisks: number;
  profilesWithReconstitution: number;
  profilesWithCommunity: number;
  sourcesByType: {
    pubmed: number;
    clinicalTrial: number;
    fda: number;
    ema: number;
    other: number;
  };
}
