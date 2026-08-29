import type { ConfidenceLevel, EvidenceLevel, ReviewStatus } from "@/lib/peptide/types";
import type { ProfileSource } from "@/lib/peptide/profiles/types";
import type { LexiconContentStatus } from "@/lib/peptide/lexiconV2/contentEngine/types";
import type { ShopCoverageCategory } from "@/lib/peptide/shopCoverage/types";

export type LexiconPublicationStatus = "published" | "draft";

export type ReconstitutionSolventType = "bac-water" | "aa-water";

export type ReconstitutionRuleKind = "linear-mg-per-ml" | "fixed-volume";

/** Operator product rule – not individual medical dosing advice. */
export interface ReconstitutionProductRule {
  slug: string;
  solventType: ReconstitutionSolventType;
  ruleKind: ReconstitutionRuleKind;
  /** Default shop rule: 10 mg peptide → 1 ml solvent (linear). */
  mgPerMl?: number;
  /** Fixed solvent volume (GLOW, KLOW, GHK-Cu). */
  fixedVolumeMl?: number;
  disclaimerDe: string;
}

export interface ReconstitutionVialOption {
  label: string;
  amountMg: number | null;
  amountMcg: number | null;
}

export interface ReconstitutionProfileData {
  applicable: boolean;
  rule: ReconstitutionProductRule | null;
  vialOptions: ReconstitutionVialOption[];
  noteDe: string;
  calculatorDisclaimerDe: string;
}

export interface LexiconV2TextBlock {
  text: string;
  sourceIds: string[];
}

export type CommunityChannelKind = "reddit" | "forum" | "blog" | "user-report";

export interface LexiconV2CommunityChannel {
  kind: CommunityChannelKind;
  enabled: boolean;
  reports: Array<{
    id: string;
    title: string;
    sourceUrl: string | null;
    excerpt: string | null;
  }>;
}

export interface LexiconV2StudyLandscape {
  humanStudiesNoteDe: string;
  preclinicalNoteDe: string;
  studyStatusDe: string;
  sourceIds: string[];
}

/**
 * Lexikon 2.0 substance profile (data layer only – no UI).
 * Draft profiles contain identity + structure; no invented science.
 */
export interface LexiconV2Profile {
  slug: string;
  displayNameDe: string;
  category: ShopCoverageCategory;
  publicationStatus: LexiconPublicationStatus;
  contentStatus: LexiconContentStatus;
  evidenceLevel: EvidenceLevel;
  confidenceLevel: ConfidenceLevel;
  reviewStatus: ReviewStatus;
  identityNote: string | null;
  shortDescriptionDe: string;
  usesAndResearchDe: LexiconV2TextBlock;
  possibleBenefitsDe: LexiconV2TextBlock;
  possibleRisksDe: LexiconV2TextBlock;
  applicationFormDe: LexiconV2TextBlock;
  reconstitution: ReconstitutionProfileData | null;
  studyLandscapeDe: LexiconV2StudyLandscape;
  community: {
    separatedFromScience: true;
    available: boolean;
    noticeDe: string;
    channels: LexiconV2CommunityChannel[];
  };
  sources: ProfileSource[];
  blendComponentSlugs: string[];
}

export interface LexiconV2FamilyBundle {
  slug: string;
  category: ShopCoverageCategory;
  substanceLabel: string;
  shopProductNames: string[];
  vialLabels: string[];
}

export interface LexiconV2PendingFamily {
  slug: string;
  category: ShopCoverageCategory;
  status: "REVIEW_REQUIRED" | "UNKNOWN";
  reason: string;
  shopProductNames: string[];
}

export interface LexiconV2CoverageReport {
  profilesBefore: number;
  profilesAfter: number;
  newDraftProfiles: number;
  publishedProfiles: number;
  reviewRequiredFamilies: number;
  unknownFamilies: number;
  nonLexiconProducts: number;
  shopSkusBefore: { complete: number; partial: number; total: number };
  shopSkusAfter: { withProfile: number; draftOnly: number; publishedComplete: number; pending: number; total: number };
  newProfileNamesDe: string[];
}
