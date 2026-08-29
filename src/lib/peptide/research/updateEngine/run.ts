import { isExcludedNct } from "@/lib/peptide/persistence/identifiers";
import { detectSourceChange, detectStudyChange, reviewStatusForDisposition } from "@/lib/peptide/research/updateEngine/changeDetection";
import { normalizeEmaResult } from "@/lib/peptide/research/updateEngine/ema";
import { normalizeFdaResult } from "@/lib/peptide/research/updateEngine/fda";
import { matchSubstance } from "@/lib/peptide/research/updateEngine/matchIdentity";
import { EMPTY_STATISTICS, UPDATE_ENGINE_CRON_ENABLED } from "@/lib/peptide/research/updateEngine/types";
import { communityCannotRaiseEvidence } from "@/lib/peptide/research/updateEngine/unavailable";
import type {
  ChangeDisposition,
  ExistingSourceRow,
  ExistingStudyRow,
  ResearchRunLog,
  ResearchRunResult,
  ResearchRunScope,
  ReviewCandidate,
  SubstanceIdentityRow,
  UpdateEngineConnector,
} from "@/lib/peptide/research/updateEngine/types";

let runSeq = 0;

function bumpDisposition(
  statistics: ResearchRunResult["statistics"],
  disposition: ChangeDisposition,
  kind: "source" | "study",
): void {
  if (kind === "source") {
    if (disposition === "NEW") statistics.sourcesNew += 1;
    if (disposition === "UPDATED") statistics.sourcesUpdated += 1;
    if (disposition === "UNCHANGED") statistics.sourcesUnchanged += 1;
    if (disposition === "DUPLICATE") statistics.sourcesDuplicate += 1;
    if (disposition === "REJECTED") statistics.sourcesRejected += 1;
  } else {
    if (disposition === "NEW") statistics.studiesNew += 1;
    if (disposition === "UPDATED") statistics.studiesUpdated += 1;
    if (disposition === "UNCHANGED") statistics.studiesUnchanged += 1;
    if (disposition === "DUPLICATE") statistics.studiesDuplicate += 1;
  }
}

export interface ResearchRunControl {
  cancelled: boolean;
}

export interface ResearchRunProgress {
  status: ResearchRunResult["status"];
  connector: string | null;
  substance: string | null;
  statistics: ResearchRunResult["statistics"];
}

