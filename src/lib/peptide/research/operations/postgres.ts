import { supabase } from "@/lib/supabaseClient";
import type { CandidatePersistResult } from "@/lib/peptide/research/operations/persist";
import { OFFICIAL_CONNECTOR_ACCESS } from "@/lib/peptide/research/operations/officialAccess";
import type {
  ConnectorHealthRow,
  OperationsRunLog,
  OperationsRunRecord,
  OperationsSource,
  OperationsStore,
  OperationsStudy,
} from "@/lib/peptide/research/operations/types";

export async function isOperationsSchemaReady(): Promise<boolean> {
  const { error } = await supabase.from("research_runs").select("id, trigger_kind").limit(1);
  if (error) return false;
  const { error: communityError } = await supabase.from("community_reports").select("id").limit(1);
  return !communityError;
}

function sourceTypeForInsert(source: OperationsSource): OperationsSource["sourceType"] {
  return source.sourceType === "pubmed" ||
    source.sourceType === "clinical_trial" ||
    source.sourceType === "fda" ||
    source.sourceType === "ema" ||
    source.sourceType === "journal" ||
    source.sourceType === "scientific"
    ? source.sourceType
    : "scientific";
}

async function substanceIdBySlug(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("substances").select("id, slug");
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.slug, row.id]));
}

export async function claimFullRunSlot(runId: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from("research_runs").insert({
    id: runId,
    run_type: "live",
    connector: "all",
    query: null,
    batch_label: "operations",
    status: "running",
    started_at: new Date().toISOString(),
    trigger_kind: "full",
    substance_scope: [],
    connector_scope: [],
    schedule_kind: "manual",
    cancel_requested: false,
  } as never);
  if (!error) return { ok: true };
  if (/unique|duplicate|one_active_full/i.test(error.message)) {
    return { ok: false, message: "Ein Full Run läuft bereits. Zweiter Full Run blockiert." };
  }
  return { ok: false, message: error.message };
}

