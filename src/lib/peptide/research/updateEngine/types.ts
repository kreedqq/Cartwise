/**
 * Research Update Engine contract. Connectors never decide public approval.
 * Community never raises scientific evidence.
 */

export const UPDATE_ENGINE_CRON_ENABLED = false;

export const SCIENTIFIC_CONNECTOR_IDS = [
  "pubmed",
  "clinicaltrials",
  "fda",
  "ema",
  "bfarm",
  "mhra",
  "nmpa",
] as const;

export const COMMUNITY_CONNECTOR_IDS = ["reddit", "forum", "blog", "user-report"] as const;

export type ScientificConnectorId = (typeof SCIENTIFIC_CONNECTOR_IDS)[number];
export type CommunityConnectorId = (typeof COMMUNITY_CONNECTOR_IDS)[number];
export type UpdateConnectorId = ScientificConnectorId | CommunityConnectorId;

export type ConnectorKind = "scientific" | "community";
export type ConnectorAvailability = "available" | "unavailable";

export type ResearchRunStatus = "queued" | "running" | "completed" | "partial" | "failed" | "cancelled";
export type ResearchRunTrigger = "manual" | "scheduled" | "single-substance" | "single-connector" | "full";
export type ScheduleKind = "manual" | "daily" | "weekly" | "monthly";

export type ChangeDisposition =
  | "NEW"
  | "UPDATED"
  | "UNCHANGED"
  | "DUPLICATE"
  | "REVIEW_REQUIRED"
  | "REJECTED";

export type RetrievalStatus = "ok" | "error" | "unavailable" | "excluded";

export interface ConnectorSourceRecord {
  sourceType: "pubmed" | "clinical_trial" | "regulatory" | "fda" | "ema";
  identifier: string;
  title: string;
  url: string;
  publisher: string | null;
  publicationDate: string | null;
  substanceCandidate: string | null;
  rawMetadata: Record<string, unknown>;
  retrievedAt: string;
  connector: ScientificConnectorId;
  pmid: string | null;
  doi: string | null;
  nctId: string | null;
  authors: string | null;
  study?: {
    nctId: string;
    title: string;
    sponsor: string | null;
    intervention: string | null;
    condition: string | null;
    phase: string | null;
    status: string | null;
    startDate: string | null;
    completionDate: string | null;
  } | null;
  regulatory?: {
    authority: "fda" | "ema" | "bfarm" | "mhra" | "nmpa";
    region: string;
    productName: string | null;
    indication: string | null;
    status: string | null;
    applicationId: string | null;
    effectiveDate: string | null;
  } | null;
}

export interface ExistingSourceRow {
  id?: string;
  pmid: string | null;
  doi: string | null;
  nctId: string | null;
  title: string;
  publicationDate: string | null;
  url: string;
  slug?: string | null;
  legacyIds?: string[];
  reviewStatus?: string | null;
}

export interface ExistingStudyRow {
  id?: string;
  nctId: string;
  title: string;
  status: string | null;
  slug?: string | null;
  reviewStatus?: string | null;
}

export interface SubstanceIdentityRow {
  slug: string;
  name: string;
  aliases: string[];
  developmentNames: string[];
  casNumber: string | null;
  moleculeType: string | null;
  blendComponentSlugs?: string[];
}

export interface ConnectorSearchResult {
  ok: boolean;
  availability: ConnectorAvailability;
  records: ConnectorSourceRecord[];
  error?: string;
}

export interface UpdateEngineConnector {
  id: UpdateConnectorId;
  label: string;
  kind: ConnectorKind;
  availability: ConnectorAvailability;
  cannotRaiseEvidence: boolean;
  search(input: {
    substance: SubstanceIdentityRow;
    now: string;
  }): Promise<ConnectorSearchResult>;
  normalize(raw: unknown, context: { slug: string; now: string }): ConnectorSourceRecord | null;
  validate(record: ConnectorSourceRecord): { ok: boolean; message?: string };
}

export interface ResearchRunScope {
  trigger: ResearchRunTrigger;
  substanceSlugs: string[];
  connectors: ScientificConnectorId[];
}

export interface ResearchRunStatistics {
  substancesChecked: number;
  connectorsExecuted: number;
  sourcesQueried: number;
  sourcesNew: number;
  sourcesUpdated: number;
  sourcesUnchanged: number;
  sourcesDuplicate: number;
  sourcesRejected: number;
  studiesNew: number;
  studiesUpdated: number;
  studiesUnchanged: number;
  studiesDuplicate: number;
  reviewRequired: number;
  errors: number;
}

export interface ReviewCandidate {
  kind: "source" | "study" | "regulatory";
  disposition: ChangeDisposition;
  reviewStatus: "review-required";
  slug: string;
  record: ConnectorSourceRecord;
  previous?: { title: string; publicationDate: string | null; status?: string | null };
  reason: string;
  matchConfidence: "exact" | "alias" | "uncertain";
}

export interface ResearchRunLog {
  connector: UpdateConnectorId;
  slug: string;
  identifier: string | null;
  retrievalStatus: RetrievalStatus;
  retrievedAt: string;
  error: string | null;
}

export interface ResearchRunResult {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: ResearchRunStatus;
  trigger: ResearchRunTrigger;
  scope: ResearchRunScope;
  statistics: ResearchRunStatistics;
  candidates: ReviewCandidate[];
  logs: ResearchRunLog[];
  claimsAdded: 0;
  evidenceUpgraded: 0;
  regulatoryAutoApproved: 0;
  productionWrite: false;
  cronEnabled: false;
}

export const EMPTY_STATISTICS: ResearchRunStatistics = {
  substancesChecked: 0,
  connectorsExecuted: 0,
  sourcesQueried: 0,
  sourcesNew: 0,
  sourcesUpdated: 0,
  sourcesUnchanged: 0,
  sourcesDuplicate: 0,
  sourcesRejected: 0,
  studiesNew: 0,
  studiesUpdated: 0,
  studiesUnchanged: 0,
  studiesDuplicate: 0,
  reviewRequired: 0,
  errors: 0,
};
