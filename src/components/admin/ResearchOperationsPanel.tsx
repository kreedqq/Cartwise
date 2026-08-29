import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildPublicLexiconV2Catalog } from "@/lib/peptide/lexiconV2/publicCatalog";
import { LEXICON_V2_CATEGORY_FILTERS } from "@/lib/peptide/lexiconV2/publicTypes";
import {
  OPERATIONS_MIGRATION_REQUIRED,
  OPERATIONS_PRODUCTION_WRITE,
  REDDIT_CONNECTOR_STATUS,
  communityCannotRaiseScientificEvidence,
} from "@/lib/peptide/research/operations";
import { AVAILABLE_SCIENTIFIC_CONNECTORS, engineAdminCapabilities, lexiconUpdateProfileCount } from "@/lib/peptide/research/updateEngine";
import type { OperationsAction, OperationsRunRecord } from "@/lib/peptide/research/operations/types";
import type { ScientificConnectorId } from "@/lib/peptide/research/updateEngine/types";
import type { ShopCoverageCategory } from "@/lib/peptide/shopCoverage/types";
import {
  useAdminConnectorHealth,
  useAdminResearchRuns,
  useCancelAdminResearchRun,
  useRetryAdminResearchRun,
} from "@/hooks/useResearchOperations";
import { startAdminResearchRun } from "@/services/researchOperations";

const LEXICON_PROFILE_COUNT = lexiconUpdateProfileCount();

export function ResearchOperationsPanel() {
  const caps = engineAdminCapabilities();
  const catalog = React.useMemo(() => buildPublicLexiconV2Catalog(), []);
  const profileOptions = React.useMemo(
    () => [...catalog.entries].sort((left, right) => left.displayNameDe.localeCompare(right.displayNameDe, "de")),
    [catalog.entries],
  );

  const [page, setPage] = React.useState(0);
  const [substance, setSubstance] = React.useState("retatrutide");
  const [connector, setConnector] = React.useState<ScientificConnectorId>("pubmed");
  const [category, setCategory] = React.useState<ShopCoverageCategory>("PEPTIDES");
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
        substanceSlug: action === "update-all" || action === "update-connector" || action === "update-category" ? undefined : substance,
        connector: action === "update-all" || action === "update-substance" || action === "update-category" ? undefined : connector,
        category: action === "update-category" ? category : undefined,
        onProgress: setActive,
      });
      setActive(result.run);
      const s = result.run.statistics;
      setMessage(
        `Scope: ${result.run.scope.substanceSlugs.length} Profile · Sources checked: ${s.sourcesQueried} · New: ${s.sourcesNew} · Updated: ${s.sourcesUpdated} · Unchanged: ${s.sourcesUnchanged} · Duplicate: ${s.sourcesDuplicate} · Review required: ${s.reviewRequired}${result.postgres.ok ? " · Postgres saved" : ` · Session only (${result.postgres.message ?? "no schema"})`}`,
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
          Update All Lexikon = {LEXICON_PROFILE_COUNT} eindeutig identifizierte Profile × verfügbare Scientific Connectors.
          Nicht Shop-Produkte. REVIEW_REQUIRED/UNKNOWN ausgeschlossen. Kein Auto-Approve.
          Cron {caps.cronEnabled ? "an" : "aus"}. Claims/Evidence/Regulatory-Write {OPERATIONS_PRODUCTION_WRITE ? "an" : "aus"}.
          Runs werden nach 0031 in Postgres gespeichert. MIGRATION_REQUIRED: {OPERATIONS_MIGRATION_REQUIRED}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="text-sm">
          Lexikonprofil
          <select
            className="ml-2 max-w-xs rounded-md border border-border bg-background px-2 py-1"
            value={substance}
            onChange={(event) => setSubstance(event.target.value)}
          >
            {profileOptions.map((row) => (
              <option key={row.slug} value={row.slug}>
                {row.displayNameDe}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Kategorie
          <select
            className="ml-2 rounded-md border border-border bg-background px-2 py-1"
            value={category}
            onChange={(event) => setCategory(event.target.value as ShopCoverageCategory)}
          >
            {LEXICON_V2_CATEGORY_FILTERS.filter((row) => row.id !== "all").map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
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
          Update All Lexikon
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void run("update-substance")}>
          Update Profil
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void run("update-category")}>
          Update Kategorie
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void run("update-connector")}>
          Update Connector
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void run("update-combined")}>
          Profil + Connector
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
            Scope {active.scope.substanceSlugs.length} Profile · Checked {active.statistics.sourcesQueried} · New{" "}
            {active.statistics.sourcesNew} · Updated {active.statistics.sourcesUpdated} · Unchanged{" "}
            {active.statistics.sourcesUnchanged} · Duplicate {active.statistics.sourcesDuplicate} · Review required{" "}
            {active.statistics.reviewRequired}
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
          {communityCannotRaiseScientificEvidence() ? "yes" : "no"}. Keine automatischen Community-Imports.
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
                    <td className="py-1">{row.scope.substanceSlugs.length} Profile</td>
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
