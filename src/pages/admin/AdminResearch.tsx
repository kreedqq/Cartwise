import * as React from "react";

import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ResearchOperationsPanel } from "@/components/admin/ResearchOperationsPanel";
import { DualReadDebug } from "@/components/admin/DualReadDebug";
import { useDualRead } from "@/hooks/useDualRead";
import {
  useAdminProductMappings,
  useAdminResearchDashboard,
  useAdminReviewDetail,
  useAdminReviewQueue,
  useSubmitAdminReview,
} from "@/hooks/useAdminResearch";
import {
  ADMIN_RESEARCH_PAGE_SIZE,
  ADMIN_REVIEW_ACTIONS,
  legacyAdminFallbackDashboard,
  legacyAdminFallbackQueue,
  type AdminReviewAction,
  type ReviewQueueKind,
} from "@/lib/peptide/adminResearch";
import { connectorHealthReport } from "@/research/connectors";
import { RESEARCH_PIPELINE } from "@/research/engine";

const QUEUE_TABS: Array<{ id: ReviewQueueKind | "mapping"; label: string }> = [
  { id: "source", label: "Sources" },
  { id: "study", label: "Studies" },
  { id: "evidence", label: "Evidence Review" },
  { id: "regulatory", label: "Regulatory Review" },
  { id: "claim", label: "Claims" },
  { id: "substance", label: "Review Queue" },
  { id: "mapping", label: "Product Mapping" },
];