export async function persistRunToPostgres(input: {
  store: OperationsStore;
  run: OperationsRunRecord;
  persist: CandidatePersistResult;
}): Promise<{ ok: boolean; productionWrite: false; message?: string }> {
  const ready = await isOperationsSchemaReady();
  if (!ready) return { ok: false, productionWrite: false, message: "schema-not-ready" };

  const { error: runError } = await supabase.from("research_runs").upsert(
    {
      id: input.run.id,
      run_type: "live",
      connector: input.run.scope.connectors.join(",") || "all",
      query: input.run.scope.substanceSlugs.join(","),
      batch_label: "operations",
      status: input.run.status,
      started_at: input.run.startedAt,
      completed_at: input.run.completedAt,
      sources_found: input.run.statistics.sourcesQueried,
      sources_accepted: input.run.statistics.sourcesNew + input.run.statistics.sourcesUpdated,
      sources_rejected: input.run.statistics.sourcesRejected,
      studies_found: input.run.statistics.studiesNew + input.run.statistics.studiesUpdated,
      studies_accepted: input.run.statistics.studiesNew,
      errors: input.run.errorSummary,
      trigger_kind: input.run.trigger,
      substance_scope: input.run.scope.substanceSlugs,
      connector_scope: input.run.scope.connectors,
      statistics: input.run.statistics,
      error_summary: input.run.errorSummary,
      progress: input.run.progress,
      schedule_kind: "manual",
      cancel_requested: input.run.cancelRequested,
      parent_run_id: input.run.parentRunId,
    } as never,
    { onConflict: "id" },
  );
  if (runError) return { ok: false, productionWrite: false, message: runError.message };

  let slugs: Map<string, string>;
  try {
    slugs = await substanceIdBySlug();
  } catch (error) {
    return { ok: false, productionWrite: false, message: error instanceof Error ? error.message : "substance-lookup" };
  }

  const createdSources = input.persist.createdSourceIds
    .map((id) => input.store.sources.find((row) => row.id === id))
    .filter((row): row is OperationsSource => Boolean(row));
  for (const source of createdSources) {
    const sourceType = sourceTypeForInsert(source);
    const { error: sourceError } = await supabase.from("sources").insert({
      id: source.id,
      source_type: sourceType as never,
      title: source.title,
      publisher: source.publisher,
      publication_date: source.publicationDate,
      access_date: new Date().toISOString().slice(0, 10),
      url: source.url,
      doi: source.doi,
      pmid: source.pmid,
      nct_id: source.nctId,
      status: source.status,
      review_status: "review-required",
      connector: source.connector,
    });
    if (sourceError && !/duplicate|unique/i.test(sourceError.message)) {
      return { ok: false, productionWrite: false, message: sourceError.message };
    }
    const linked = input.store.sourceSubstances.filter((row) => row.sourceId === source.id);
    for (const link of linked) {
      const substanceId = slugs.get(link.slug);
      if (!substanceId) continue;
      await supabase.from("source_substances").insert({
        source_id: source.id,
        substance_id: substanceId,
        legacy_source_id: source.pmid ?? source.nctId ?? source.id,
      });
    }
  }

  // UPDATED scientific fields only. UNCHANGED / DUPLICATE ids are never in this list
  // and must not have review_status rewritten.
  for (const id of input.persist.updatedSourceIds) {
    const source = input.store.sources.find((row) => row.id === id);
    if (!source) continue;
    const { error } = await supabase
      .from("sources")
      .update({
        title: source.title,
        publication_date: source.publicationDate,
        review_status: "review-required",
      })
      .eq("id", id);
    if (error) return { ok: false, productionWrite: false, message: error.message };
  }

  for (const id of input.persist.updatedStudyIds) {
    const study = input.store.studies.find((row) => row.id === id);
    if (!study) continue;
    const { error } = await supabase
      .from("studies")
      .update({
        title: study.title,
        status: study.status,
        review_status: "review-required",
      })
      .eq("id", id);
    if (error) return { ok: false, productionWrite: false, message: error.message };
  }

  const createdStudies = input.persist.createdStudyIds
    .map((id) => input.store.studies.find((row) => row.id === id))
    .filter((row): row is OperationsStudy => Boolean(row));
  for (const study of createdStudies) {
    const { error: studyError } = await supabase.from("studies").insert({
      id: study.id,
      nct_id: study.nctId,
      title: study.title,
      status: study.status,
      sponsor: study.sponsor,
      phase: study.phase,
      source_url: `https://clinicaltrials.gov/study/${study.nctId}`,
      review_status: "review-required",
      has_results: false,
    });
    if (studyError && !/duplicate|unique/i.test(studyError.message)) {
      return { ok: false, productionWrite: false, message: studyError.message };
    }
    const linked = input.store.studySubstances.filter((row) => row.studyId === study.id);
    for (const link of linked) {
      const substanceId = slugs.get(link.slug);
      if (!substanceId) continue;
      await supabase.from("study_substances").insert({
        study_id: study.id,
        substance_id: substanceId,
      });
    }
  }

  const logs = input.store.logs.filter((row) => row.runId === input.run.id);
  for (const log of logs) {
    const { error: logError } = await supabase.from("research_run_sources").insert({
      research_run_id: input.run.id,
      source_id: null,
      connector: log.connector,
      retrieval_status: log.retrievalStatus,
      result_type: log.resultType,
      identifier: log.identifier,
      substance_slug: log.substanceSlug,
      retrieved_at: log.retrievedAt,
      error_text: log.error,
      previous_fields: log.previousFields,
      current_fields: log.currentFields,
      accepted: log.resultType !== "REJECTED",
    } as never);
    if (logError) return { ok: false, productionWrite: false, message: logError.message };
  }

  await upsertConnectorHealth(input.store.connectorHealth, input.run);
  return { ok: true, productionWrite: false };
}

