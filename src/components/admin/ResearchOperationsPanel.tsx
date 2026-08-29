import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PEPTIDE_SUBSTANCES_IDENTITY } from "@/lib/peptide/catalog";
import {
  OPERATIONS_MIGRATION_REQUIRED,
  OPERATIONS_PRODUCTION_WRITE,
  REDDIT_CONNECTOR_STATUS,
  communityCannotRaiseScientificEvidence,
} from "@/lib/peptide/research/operations";
import { AVAILABLE_SCIENTIFIC_CONNECTORS, engineAdminCapabilities } from "@/lib/peptide/research/updateEngine";
import type { OperationsAction, OperationsRunRecord } from "@/lib/peptide/research/operations/types";
import type { ScientificConnectorId } from "@/lib/peptide/research/updateEngine/types";
import {
  useAdminConnectorHealth,
  useAdminResearchRuns,
  useCancelAdminResearchRun,
  useRetryAdminResearchRun,
} from "@/hooks/useResearchOperations";
import { startAdminResearchRun } from "@/services/researchOperations";

export function ResearchOperationsPanel() {
  const caps = engineAdminCapabilities();
  const [page, setPage] = React.useState(0);
  const [substance, setSubstance] = React.useState("retatrutide");
  const [connector, setConnector] = React.useState<ScientificConnectorId>("pubmed");
  const [active, setActive] = React.useState<OperationsRunRecord | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const runsQuery = useAdminResearchRuns(page);
  const healthQuery = useAdminConnectorHealth();
  const retryRun = useRetryAdminResearchRun();
  const cancelRun = useCancelAdminResearchRun();

  async function run(action: OperationsAction) {
    setMessage(null);
    setPending(true);
    try {
      const result = await startAdminResearchRun({
        action,
        substanceSlug: action === "update-all" || action === "update-connector" ? undefined : substance,
        connector: action === "update-all" || action === "update-substance" ? undefined : connector,
        onProgress: setActive,
      });
      setActive(result.run);
      const s = result.run.statistics;
      setMessage(
        `Sources checked: ${s.sourcesQueried} · New: ${s.sourcesNew} · Updated: ${s.sourcesUpdated} · Unchanged: ${s.sourcesUnchanged} · Duplicate: ${s.sourcesDuplicate} · Review required: ${s.reviewRequired}${result.postgres.ok ? " · Postgres saved" : ` · Session only (${result.postgres.message ?? "no schema"})`}`,
      );
      await runsQuery.refetch();
      await healthQuery.refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Run fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  }

  const lastPage = Math.max(0, Math.ceil((runsQuery.data?.total ?? 0) / 20) - 1);
  const running = active?.status === "running" || active?.status === "queued";

  return (
    <section className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
      <div>
        <h2 className="text-base font-semibold">Research Operations</h2>
        <p className="text-sm text-muted-foreground">
          Update All = 27 Substanzen × verfügbare Scientific Connectors. Nicht Shop-Produkte. Kein Auto-Approve.
          Cron {caps.cronEnabled ? "an" : "aus"}. Claims/Evidence/Regulatory-Write {OPERATIONS_PRODUCTION_WRITE ? "an" : "aus"}.
          Runs werden nach 0031 in Postgres gespeichert. MIGRATION_REQUIRED: {OPERATIONS_MIGRATION_REQUIRED}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="text-sm">
          Substanz
          <select
            className="ml-2 rounded-md border border-border bg-background px-2 py-1"
            value={substance}
            onChange={(event) => setSubstance(event.target.value)}
          >
            {PEPTIDE_SUBSTANCES_IDENTITY.map((row) => (
              <option key={row.slug} value={row.slug}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Connector
          <select
            className="ml-2 rounded-md border border-border bg-background px-2 py-1"
            value={connector}
            onChange={(event) => setConnector(event.target.value as ScientificConnectorId)}
          >
            {AVAILABLE_SCIENTIFIC_CONNECTORS.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={() => void run("update-all")}>
          Update All
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void run("update-substance")}>
          Update Substance
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void run("update-connector")}>
          Update Connector
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void run("update-combined")}>
          Substance + Connector
        </Button>
        {active && running ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => {
              cancelRun.mutate(active.id);
              setMessage("Cancel angefordert. Keine halbfertigen Review-States.");
            }}
          >
            Cancel
          </Button>
        ) : null}
      </div>

      {active ? (
        <div className="rounded-lg border border-border/60 px-3 py-2 text-sm">
          <p>
            Status <Badge variant="outline">{active.status}</Badge>
            {active.progress.connector ? ` · ${active.progress.connector}` : ""}
            {active.progress.substance ? ` · ${active.progress.substance}` : ""}
          </p>
          <p className="text-muted-foreground">
            Checked {active.statistics.sourcesQueried} · New {active.statistics.sourcesNew} · Updated{" "}
            {active.statistics.sourcesUpdated} · Unchanged {active.statistics.sourcesUnchanged} · Duplicate{" "}
            {active.statistics.sourcesDuplicate} · Review required {active.statistics.reviewRequired}
          </p>
        </div>
      ) : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div>
        <h3 className="text-sm font-medium">Connector Health</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Connector</th>
                <th className="py-1 font-medium">Kind</th>
                <th className="py-1 font-medium">Status</th>
                <th className="py-1 font-medium">Last success</th>
                <th className="py-1 font-medium">Last error</th>
                <th className="py-1 font-medium">Last checked</th>
              </tr>
            </thead>
            <tbody>
              {(healthQuery.data ?? []).map((row) => (
                <tr key={row.connector} className="border-t border-border/50">
                  <td className="py-1">{row.connector}</td>
                  <td className="py-1">{row.kind}</td>
                  <td className="py-1">{row.availability}</td>
                  <td className="py-1 font-mono text-xs">{row.lastSuccessfulRunId ?? "—"}</td>
                  <td className="py-1">{row.lastError ?? "—"}</td>
                  <td className="py-1">{row.lastCheckedAt ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Reddit: {REDDIT_CONNECTOR_STATUS}. Community cannot raise evidence:{" "}
          {communityCannotRaiseScientificEvidence() ? "yes" : "no"}. Keine Community-Daten importiert.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium">Run History</h3>
        {(runsQuery.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Run-History. Nach 0031 bleiben Runs in Postgres.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 font-medium">Run ID</th>
                  <th className="py-1 font-medium">Start</th>
                  <th className="py-1 font-medium">End</th>
                  <th className="py-1 font-medium">Trigger</th>
                  <th className="py-1 font-medium">Scope</th>
                  <th className="py-1 font-medium">Connectors</th>
                  <th className="py-1 font-medium">Status</th>
                  <th className="py-1 font-medium">Sources</th>
                  <th className="py-1 font-medium">Studies</th>
                  <th className="py-1 font-medium">Review</th>
                  <th className="py-1 font-medium">Errors</th>
                  <th className="py-1 font-medium" />
                </tr>
              </thead>
              <tbody>
                {(runsQuery.data?.items ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-border/50">
                    <td className="py-1 font-mono text-xs">{row.id.slice(0, 8)}</td>
                    <td className="py-1">{row.startedAt.slice(0, 19)}</td>
                    <td className="py-1">{row.completedAt ? row.completedAt.slice(0, 19) : "—"}</td>
                    <td className="py-1">{row.trigger}</td>
                    <td className="py-1">{row.scope.substanceSlugs.length} subst.</td>
                    <td className="py-1">{row.scope.connectors.join(", ") || "—"}</td>
                    <td className="py-1">{row.status}</td>
                    <td className="py-1">{row.statistics.sourcesQueried}</td>
                    <td className="py-1">{row.statistics.studiesNew + row.statistics.studiesUpdated}</td>
                    <td className="py-1">{row.reviewCandidates}</td>
                    <td className="py-1">{row.statistics.errors}</td>
                    <td className="py-1">
                      {row.status === "partial" || row.status === "failed" ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => void retryRun.mutateAsync(row.id)}>
                          Retry
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lastPage > 0 ? (
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={page <= 0} onClick={() => setPage(page - 1)}>
              Zurück
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>
              Weiter
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