export default function AdminResearchPage() {
  const [rows, setRows] = React.useState<Array<{ id: string; label: string; kind: string; health: string }>>([]);
  const [tab, setTab] = React.useState<ReviewQueueKind | "mapping">("substance");
  const [page, setPage] = React.useState(0);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [useLegacy, setUseLegacy] = React.useState(false);

  function selectTab(next: ReviewQueueKind | "mapping") {
    setTab(next);
    setPage(0);
    setSelectedId(null);
  }
  const dualRead = useDualRead();
  const dashboardQuery = useAdminResearchDashboard();
  const queueKind: ReviewQueueKind = tab === "mapping" ? "substance" : tab;
  const queueQuery = useAdminReviewQueue(queueKind, page);
  const mappingsQuery = useAdminProductMappings(page);
  const detailQuery = useAdminReviewDetail(tab === "mapping" ? null : queueKind, selectedId);

  React.useEffect(() => {
    document.title = "Research Queue | Peptix Admin";
    void connectorHealthReport().then(setRows);
  }, []);

  const postgresFailed = dashboardQuery.isError;
  const dashboard = useLegacy ? legacyAdminFallbackDashboard() : dashboardQuery.data;
  const fallbackActive = useLegacy;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Research"
        title="Research Queue"
        description="Postgres ist die Admin-Quelle. Das öffentliche Lexikon liest Postgres; catalog.ts + published.json sind der exklusive Fallback. Run-History liegt nach 0031 in Postgres. Community bleibt getrennt und default review-required. Kein Cron, kein Auto-Approve."
      />

      {postgresFailed && !useLegacy ? (
        <ErrorState
          message="Postgres Research ist nicht erreichbar. Du kannst einen gekennzeichneten Legacy-Fallback nutzen."
          onRetry={() => void dashboardQuery.refetch()}
        />
      ) : null}
      {postgresFailed ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setUseLegacy(true)}>
          Legacy-Fallback anzeigen (published.json)
        </Button>
      ) : null}
      {fallbackActive ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          Legacy-Fallback aktiv — nicht Source of Truth. Postgres bleibt Primary.
        </p>
      ) : null}

      <ResearchOperationsPanel />

      {dashboard ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total Sources" value={dashboard.sources} />
          <Stat label="Total Studies" value={dashboard.studies} />
          <Stat label="Total Claims" value={dashboard.claims} />
          <Stat
            label="Review Required"
            value={
              dashboard.claimsReviewRequired +
              dashboard.evidenceReviewRequired +
              dashboard.regulatoryReviewRequired +
              dashboard.sourcesReviewRequired +
              dashboard.studiesReviewRequired
            }
          />
          <Stat label="Approved" value={dashboard.claimsApproved} />
          <Stat label="Rejected" value={dashboard.claimsRejected} />
          <Stat label="Evidence Review" value={dashboard.evidenceReviewRequired} />
          <Stat label="Regulatory Review" value={dashboard.regulatoryReviewRequired} />
          <Stat label="Source Review" value={dashboard.sourcesReviewRequired} />
          <Stat label="Study Review" value={dashboard.studiesReviewRequired} />
          <Stat label="Community Updates" value={0} />
          <Stat label="Research Updates" value={dashboard.researchUpdates} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Lade Research-Zähler aus Postgres…</p>
      )}

      {dashboard?.migrationRequired ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          MIGRATION_REQUIRED: {dashboard.migrationRequired}. Batch-03-Kandidaten sind lokal sichtbar, nicht persistiert
          und nicht öffentlich. Keine automatische Freigabe.
        </p>
      ) : null}

      {dualRead.data ? <DualReadDebug report={dualRead.data} /> : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Connector Health</h2>
        <p className="text-sm text-muted-foreground">
          Browser-Connectoren bleiben ohne Secrets. Live-Browser-Abrufe finden nicht statt.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Connector</th>
                <th className="px-3 py-2 font-medium">Typ</th>
                <th className="px-3 py-2 font-medium">Live client</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="px-3 py-2">{row.label}</td>
                  <td className="px-3 py-2 capitalize">{row.kind}</td>
                  <td className="px-3 py-2">
                    <Badge variant="warning">{row.health}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {QUEUE_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectTab(item.id)}
              className={
                tab === item.id
                  ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                  : "rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "mapping" ? (
          <MappingTable page={page} query={mappingsQuery} onPage={setPage} />
        ) : fallbackActive ? (
          <LegacyQueueList />
        ) : (
          <QueueTable
            kind={queueKind}
            page={page}
            query={queueQuery}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onPage={setPage}
          />
        )}
      </section>

      {tab !== "mapping" && selectedId && detailQuery.data ? (
        <ReviewDetail
          detail={detailQuery.data}
          onDone={() => {
            setSelectedId(null);
            void queueQuery.refetch();
            void dashboardQuery.refetch();
          }}
        />
      ) : null}

      <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        {RESEARCH_PIPELINE.map((step) => (
          <li key={step.id}>
            {step.label} · {step.lane}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LegacyQueueList() {
  const items = legacyAdminFallbackQueue();
  return (
    <ul className="space-y-2 text-sm">
      {items.map((item) => (
        <li key={item.stableKey} className="rounded-lg border border-border/70 px-3 py-2">
          <span className="font-medium">{item.substanceSlug}</span>
          {" · "}
          {item.title}
          <span className="mt-1 block text-xs text-muted-foreground">{item.note}</span>
        </li>
      ))}
    </ul>
  );
}

function QueueTable({
  kind,
  page,
  query,
  selectedId,
  onSelect,
  onPage,
}: {
  kind: ReviewQueueKind;
  page: number;
  query: ReturnType<typeof useAdminReviewQueue>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPage: (page: number) => void;
}) {
  if (query.isError) {
    return <ErrorState message="Review-Queue konnte nicht geladen werden." onRetry={() => void query.refetch()} />;
  }
  const data = query.data;
  if (!data) return <p className="text-sm text-muted-foreground">Lade Queue…</p>;
  if (data.items.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine offenen {kind}-Einträge in Postgres.</p>;
  }
  const lastPage = Math.max(0, Math.ceil(data.total / ADMIN_RESEARCH_PAGE_SIZE) - 1);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {data.total} Einträge · Seite {page + 1} · Postgres
      </p>
      <ul className="space-y-2 text-sm">
        {data.items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={
                selectedId === item.id
                  ? "w-full rounded-lg border border-primary px-3 py-2 text-left"
                  : "w-full rounded-lg border border-border/70 px-3 py-2 text-left hover:border-primary/40"
              }
            >
              <span className="font-medium">{item.substanceSlug || item.stableKey}</span>
              {" · "}
              <Badge variant="outline">{item.status}</Badge>
              <span className="mt-1 block text-xs text-muted-foreground">{item.title.slice(0, 220)}</span>
            </button>
          </li>
        ))}
      </ul>
      <Pager page={page} lastPage={lastPage} onPage={onPage} />
    </div>
  );
}

function MappingTable({
  page,
  query,
  onPage,
}: {
  page: number;
  query: ReturnType<typeof useAdminProductMappings>;
  onPage: (page: number) => void;
}) {
  if (query.isError) {
    return <ErrorState message="Product mapping konnte nicht geladen werden." onRetry={() => void query.refetch()} />;
  }
  const data = query.data;
  if (!data) return <p className="text-sm text-muted-foreground">Lade Mapping…</p>;
  const lastPage = Math.max(0, Math.ceil(data.total / ADMIN_RESEARCH_PAGE_SIZE) - 1);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Nur Artikelcode und Substanz. Keine Preise, kein Warenkorb.</p>
      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Substance</th>
              <th className="px-3 py-2 font-medium">Method</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.id} className="border-t border-border/60">
                <td className="px-3 py-2 font-medium">{row.code}</td>
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2">{row.substanceSlug}</td>
                <td className="px-3 py-2">{row.mappingMethod}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} lastPage={lastPage} onPage={onPage} />
    </div>
  );
}

