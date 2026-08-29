import { identityCatalog } from "@/lib/peptide/research/updateEngine/matchIdentity";
import { persistPlanFromRun } from "@/lib/peptide/research/updateEngine/persistPlan";
import { runResearchUpdate } from "@/lib/peptide/research/updateEngine/run";
import { resolveScope } from "@/lib/peptide/research/updateEngine/scope";
import type {
  ResearchRunResult,
  ScientificConnectorId,
  UpdateEngineConnector,
} from "@/lib/peptide/research/updateEngine/types";
import { OPERATIONS_CRON_ENABLED } from "@/lib/peptide/research/operations/types";
import { persistReviewCandidates } from "@/lib/peptide/research/operations/persist";
import { createRunControl, hasActiveFullRun, newPersistedId } from "@/lib/peptide/research/operations/store";
import type {
  OperationsAction,
  OperationsRunLog,
  OperationsRunRecord,
  OperationsStore,
} from "@/lib/peptide/research/operations/types";

function sanitizeError(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/(api[_-]?key|bearer|token|secret|authorization)\s*[:=]\s*\S+/gi, "$1=redacted");
}

function errorSummary(logs: ResearchRunResult["logs"]): string | null {
  const parts = [...new Set(logs.map((row) => sanitizeError(row.error)).filter((row): row is string => Boolean(row)))];
  return parts.length ? parts.join("; ") : null;
}

function resolveActionScope(input: {
  action: OperationsAction;
  substanceSlug?: string;
  connector?: ScientificConnectorId;
}) {
  if (input.action === "update-all") return resolveScope({});
  if (input.action === "update-substance") return resolveScope({ substanceSlug: input.substanceSlug });
  if (input.action === "update-connector") return resolveScope({ connector: input.connector });
  return resolveScope({ substanceSlug: input.substanceSlug, connector: input.connector });
}

export function assertCanStartRun(store: OperationsStore, action: OperationsAction): void {
  if (OPERATIONS_CRON_ENABLED) {
    throw new Error("Cron must stay disabled until the workflow is fully tested.");
  }
  if (action === "update-all" && hasActiveFullRun(store)) {
    throw new Error("Ein Full Run läuft bereits. Zweiter Full Run blockiert.");
  }
}