export async function runResearchUpdate(input: {
  scope: ResearchRunScope;
  catalog: SubstanceIdentityRow[];
  existingSources: ExistingSourceRow[];
  existingStudies: ExistingStudyRow[];
  connectors: UpdateEngineConnector[];
  now?: string;
  runId?: string;
  control?: ResearchRunControl;
  onProgress?: (progress: ResearchRunProgress) => void;
}): Promise<ResearchRunResult> {
  const now = input.now ?? "2026-08-29T00:00:00.000Z";
  const id = input.runId ?? `run-${++runSeq}`;
  const statistics = { ...EMPTY_STATISTICS };
  const candidates: ReviewCandidate[] = [];
  const logs: ResearchRunLog[] = [];
  const seenSourceKeys = new Set<string>();
  const seenStudyNcts = new Set<string>();
  let connectorFailures = 0;
  let connectorSuccesses = 0;
  let cancelled = false;
  statistics.substancesChecked = input.scope.substanceSlugs.length;

  const emit = (connector: string | null, substance: string | null, status: ResearchRunResult["status"] = "running") => {
    input.onProgress?.({ status, connector, substance, statistics: { ...statistics } });
  };

  emit(null, null, "running");

  substanceLoop: for (const slug of input.scope.substanceSlugs) {
    if (input.control?.cancelled) {
      cancelled = true;
      break substanceLoop;
    }
    const substance = input.catalog.find((row) => row.slug === slug);
    if (!substance) continue;
    for (const connectorId of input.scope.connectors) {
      if (input.control?.cancelled) {
        cancelled = true;
        break substanceLoop;
      }
      const connector = input.connectors.find((item) => item.id === connectorId);
      if (!connector) continue;
      emit(connector.id, slug, "running");
      statistics.connectorsExecuted += 1;
      if (communityCannotRaiseEvidence(connector.kind) || connector.availability === "unavailable") {
        connectorFailures += 1;
        logs.push({
          connector: connector.id,
          slug,
          identifier: null,
          retrievalStatus: "unavailable",
          retrievedAt: now,
          error: "unavailable",
        });
        continue;
      }

      let search;
      try {
        search = await connector.search({ substance, now });
      } catch (error) {
        connectorFailures += 1;
        statistics.errors += 1;
        logs.push({
          connector: connector.id,
          slug,
          identifier: null,
          retrievalStatus: "error",
          retrievedAt: now,
          error: error instanceof Error ? error.message : "connector-error",
        });
        continue;
      }

      if (!search.ok || search.availability === "unavailable") {
        connectorFailures += 1;
        if (search.error) statistics.errors += 1;
        logs.push({
          connector: connector.id,
          slug,
          identifier: null,
          retrievalStatus: search.availability === "unavailable" ? "unavailable" : "error",
          retrievedAt: now,
          error: search.error ?? "search-failed",
        });
        continue;
      }
      connectorSuccesses += 1;

      for (const record of search.records) {
        statistics.sourcesQueried += 1;
        if (isExcludedNct(record.nctId)) {
          statistics.sourcesRejected += 1;
          logs.push({
            connector: connector.id,
            slug,
            identifier: record.nctId,
            retrievalStatus: "excluded",
            retrievedAt: now,
            error: "hudson-excluded",
          });
          continue;
        }

        const valid = connector.validate(record);
        if (!valid.ok) {
          statistics.sourcesRejected += 1;
          logs.push({
            connector: connector.id,
            slug,
            identifier: record.nctId ?? record.identifier,
            retrievalStatus: valid.message?.includes("hudson") ? "excluded" : "excluded",
            retrievedAt: now,
            error: valid.message ?? "invalid",
          });
          continue;
        }

        const match = matchSubstance({
          requestedSlug: slug,
          title: record.title,
          kind: record.study ? "study" : "article",
          catalog: input.catalog,
        });
        const change = detectSourceChange(record, input.existingSources, seenSourceKeys);
        seenSourceKeys.add(change.key);
        bumpDisposition(statistics, change.disposition, "source");

        let disposition: ChangeDisposition = change.disposition;
        if (
          match.confidence === "uncertain" &&
          change.disposition !== "UNCHANGED" &&
          change.disposition !== "DUPLICATE"
        ) {
          disposition = "REVIEW_REQUIRED";
        }

        const review = reviewStatusForDisposition(disposition);
        if (review) {
          statistics.reviewRequired += 1;
          candidates.push({
            kind: record.regulatory ? "regulatory" : "source",
            disposition,
            reviewStatus: "review-required",
            slug: match.slug,
            record,
            previous: change.previous
              ? { title: change.previous.title, publicationDate: change.previous.publicationDate }
              : undefined,
            reason: match.confidence === "uncertain" ? match.reason : disposition.toLowerCase(),
            matchConfidence: match.confidence,
          });
        }

        logs.push({
          connector: connector.id,
          slug,
          identifier: record.identifier,
          retrievalStatus: "ok",
          retrievedAt: now,
          error: null,
        });

        if (!record.study) continue;
        const studyChange = detectStudyChange(
          record.study.nctId,
          record.study.title,
          record.study.status,
          input.existingStudies,
          seenStudyNcts,
        );
        seenStudyNcts.add(record.study.nctId);
        bumpDisposition(statistics, studyChange.disposition, "study");
        let studyDisposition: ChangeDisposition = studyChange.disposition;
        if (
          match.confidence === "uncertain" &&
          studyChange.disposition !== "UNCHANGED" &&
          studyChange.disposition !== "DUPLICATE"
        ) {
          studyDisposition = "REVIEW_REQUIRED";
        }
        if (reviewStatusForDisposition(studyDisposition)) {
          statistics.reviewRequired += 1;
          candidates.push({
            kind: "study",
            disposition: studyDisposition,
            reviewStatus: "review-required",
            slug: match.slug,
            record,
            previous: studyChange.previous
              ? { title: studyChange.previous.title, publicationDate: null, status: studyChange.previous.status }
              : undefined,
            reason: match.confidence === "uncertain" ? match.reason : studyDisposition.toLowerCase(),
            matchConfidence: match.confidence,
          });
        }
      }
    }
  }

  let status: ResearchRunResult["status"] = "completed";
  if (cancelled) status = "cancelled";
  else if (connectorSuccesses === 0 && connectorFailures > 0) status = "failed";
  else if (connectorFailures > 0 && connectorSuccesses > 0) status = "partial";

  emit(null, null, status);

  return {
    id,
    startedAt: now,
    completedAt: now,
    status,
    trigger: input.scope.trigger,
    scope: input.scope,
    statistics,
    candidates,
    logs,
    claimsAdded: 0,
    evidenceUpgraded: 0,
    regulatoryAutoApproved: 0,
    productionWrite: false,
    cronEnabled: UPDATE_ENGINE_CRON_ENABLED,
  };
}

export function inspectFdaEmptySearch(raw: unknown, slug: string) {
  return normalizeFdaResult(raw, { slug, now: "2026-08-29T00:00:00.000Z" });
}

export function inspectEma404(raw: unknown, slug: string) {
  return normalizeEmaResult(raw, { slug, now: "2026-08-29T00:00:00.000Z" });
}
