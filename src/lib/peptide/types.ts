export const PEPTIDE_CATEGORIES = [
  "peptides",
  "glp-metabolic",
  "growth-hormone",
  "recovery",
  "longevity",
  "cognitive",
  "cosmetic",
  "immune",
  "hormones",
  "biologics",
  "sarms",
  "anabolic-steroids",
  "orals",
  "injectables-oils",
  "research-compounds",
] as const;

export type PeptideCategory = (typeof PEPTIDE_CATEGORIES)[number];

export const EVIDENCE_LEVELS = ["A", "B", "C", "D", "E", "F"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const CONFIDENCE_LEVELS = ["high", "moderate", "low", "insufficient"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const REGULATORY_STATUSES = [
  "approved",
  "approved-specific",
  "clinical-development",
  "investigational",
  "not-approved",
  "insufficient",
  "unknown",
] as const;
export type RegulatoryStatus = (typeof REGULATORY_STATUSES)[number];

export const SOURCE_TYPES = [
  "regulatory",
  "clinical_trial",
  "pubmed",
  "journal",
  "review",
  "meta_analysis",
  "manufacturer",
  "scientific",
  "blog",
  "reddit",
  "forum",
  "community",
  "news",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const COMMUNITY_SOURCE_TYPES: readonly SourceType[] = ["blog", "reddit", "forum", "community"];

export type CommunityClassification = "anecdotal" | "repeated-anecdotal" | "mixed-anecdotal" | "unverified";

export type ReviewStatus = "fresh" | "recently-updated" | "review-recommended" | "review-required" | "incomplete";

export type ConnectorHealth = "healthy" | "degraded" | "unavailable" | "rate-limited";

export interface PeptideSubstance {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  aliases: string[];
  developmentNames: string[];
  casNumber: string | null;
  category: PeptideCategory;
  subcategory: string | null;
  moleculeType: string | null;
  chemicalClass: string | null;
  description: string;
  identityNote: string | null;
  blendComponentSlugs: string[];
  evidenceLevel: EvidenceLevel;
  confidenceLevel: ConfidenceLevel;
  regulatoryStatus: RegulatoryStatus;
  reviewStatus: ReviewStatus;
  lastReviewedAt: string | null;
  lastResearchScanAt: string | null;
  lastCommunityScanAt: string | null;
}

export interface PeptideProductRef {
  code: string;
  name: string;
  strengthLabel: string | null;
  substanceSlug: string;
  blend: boolean;
}

export interface PeptideSource {
  id: string;
  title: string;
  url: string;
  sourceType: SourceType;
  publisher: string | null;
  doi: string | null;
  pmid: string | null;
  clinicalTrialId: string | null;
  relatedSubstanceId: string | null;
  status: "draft" | "approved" | "rejected";
}

export function isCommunitySource(type: SourceType): boolean {
  return COMMUNITY_SOURCE_TYPES.includes(type);
}

export function communityCannotRaiseEvidence(_sourceType: SourceType, current: EvidenceLevel): EvidenceLevel {
  return current;
}

export interface PeptideStudy {
  id: string;
  substanceId: string;
  clinicalTrialId: string | null;
  title: string;
  studyType: string | null;
  phase: string | null;
  status: string | null;
  lastUpdated: string | null;
}

export interface CommunityReport {
  id: string;
  substanceId: string;
  platform: string;
  title: string;
  url: string;
  summary: string;
  classification: CommunityClassification;
  status: "draft" | "approved" | "rejected";
}

export interface ResearchUpdate {
  id: string;
  substanceId: string;
  updateType: string;
  detectedAt: string;
  summary: string;
  importance: "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR";
  status: "detected" | "draft" | "review" | "approved" | "published" | "rejected";
}