async function upsertConnectorHealth(rows: ConnectorHealthRow[], run: OperationsRunRecord): Promise<void> {
  const now = run.completedAt ?? run.startedAt;
  for (const row of rows) {
    const official = OFFICIAL_CONNECTOR_ACCESS[row.connector as keyof typeof OFFICIAL_CONNECTOR_ACCESS];
    await supabase.from("research_connector_health").upsert(
      {
        connector: row.connector,
        kind: row.kind,
        availability: official?.availability ?? row.availability,
        last_successful_run_id: row.lastSuccessfulRunId,
        last_error: row.lastError,
        last_checked_at: row.lastCheckedAt ?? now,
      } as never,
      { onConflict: "connector" },
    );
  }
}

export async function persistFailedRunSlot(runId: string, message: string): Promise<void> {
  await supabase
    .from("research_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_summary: message.slice(0, 500),
      cancel_requested: false,
    } as never)
    .eq("id", runId)
    .eq("status", "running");
}

export async function persistCancelToPostgres(runId: string): Promise<void> {
  if (!(await isOperationsSchemaReady())) return;
  await supabase
    .from("research_runs")
    .update({ cancel_requested: true, status: "cancelled", completed_at: new Date().toISOString() } as never)
    .eq("id", runId)
    .in("status", ["queued", "running"]);
}

export async function loadRunsFromPostgres(page = 0, pageSize = 20) {
  const from = page * pageSize;
  const { data, error, count } = await supabase
    .from("research_runs")
    .select(
      "id, started_at, completed_at, status, trigger_kind, substance_scope, connector_scope, statistics, error_summary, cancel_requested, parent_run_id",
      { count: "exact" },
    )
    .order("started_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  const items: OperationsRunRecord[] = (data ?? []).map((row) => {
    const stats = (row.statistics ?? {}) as OperationsRunRecord["statistics"];
    const trigger = (row.trigger_kind ?? "manual") as OperationsRunRecord["trigger"];
    return {
      id: row.id,
      startedAt: row.started_at ?? row.id,
      completedAt: row.completed_at,
      status: row.status as OperationsRunRecord["status"],
      trigger,
      scope: {
        trigger,
        substanceSlugs: row.substance_scope ?? [],
        connectors: (row.connector_scope ?? []) as OperationsRunRecord["scope"]["connectors"],
      },
      statistics: {
        substancesChecked: stats.substancesChecked ?? 0,
        connectorsExecuted: stats.connectorsExecuted ?? 0,
        sourcesQueried: stats.sourcesQueried ?? 0,
        sourcesNew: stats.sourcesNew ?? 0,
        sourcesUpdated: stats.sourcesUpdated ?? 0,
        sourcesUnchanged: stats.sourcesUnchanged ?? 0,
        sourcesDuplicate: stats.sourcesDuplicate ?? 0,
        sourcesRejected: stats.sourcesRejected ?? 0,
        studiesNew: stats.studiesNew ?? 0,
        studiesUpdated: stats.studiesUpdated ?? 0,
        studiesUnchanged: stats.studiesUnchanged ?? 0,
        studiesDuplicate: stats.studiesDuplicate ?? 0,
        reviewRequired: stats.reviewRequired ?? 0,
        errors: stats.errors ?? 0,
      },
      errorSummary: row.error_summary,
      parentRunId: row.parent_run_id,
      cancelRequested: row.cancel_requested ?? false,
      progress: { connector: null, substance: null },
      reviewCandidates: stats.reviewRequired ?? 0,
    };
  });
  return { items, total: count ?? items.length, page, pageSize };
}

export async function loadConnectorHealthFromPostgres(): Promise<ConnectorHealthRow[] | null> {
  const { data, error } = await supabase
    .from("research_connector_health")
    .select("connector, kind, availability, last_successful_run_id, last_error, last_checked_at");
  if (error) return null;
  return (data ?? []).map((row) => ({
    connector: row.connector as ConnectorHealthRow["connector"],
    kind: row.kind as ConnectorHealthRow["kind"],
    availability: row.availability as ConnectorHealthRow["availability"],
    lastSuccessfulRunId: row.last_successful_run_id,
    lastError: row.last_error,
    lastCheckedAt: row.last_checked_at,
  }));
}

export function logsForRun(store: OperationsStore, runId: string): OperationsRunLog[] {
  return store.logs.filter((row) => row.runId === runId);
}
