import { scientificAdapter } from "@/lib/peptide/research/updateEngine/adapters";
import { lexiconIdentityCatalog } from "@/lib/peptide/research/updateEngine/matchIdentity";
import { persistPlanFromRun } from "@/lib/peptide/research/updateEngine/persistPlan";
import { runResearchUpdate } from "@/lib/peptide/research/updateEngine/run";
import { resolveScope } from "@/lib/peptide/research/updateEngine/scope";
import type {
  ExistingSourceRow,
  ExistingStudyRow,
  ScientificConnectorId,
  UpdateEngineConnector,
} from "@/lib/peptide/research/updateEngine/types";
import { OPERATIONS_CRON_ENABLED, OPERATIONS_MIGRATION_REQUIRED, OPERATIONS_PRODUCTION_WRITE } from "@/lib/peptide/research/operations/types";
import { UPDATE_ENGINE_CRON_ENABLED } from "@/lib/peptide/research/updateEngine/types";
import {
  bfarmUpdateConnector,
  blogUpdateConnector,
  forumUpdateConnector,
  mhraUpdateConnector,
  nmpaUpdateConnector,
  redditUpdateConnector,
  userReportUpdateConnector,
} from "@/lib/peptide/research/updateEngine/unavailable";

export const UPDATE_ENGINE_ADMIN_ACTIONS = [
  "update-all",
  "update-substance",
  "update-connector",
  "update-combined",
  "update-category",
] as const;

export function engineAdminCapabilities() {
  return {
    updateAll: true,
    updateSubstance: true,
    updateConnector: true,
    updateCombined: true,
    cronEnabled: UPDATE_ENGINE_CRON_ENABLED || OPERATIONS_CRON_ENABLED,
    autoApprove: false,
    productionWrite: OPERATIONS_PRODUCTION_WRITE,
    migrationRequired: OPERATIONS_MIGRATION_REQUIRED,
  };
}

export async function startEngineRun(input: {
  action: (typeof UPDATE_ENGINE_ADMIN_ACTIONS)[number];
  substanceSlug?: string;
  connector?: ScientificConnectorId;
  connectors: UpdateEngineConnector[];
  existingSources?: ExistingSourceRow[];
  existingStudies?: ExistingStudyRow[];
}) {
  const scope = resolveScope({
    substanceSlug:
      input.action === "update-substance" || input.action === "update-combined" ? input.substanceSlug : null,
    connector:
      input.action === "update-connector" || input.action === "update-combined" ? input.connector : null,
  });
  const result = await runResearchUpdate({
    scope,
    catalog: lexiconIdentityCatalog(),
    existingSources: input.existingSources ?? [],
    existingStudies: input.existingStudies ?? [],
    connectors: input.connectors,
  });
  return { ...result, persistPlan: persistPlanFromRun(result.candidates) };
}

export function defaultUnavailableLayer(): UpdateEngineConnector[] {
  return [
    bfarmUpdateConnector,
    mhraUpdateConnector,
    nmpaUpdateConnector,
    redditUpdateConnector,
    forumUpdateConnector,
    blogUpdateConnector,
    userReportUpdateConnector,
  ];
}

export { scientificAdapter };