export async function startPersistedRun(input: {
  store: OperationsStore;
  action: OperationsAction;
  substanceSlug?: string;
  connector?: ScientificConnectorId;
  connectors: UpdateEngineConnector[];
  parentRunId?: string | null;
  runId?: string;
  now?: string;
  onProgress?: (run: OperationsRunRecord) => void;
}): Promise<{
  run: OperationsRunRecord;
  engine: ResearchRunResult;
  persist: ReturnType<typeof persistReviewCandidates>;
  persistPlan: ReturnType<typeof persistPlanFromRun>;
  productionWrite: false;
}> {
  assertCanStartRun(input.store, input.action);
  const now = input.now ?? new Date().toISOString();
  const scope = resolveActionScope(input);
  const runId = input.runId ?? newPersistedId();
  const control = createRunControl(input.store, runId);
  const record: OperationsRunRecord = {
    id: runId,
    startedAt: now,
    completedAt: null,
    status: "running",
    trigger: scope.trigger,
    scope,
    statistics: {
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
    },
    errorSummary: null,
    parentRunId: input.parentRunId ?? null,
    cancelRequested: false,
    progress: { connector: null, substance: null },
    reviewCandidates: 0,
  };
  input.store.runs.push(record);
  input.onProgress?.(record);

  const engine = await runResearchUpdate({
    scope,
    catalog: identityCatalog(),
    existingSources: input.store.sources.map((row) => ({
      id: row.id,
      pmid: row.pmid,
      doi: row.doi,
      nctId: row.nctId,
      title: row.title,
      publicationDate: row.publicationDate,
      url: row.url,
      reviewStatus: row.reviewStatus,
    })),
    existingStudies: input.store.studies.map((row) => ({
      id: row.id,
      nctId: row.nctId,
      title: row.title,
      status: row.status,
      reviewStatus: row.reviewStatus,
    })),
    connectors: input.connectors,
    now,
    runId,
    control,
    onProgress: (progress) => {
      record.status = progress.status === "running" ? "running" : record.status;
      record.statistics = progress.statistics;
      record.progress = { connector: progress.connector, substance: progress.substance };
      record.cancelRequested = control.cancelled;
      input.onProgress?.(record);
    },
  });

  record.status = engine.status;
  record.completedAt = engine.completedAt;
  record.statistics = engine.statistics;
  record.errorSummary = errorSummary(engine.logs);
  record.cancelRequested = control.cancelled;

  const shouldPersist = engine.status === "completed" || engine.status === "partial";
  const persist = persistReviewCandidates(input.store, engine.candidates, { persist: shouldPersist });
  record.reviewCandidates = shouldPersist
    ? engine.candidates.filter(
        (row) => row.disposition === "NEW" || row.disposition === "UPDATED" || row.disposition === "REVIEW_REQUIRED",
      ).length
    : 0;

  for (const log of engine.logs) {
    const candidate = engine.candidates.find(
      (row) => row.record.identifier === log.identifier && row.slug === log.slug,
    );
    const row: OperationsRunLog = {
      runId,
      sourceId: null,
      connector: log.connector,
      identifier: log.identifier,
      substanceSlug: log.slug,
      retrievalStatus: log.retrievalStatus,
      resultType: candidate?.disposition ?? (log.retrievalStatus === "excluded" ? "REJECTED" : null),
      retrievedAt: log.retrievedAt,
      error: sanitizeError(log.error),
      previousFields: candidate?.previous ?? null,
      currentFields: candidate
        ? {
            title: candidate.record.title,
            publicationDate: candidate.record.publicationDate,
            status: candidate.record.study?.status ?? null,
          }
        : null,
    };
    input.store.logs.push(row);
  }

  updateConnectorHealth(input.store, engine, now);
  input.onProgress?.(record);

  return {
    run: record,
    engine,
    persist,
    persistPlan: persistPlanFromRun(shouldPersist ? engine.candidates : []),
    productionWrite: false,
  };
}

export async function retryPersistedRun(input: {
  store: OperationsStore;
  runId: string;
  connectors: UpdateEngineConnector[];
  now?: string;
  onProgress?: (run: OperationsRunRecord) => void;
}) {
  const parent = input.store.runs.find((row) => row.id === input.runId);
  if (!parent) throw new Error("Run nicht gefunden.");
  if (parent.status !== "partial" && parent.status !== "failed") {
    throw new Error("Retry nur für partial oder failed.");
  }
  const action: OperationsAction =
    parent.trigger === "full"
      ? "update-all"
      : parent.trigger === "single-substance"
        ? "update-substance"
        : parent.trigger === "single-connector"
          ? "update-connector"
          : "update-combined";
  return startPersistedRun({
    store: input.store,
    action,
    substanceSlug: parent.scope.substanceSlugs.length === 1 ? parent.scope.substanceSlugs[0] : undefined,
    connector: parent.scope.connectors.length === 1 ? parent.scope.connectors[0] : undefined,
    connectors: input.connectors,
    parentRunId: parent.id,
    now: input.now,
    onProgress: input.onProgress,
  });
}

function updateConnectorHealth(store: OperationsStore, engine: ResearchRunResult, now: string): void {
  const byConnector = new Map<string, { ok: boolean; error: string | null }>();
  for (const log of engine.logs) {
    const current = byConnector.get(log.connector) ?? { ok: true, error: null };
    if (log.retrievalStatus === "error" || log.retrievalStatus === "unavailable") {
      current.ok = false;
      current.error = sanitizeError(log.error);
    }
    byConnector.set(log.connector, current);
  }
  for (const [connector, summary] of byConnector) {
    const row = store.connectorHealth.find((item) => item.connector === connector);
    if (!row) continue;
    row.lastCheckedAt = now;
    if (summary.ok && (engine.status === "completed" || engine.status === "partial")) {
      row.lastSuccessfulRunId = engine.id;
      row.lastError = null;
    } else {
      row.lastError = summary.error;
    }
  }
}

export function runDiffs(store: OperationsStore, runId: string) {
  return store.logs.filter((row) => row.runId === runId && row.resultType === "UPDATED");
}
