import type { AdminReviewAction } from "@/lib/peptide/adminResearch/workflow";
import type {
  ChangeDisposition,
  ResearchRunScope,
  ResearchRunStatistics,
  ResearchRunStatus,
  ResearchRunTrigger,
  RetrievalStatus,
  ScientificConnectorId,
} from "@/lib/peptide/research/updateEngine/types";

export const OPERATIONS_PRODUCTION_WRITE = false;
export const OPERATIONS_CRON_ENABLED = false;
export const OPERATIONS_MIGRATION_REQUIRED = "0031_research_operations.sql";
export const OPERATIONS_RUN_PAGE_SIZE = 20;

export type OperationsAction =
  | "update-all"
  | "update-substance"
  | "update-connector"
  | "update-combined"
  | "update-category";

export interface OperationsSource {
  id: string;
  sourceType: string;
  title: string;
  publisher: string | null;
  publicationDate: string | null;
  url: string;
  doi: string | null;
  pmid: string | null;
  nctId: string | null;
  status: "active" | "superseded" | "unavailable" | "rejected";
  reviewStatus: "draft" | "review-required" | "approved" | "rejected";
  connector: string | null;
  previousTitle?: string | null;
  previousPublicationDate?: string | null;
}

export interface OperationsStudy {
  id: string;
  nctId: string;
  title: string;
  status: string | null;
  sponsor: string | null;
  phase: string | null;
  reviewStatus: "draft" | "review-required" | "approved" | "rejected";
  previousTitle?: string | null;
  previousStatus?: string | null;
}

export interface OperationsRunRecord {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: ResearchRunStatus;
  trigger: ResearchRunTrigger;
  scope: ResearchRunScope;
  statistics: ResearchRunStatistics;
  errorSummary: string | null;
  parentRunId: string | null;
  cancelRequested: boolean;
  progress: {
    connector: string | null;
    substance: string | null;
  };
  reviewCandidates: number;
}

export interface OperationsRunLog {
  runId: string;
  sourceId: string | null;
  connector: string;
  identifier: string | null;
  substanceSlug: string;
  retrievalStatus: RetrievalStatus;
  resultType: ChangeDisposition | null;
  retrievedAt: string;
  error: string | null;
  previousFields: { title: string; publicationDate: string | null; status?: string | null } | null;
  currentFields: { title: string; publicationDate: string | null; status?: string | null } | null;
}

export interface OperationsReviewAction {
  id: string;
  adminUserId: string | null;
  entityType: "source" | "study" | "community_report";
  entityId: string;
  action: AdminReviewAction;
  previousStatus: string | null;
  newStatus: string;
  reason: string;
  createdAt: string;
}

export interface OperationsCommunityReport {
  id: string;
  substanceSlug: string;
  kind: "reddit" | "forum" | "blog" | "user-report";
  title: string;
  contentSummary: string | null;
  sourceUrl: string | null;
  authorIdentifier: string | null;
  reviewStatus: "draft" | "review-required" | "approved" | "rejected";
}

export interface ConnectorHealthRow {
  connector: ScientificConnectorId | "reddit" | "forum" | "blog" | "user-report";
  kind: "scientific" | "community";
  availability: "available" | "unavailable";
  lastSuccessfulRunId: string | null;
  lastError: string | null;
  lastCheckedAt: string | null;
}

export interface FrozenInventory {
  claims: 294;
  evidence: 294;
  evidenceReviewRequired: 267;
  evidenceApproved: 27;
  regulatory: 41;
}

export interface OperationsStore {
  runs: OperationsRunRecord[];
  logs: OperationsRunLog[];
  sources: OperationsSource[];
  studies: OperationsStudy[];
  sourceSubstances: Array<{ sourceId: string; slug: string }>;
  studySubstances: Array<{ studyId: string; slug: string }>;
  reviewActions: OperationsReviewAction[];
  communityReports: OperationsCommunityReport[];
  connectorHealth: ConnectorHealthRow[];
  inventory: FrozenInventory;
  controls: Map<string, { cancelled: boolean }>;
}
