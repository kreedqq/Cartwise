import { AVAILABLE_SCIENTIFIC_CONNECTORS } from "@/lib/peptide/research/updateEngine/unavailable";
import { EMPTY_STATISTICS } from "@/lib/peptide/research/updateEngine/types";
import { nextOperationsUuid } from "@/lib/peptide/research/operations/ids";
import type {
  ConnectorHealthRow,
  FrozenInventory,
  OperationsRunRecord,
  OperationsStore,
} from "@/lib/peptide/research/operations/types";

const FROZEN_INVENTORY: FrozenInventory = {
  claims: 294,
  evidence: 294,
  evidenceReviewRequired: 267,
  evidenceApproved: 27,
  regulatory: 41,
};

const COMMUNITY_HEALTH: ConnectorHealthRow[] = [
  { connector: "reddit", kind: "community", availability: "unavailable", lastSuccessfulRunId: null, lastError: null, lastCheckedAt: null },
  { connector: "forum", kind: "community", availability: "unavailable", lastSuccessfulRunId: null, lastError: null, lastCheckedAt: null },
  { connector: "blog", kind: "community", availability: "unavailable", lastSuccessfulRunId: null, lastError: null, lastCheckedAt: null },
  { connector: "user-report", kind: "community", availability: "unavailable", lastSuccessfulRunId: null, lastError: null, lastCheckedAt: null },
];

export function emptyOperationsStore(): OperationsStore {
  return {
    runs: [],
    logs: [],
    sources: [],
    studies: [],
    sourceSubstances: [],
    studySubstances: [],
    reviewActions: [],
    communityReports: [],
    connectorHealth: [
      ...AVAILABLE_SCIENTIFIC_CONNECTORS.map((id) => ({
        connector: id,
        kind: "scientific" as const,
        availability: "available" as const,
        lastSuccessfulRunId: null,
        lastError: null,
        lastCheckedAt: null,
      })),
      {
        connector: "bfarm",
        kind: "scientific",
        availability: "unavailable",
        lastSuccessfulRunId: null,
        lastError: "unavailable",
        lastCheckedAt: null,
      },
      {
        connector: "mhra",
        kind: "scientific",
        availability: "unavailable",
        lastSuccessfulRunId: null,
        lastError: "unavailable",
        lastCheckedAt: null,
      },
      {
        connector: "nmpa",
        kind: "scientific",
        availability: "unavailable",
        lastSuccessfulRunId: null,
        lastError: "unavailable",
        lastCheckedAt: null,
      },
      ...COMMUNITY_HEALTH,
    ],
    inventory: { ...FROZEN_INVENTORY },
    controls: new Map(),
  };
}

let sessionStore: OperationsStore | null = null;

export function getSessionOperationsStore(): OperationsStore {
  if (!sessionStore) sessionStore = emptyOperationsStore();
  return sessionStore;
}

export function resetSessionOperationsStore(): void {
  sessionStore = emptyOperationsStore();
}

export function cloneOperationsStore(store: OperationsStore): OperationsStore {
  return {
    ...structuredClone({
      runs: store.runs,
      logs: store.logs,
      sources: store.sources,
      studies: store.studies,
      sourceSubstances: store.sourceSubstances,
      studySubstances: store.studySubstances,
      reviewActions: store.reviewActions,
      communityReports: store.communityReports,
      connectorHealth: store.connectorHealth,
      inventory: store.inventory,
    }),
    controls: new Map(store.controls),
  };
}

export function createRunControl(store: OperationsStore, runId: string) {
  const control = { cancelled: false };
  store.controls.set(runId, control);
  return control;
}

export function requestRunCancel(store: OperationsStore, runId: string): OperationsRunRecord | null {
  const run = store.runs.find((row) => row.id === runId);
  if (!run) return null;
  if (run.status !== "queued" && run.status !== "running") return run;
  run.cancelRequested = true;
  const control = store.controls.get(runId);
  if (control) control.cancelled = true;
  return run;
}

export function hasActiveFullRun(store: OperationsStore): boolean {
  return store.runs.some((row) => (row.status === "queued" || row.status === "running") && row.trigger === "full");
}

export function pageRuns(store: OperationsStore, page = 0, pageSize = 20) {
  const sorted = [...store.runs].sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1));
  const from = Math.max(0, page) * pageSize;
  return {
    items: sorted.slice(from, from + pageSize),
    total: sorted.length,
    page,
    pageSize,
  };
}

export function emptyRunStatistics() {
  return { ...EMPTY_STATISTICS };
}

export function newPersistedId(): string {
  return nextOperationsUuid();
}
