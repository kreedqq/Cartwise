import type { ConfidenceLevel, EvidenceLevel, RegulatoryStatus, ReviewStatus, SourceType } from "@/lib/peptide/types";

export interface CitedText {
  text: string;
  sourceIds: string[];
}

export interface ProfileSource {
  id: string;
  title: string;
  url: string;
  publisher: string | null;
  publicationDate: string | null;
  accessDate: string;
  doi: string | null;
  pmid: string | null;
  clinicalTrialId: string | null;
  sourceType: SourceType;
  sourceQuality: 1 | 2 | 3 | 4 | 5;
}

export interface ProfileStudy {
  id: string;
  clinicalTrialId: string;
  title: string;
  phase: string | null;
  status: string | null;
  sponsor: string | null;
  enrollment: number | null;
  startDate: string | null;
  completionDate: string | null;
  lastUpdated: string | null;
  hasResults: boolean;
  url: string;
}

export interface ConnectorAudit {
  id: string;
  status: "checked" | "unavailable" | "not-found";
  note: string;
}

export interface SubstanceProfile {
  slug: string;
  publicationStatus: "published";
  lastReviewedAt: string;
  lastResearchScanAt: string;
  lastCommunityScanAt: string | null;
  evidenceLevel: EvidenceLevel;
  confidenceLevel: ConfidenceLevel;
  regulatoryStatus: RegulatoryStatus;
  reviewStatus: ReviewStatus;
  identity: {
    verified: boolean;
    casNumber: string | null;
    chemicalClass: string | null;
    moleculeType: string | null;
    identityNote: string | null;
  };
  connectors: ConnectorAudit[];
  summary: {
    whatIsIt: CitedText;
    mechanism: CitedText;
    whatHasBeenStudied: CitedText;
    humanEvidence: CitedText;
    preclinicalEvidence: CitedText;
    safety: CitedText;
    currentResearch: CitedText;
    unknowns: CitedText;
  };
  pharmacology: Array<{ field: string; value: string; sourceIds: string[] }>;
  safetyItems: Array<{
    domain: "human" | "animal" | "in-vitro" | "theoretical";
    severity: "common" | "serious" | "warning" | "unknown";
    text: string;
    sourceIds: string[];
  }>;
  interactions: Array<{ category: "established" | "potential" | "theoretical" | "unknown"; text: string; sourceIds: string[] }>;
  reconstitution: CitedText | null;
  studies: ProfileStudy[];
  /** Claim-linked citations only. Never treat as automatic evidence A–F. */
  sources: ProfileSource[];
  /**
   * Approved substance-attached sources that are not claim_sources.
   * Traceability only. Must not appear as claim citations or raise evidence.
   */
  sourceReferences?: ProfileSource[];
  conflicts: Array<{ topic: string; note: string; sourceIds: string[] }>;
  reviewItems: Array<{
    id: string;
    priority: "High" | "Medium" | "Low";
    topic: string;
    note: string;
    sourceIds: string[];
  }>;
  regulatoryRegions: string[];
  community: {
    available: boolean;
    message: string;
    reports?: Array<{ id: string; kind: string; title: string; sourceUrl: string | null }>;
  };
  researchReport: {
    identity: string;
    fda: string;
    ema: string;
    clinicalTrials: number;
    pubmed: number;
    scientific: number;
    community: string;
    conflicts: number;
  };
}

export function everyStatementCited(profile: SubstanceProfile): boolean {
  const ids = new Set(profile.sources.map((s) => s.id));
  const blocks: CitedText[] = [
    ...Object.values(profile.summary),
    ...(profile.reconstitution ? [profile.reconstitution] : []),
  ];
  for (const item of profile.pharmacology) {
    if (item.sourceIds.length === 0 || item.sourceIds.some((id) => !ids.has(id))) return false;
  }
  for (const item of profile.safetyItems) {
    if (item.sourceIds.length === 0 || item.sourceIds.some((id) => !ids.has(id))) return false;
  }
  for (const item of profile.interactions) {
    if (item.sourceIds.length === 0 || item.sourceIds.some((id) => !ids.has(id))) return false;
  }
  for (const block of blocks) {
    if (block.sourceIds.length === 0 || block.sourceIds.some((id) => !ids.has(id))) return false;
  }
  for (const item of profile.reviewItems ?? []) {
    if (item.sourceIds.length === 0 || item.sourceIds.some((id) => !ids.has(id))) return false;
  }
  return true;
}
