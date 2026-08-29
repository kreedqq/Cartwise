export type {
  ChangeDisposition,
  ConnectorSourceRecord,
  ResearchRunResult,
  ResearchRunScope,
  ResearchRunStatus,
  ResearchRunTrigger,
  ScientificConnectorId,
  UpdateConnectorId,
  UpdateEngineConnector,
} from "@/lib/peptide/research/updateEngine/types";
export { EMPTY_STATISTICS, SCIENTIFIC_CONNECTOR_IDS, UPDATE_ENGINE_CRON_ENABLED } from "@/lib/peptide/research/updateEngine/types";
export { stableSourceKey, sourceLookupKeys } from "@/lib/peptide/research/updateEngine/normalize";
export {
  detectSourceChange,
  detectStudyChange,
  persistTouchesReviewStatus,
  preservedWorkflowStatus,
  reviewStatusForDisposition,
  scientificSourceFieldsChanged,
} from "@/lib/peptide/research/updateEngine/changeDetection";
export { matchSubstance, cannotMergeSlugs, forbiddenIdentityReason, identityCatalog } from "@/lib/peptide/research/updateEngine/matchIdentity";
export { normalizePubmedArticle, validatePubmedRecord } from "@/lib/peptide/research/updateEngine/pubmed";
export { normalizeClinicalTrial, rejectClinicalTrial, validateClinicalTrialRecord } from "@/lib/peptide/research/updateEngine/clinicalTrials";
export { normalizeFdaResult, validateFdaRecord } from "@/lib/peptide/research/updateEngine/fda";
export { normalizeEmaResult, validateEmaRecord } from "@/lib/peptide/research/updateEngine/ema";
export { scientificAdapter } from "@/lib/peptide/research/updateEngine/adapters";
export { runResearchUpdate, inspectFdaEmptySearch, inspectEma404 } from "@/lib/peptide/research/updateEngine/run";
export type { ResearchRunControl, ResearchRunProgress } from "@/lib/peptide/research/updateEngine/run";
export { resolveScope, updateAllMeansSubstancesNotShop } from "@/lib/peptide/research/updateEngine/scope";
export { persistPlanFromRun, candidateIsPublic } from "@/lib/peptide/research/updateEngine/persistPlan";
export { withRateLimit, shouldRetry, resetRateLimitState } from "@/lib/peptide/research/updateEngine/rateLimit";
export {
  engineAdminCapabilities,
  startEngineRun,
  defaultUnavailableLayer,
  UPDATE_ENGINE_ADMIN_ACTIONS,
} from "@/lib/peptide/research/updateEngine/admin";
export {
  bfarmUpdateConnector,
  mhraUpdateConnector,
  nmpaUpdateConnector,
  redditUpdateConnector,
  communityCannotRaiseEvidence,
  AVAILABLE_SCIENTIFIC_CONNECTORS,
} from "@/lib/peptide/research/updateEngine/unavailable";
