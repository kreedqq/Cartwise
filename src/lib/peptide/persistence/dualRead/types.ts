export const DUAL_READ_DIFF_STATUSES = [
  "MATCH",
  "ORDER_ONLY",
  "FORMAT_ONLY",
  "MISSING",
  "EXTRA",
  "DIFFERENT",
  "UNRESOLVED",
] as const;

export type DualReadDiffStatus = (typeof DUAL_READ_DIFF_STATUSES)[number];

export type DualReadFamily =
  | "identity"
  | "alias"
  | "category"
  | "status"
  | "effects"
  | "mechanism"
  | "safety"
  | "interactions"
  | "reconstitution"
  | "study"
  | "source"
  | "claim"
  | "evidence"
  | "regulatory"
  | "review"
  | "productMapping"
  | "search"
  | "filter"
  | "detail"
  | "hudson"
  | "community"
  | "ordering"
  | "publicVisibility";

export interface DualReadDifference {
  family: DualReadFamily;
  status: DualReadDiffStatus;
  key: string;
  legacyRef: string;
  postgresRef: string;
  note: string;
  critical: boolean;
}

export interface NormalizedIdentity {
  slug: string;
  name: string;
  displayName: string;
  aliases: string[];
  developmentNames: string[];
  category: string;
  moleculeType: string | null;
  chemicalClass: string | null;
  casNumber: string | null;
  identityNote: string | null;
  lifecycleStatus: string;
  blendComponentSlugs: string[];
}

export interface NormalizedListItem {
  slug: string;
  category: string;
  evidenceLevel: string;
  regulatoryStatus: string;
  casNumber: string | null;
}

export interface NormalizedSource {
  key: string;
  title: string;
  sourceType: string;
  doi: string | null;
  pmid: string | null;
  nctId: string | null;
  url: string;
  publisher: string | null;
  publicationDate: string | null;
  accessDate: string | null;
  legacyIds: string[];
  substanceSlugs: string[];
  reviewStatus: string;
}

export interface NormalizedSourceAttachment {
  sourceKey: string;
  substanceSlug: string;
  legacySourceId: string;
}

export interface NormalizedStudy {
  nctId: string;
  title: string;
  sponsor: string | null;
  phase: string | null;
  status: string | null;
  enrollment: number | null;
  startDate: string | null;
  completionDate: string | null;
  lastUpdated: string | null;
  hasResults: boolean;
  url: string;
  substanceSlugs: string[];
  reviewStatus: string;
}

export interface NormalizedStudyAttachment {
  nctId: string;
  substanceSlug: string;
}

export interface NormalizedClaim {
  stableKey: string;
  substanceSlug: string;
  claimType: string;
  statement: string;
  status: string;
  sourceLegacyIds: string[];
  nctIds: string[];
}

export interface NormalizedEvidence {
  stableKey: string;
  substanceSlug: string;
  evidenceLevel: string | null;
  confidence: string | null;
  evidenceType: string;
  reviewStatus: string;
  overlay: boolean;
}

export interface NormalizedRegulatory {
  stableKey: string;
  substanceSlug: string;
  authority: string;
  region: string;
  status: string;
  indication: string | null;
  productName: string | null;
  applicationId: string | null;
  isCurrent: boolean;
  legacySourceId: string;
}

export interface NormalizedReviewAction {
  entityStableKey: string;
  action: string;
  reason: string;
}

export interface NormalizedProductMap {
  code: string;
  name: string;
  slug: string | null;
}

export interface NormalizedDetail {
  slug: string;
  identity: NormalizedIdentity;
  overview: string;
  mechanism: string;
  effects: string;
  safety: string;
  interactions: string[];
  reconstitution: string | null;
  studyNcts: string[];
  sourceLegacyIds: string[];
  evidenceLevel: string | null;
  evidenceType: string | null;
  evidenceReviewStatus: string | null;
  confidence: string | null;
  regulatory: Array<{
    authority: string;
    region: string;
    status: string;
    productName: string | null;
    applicationId: string | null;
    isCurrent: boolean;
  }>;
}

export interface NormalizedResearchSnapshot {
  identities: NormalizedIdentity[];
  listItems: NormalizedListItem[];
  sources: NormalizedSource[];
  sourceAttachments: NormalizedSourceAttachment[];
  studies: NormalizedStudy[];
  studyAttachments: NormalizedStudyAttachment[];
  claims: NormalizedClaim[];
  evidence: NormalizedEvidence[];
  regulatory: NormalizedRegulatory[];
  reviewActions: NormalizedReviewAction[];
  productMaps: NormalizedProductMap[];
  details: NormalizedDetail[];
  communityReports: never[];
}

export type DualReadFallbackKind = "timeout" | "rls" | "network" | "query" | "invalid" | "partial" | null;

export interface DualReadCounts {
  MATCH: number;
  ORDER_ONLY: number;
  FORMAT_ONLY: number;
  MISSING: number;
  EXTRA: number;
  DIFFERENT: number;
  UNRESOLVED: number;
}

export type DualReadVerdict = "DUAL_READ_READY" | "DUAL_READ_NOT_READY";

export interface DualReadReport {
  mode: "legacy" | "dual" | "postgres";
  displaySource: "legacy" | "postgres";
  fallback: DualReadFallbackKind;
  fallbackMessage: string | null;
  differences: DualReadDifference[];
  counts: DualReadCounts;
  criticalCount: number;
  verdict: DualReadVerdict;
  totals: {
    substances: number;
    aliases: number;
    sourceAttachments: number;
    uniqueSources: number;
    studyAttachments: number;
    uniqueStudies: number;
    claims: number;
    evidence: number;
    overlayEvidence: number;
    reviewRequiredEvidence: number;
    regulatory: number;
    reviewActions: number;
    communityReports: number;
  };
}

export const KNOWN_UNRESOLVED_REGULATORY = ["hcg:ema-ovitrelle", "semaglutide:fda-semaglutide-27f15fac"] as const;

export const HUDSON_NCTS = ["NCT07487363", "NCT07437560"] as const;
