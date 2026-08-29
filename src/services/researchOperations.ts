import { supabase } from "@/lib/supabaseClient";
import {
  cacheBackedScientificConnectors,
  getSessionOperationsStore,
  pageRuns,
  requestRunCancel,
  retryPersistedRun,
  startPersistedRun,
  type OperationsAction,
} from "@/lib/peptide/research/operations";
import {
  isOperationsSchemaReady,
  claimFullRunSlot,
  loadConnectorHealthFromPostgres,
  loadRunsFromPostgres,
  persistCancelToPostgres,
  persistFailedRunSlot,
  persistRunToPostgres,
} from "@/lib/peptide/research/operations/postgres";
import type { OperationsRunRecord, OperationsStore } from "@/lib/peptide/research/operations/types";
import type { ScientificConnectorId } from "@/lib/peptide/research/updateEngine/types";

const PAGE = 200;

export async function seedOperationsCatalog(store: OperationsStore): Promise<void> {
  if (store.sources.length > 0 || store.studies.length > 0) return;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("sources")
      .select("id, pmid, doi, nct_id, title, publication_date, url, review_status, connector, source_type, publisher, status")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      store.sources.push({
        id: row.id,
        sourceType: row.source_type,
        title: row.title,
        publisher: row.publisher,
        publicationDate: row.publication_date,
        url: row.url,
        doi: row.doi,
        pmid: row.pmid,
        nctId: row.nct_id,
        status: row.status,
        reviewStatus: row.review_status,
        connector: row.connector,
      });
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("studies")
      .select("id, nct_id, title, status, sponsor, phase, review_status")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      store.studies.push({
        id: row.id,
        nctId: row.nct_id,
        title: row.title,
        status: row.status,
        sponsor: row.sponsor,
        phase: row.phase,
        reviewStatus: row.review_status,
      });
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
}

export async function startAdminResearchRun(input: {
  action: OperationsAction;
  substanceSlug?: string;
  connector?: ScientificConnectorId;
  onProgress?: (run: OperationsRunRecord) => void;
}) {
  const store = getSessionOperationsStore();
  try {
    await seedOperationsCatalog(store);
  } catch {
    // Catalog seed is best-effort. Persistence of this run stays in the session store.
  }
  const runId = crypto.randomUUID();
  let claimed = false;
  if (input.action === "update-all" && (await isOperationsSchemaReady())) {
    const slot = await claimFullRunSlot(runId);
    if (!slot.ok) throw new Error(slot.message ?? "Full Run blockiert.");
    claimed = true;
  }
  try {
    const result = await startPersistedRun({
      store,
      action: input.action,
      substanceSlug: input.substanceSlug,
      connector: input.connector,
      connectors: cacheBackedScientificConnectors(),
      onProgress: input.onProgress,
      runId,
    });
    const postgres = await persistRunToPostgres({ store, run: result.run, persist: result.persist });
    return { ...result, postgres };
  } catch (error) {
    if (claimed) {
      await persistFailedRunSlot(runId, error instanceof Error ? error.message : "run-failed");
    }
    throw error;
  }
}

export async function retryAdminResearchRun(runId: string, onProgress?: (run: OperationsRunRecord) => void) {
  const store = getSessionOperationsStore();
  const result = await retryPersistedRun({
    store,
    runId,
    connectors: cacheBackedScientificConnectors(),
    onProgress,
  });
  const postgres = await persistRunToPostgres({ store, run: result.run, persist: result.persist });
  return { ...result, postgres };
}

export async function cancelAdminResearchRun(runId: string) {
  const cancelled = requestRunCancel(getSessionOperationsStore(), runId);
  await persistCancelToPostgres(runId);
  return cancelled;
}

export async function listAdminResearchRuns(page = 0, pageSize = 20) {
  try {
    if (await isOperationsSchemaReady()) {
      return await loadRunsFromPostgres(page, pageSize);
    }
  } catch {
    // Session fallback when 0031 is missing or RLS blocks the read.
  }
  return pageRuns(getSessionOperationsStore(), page, pageSize);
}

export async function listAdminConnectorHealth() {
  const persisted = await loadConnectorHealthFromPostgres();
  if (persisted && persisted.length > 0) return persisted;
  return getSessionOperationsStore().connectorHealth;
}

export function listAdminRunDiffs(runId: string) {
  return getSessionOperationsStore().logs.filter((row) => row.runId === runId && row.resultType === "UPDATED");
}