function ReviewDetail({
  detail,
  onDone,
}: {
  detail: NonNullable<ReturnType<typeof useAdminReviewDetail>["data"]>;
  onDone: () => void;
}) {
  const submit = useSubmitAdminReview();
  const [reason, setReason] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);

  async function run(action: AdminReviewAction) {
    setMessage(null);
    try {
      await submit.mutateAsync({
        kind: detail.kind,
        id: detail.id,
        stableKey: detail.stableKey,
        action,
        previousStatus: detail.status,
        reason,
      });
      setReason("");
      setMessage(`${action} gespeichert.`);
      onDone();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review fehlgeschlagen.");
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
      <h2 className="text-base font-semibold">Review-Details</h2>
      <p className="text-sm">
        <span className="font-medium">{detail.substanceName || detail.substanceSlug}</span>
        {detail.claimType ? ` · ${detail.claimType}` : ""}
        {detail.evidenceLevel ? ` · Evidence ${detail.evidenceLevel}` : ""}
        {detail.authority ? ` · ${detail.authority} ${detail.region}` : ""}
      </p>
      {detail.statement ? <p className="text-sm text-muted-foreground">{detail.statement}</p> : null}
      {detail.url ? (
        <p className="text-sm">
          <a className="text-primary hover:underline" href={detail.url} target="_blank" rel="noreferrer">
            {detail.url}
          </a>
        </p>
      ) : null}
      {detail.identifier || detail.sourceType || detail.connector || detail.publicationDate ? (
        <p className="text-sm text-muted-foreground">
          {[
            detail.identifier,
            detail.sourceType,
            detail.publisher,
            detail.publicationDate,
            detail.connector,
            detail.pmid ? `PMID ${detail.pmid}` : null,
            detail.doi,
            detail.nctId,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
      {detail.kind === "study" || detail.intervention || detail.condition ? (
        <p className="text-sm text-muted-foreground">
          {[
            detail.nctId,
            detail.sponsor,
            detail.intervention ? `Intervention: ${detail.intervention}` : null,
            detail.condition ? `Condition: ${detail.condition}` : null,
            detail.phase,
            detail.studyStatus,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
      {detail.persisted === false ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          Nicht persistiert. Approve/Reject sind deaktiviert, bis Migration 0030 angewendet und der Import geschrieben
          ist.
        </p>
      ) : null}
      {detail.regulatoryStatus ? (
        <p className="text-sm text-muted-foreground">
          Regulatory status: {detail.regulatoryStatus}
          {detail.productName ? ` · ${detail.productName}` : ""}
          {detail.applicationId ? ` · ${detail.applicationId}` : ""}
          {detail.isCurrent === false ? " · not current" : ""}
        </p>
      ) : null}
      {detail.confidence ? <p className="text-xs text-muted-foreground">Confidence: {detail.confidence}</p> : null}
      {detail.rationale ? <p className="text-xs text-muted-foreground">{detail.rationale}</p> : null}

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Sources</h3>
        {detail.sources.length === 0 ? (
          <p className="text-sm text-destructive">Keine Source — Aussage nicht rückverfolgbar.</p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {detail.sources.map((source) => (
              <li key={source.id}>
                <a className="text-primary hover:underline" href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
                <span className="block text-xs text-muted-foreground">
                  {[source.sourceType, source.pmid ? `PMID ${source.pmid}` : null, source.nctId, source.doi]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {detail.studies.length > 0 ? (
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Studies</h3>
          <ul className="text-sm text-muted-foreground">
            {detail.studies.map((study) => (
              <li key={study.nctId}>
                {study.nctId} · {study.title}
                <span className="block text-xs">
                  {[study.phase, study.status, study.sponsor].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Begründung (pflicht)"
        aria-label="Review-Begründung"
      />
      <div className="flex flex-wrap gap-2">
        {ADMIN_REVIEW_ACTIONS.map((action) => (
          <Button
            key={action}
            type="button"
            size="sm"
            variant={action === "reject" ? "destructive" : "outline"}
            disabled={submit.isPending || reason.trim().length === 0 || detail.persisted === false}
            onClick={() => void run(action)}
          >
            {action}
          </Button>
        ))}
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </section>
  );
}

function Pager({ page, lastPage, onPage }: { page: number; lastPage: number; onPage: (page: number) => void }) {
  if (lastPage <= 0) return null;
  return (
    <div className="flex gap-2">
      <Button type="button" size="sm" variant="outline" disabled={page <= 0} onClick={() => onPage(page - 1)}>
        Zurück
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>
        Weiter
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
