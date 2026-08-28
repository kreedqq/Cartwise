import * as React from "react";

import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { PEPTIDE_SUBSTANCES } from "@/lib/peptide/catalog";
import { formatReviewedDate, listPublishedProfiles, publishedSourceCount, researchReports } from "@/lib/peptide/profiles";
import { connectorHealthReport } from "@/research/connectors";
import { RESEARCH_PIPELINE } from "@/research/engine";

export default function AdminResearchPage() {
  const [rows, setRows] = React.useState<Array<{ id: string; label: string; kind: string; health: string }>>([]);
  const reports = researchReports();
  const published = listPublishedProfiles();

  React.useEffect(() => {
    document.title = "Research Queue | Peptix Admin";
    void connectorHealthReport().then(setRows);
  }, []);

  const incomplete = PEPTIDE_SUBSTANCES.filter((item) => item.reviewStatus === "incomplete").length;
  const reviewRequired = PEPTIDE_SUBSTANCES.filter(
    (item) => item.reviewStatus === "review-required" || item.reviewStatus === "review-recommended",
  ).length;
  const fresh = PEPTIDE_SUBSTANCES.filter((item) => item.reviewStatus === "fresh").length;
  const reviewQueue = published.flatMap((profile) =>
    (profile.reviewItems ?? []).map((item) => ({ slug: profile.slug, ...item })),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Research"
        title="Research Queue"
        description="Geprüfte Quellen aus offiziellen APIs (Stand Cache). Community bleibt unavailable. Live-Browser-Abrufe finden nicht statt."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Substances" value={PEPTIDE_SUBSTANCES.length} />
        <Stat label="Fresh Profiles" value={fresh} />
        <Stat label="Review Required" value={reviewRequired + incomplete} />
        <Stat label="Sources" value={publishedSourceCount()} />
        <Stat label="Published profiles" value={published.length} />
        <Stat label="New Clinical Trials" value={published.reduce((sum, p) => sum + p.researchReport.clinicalTrials, 0)} />
        <Stat label="Regulatory Updates" value={0} />
        <Stat label="Community Updates" value={0} />
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Connector Health</h2>
        <p className="text-sm text-muted-foreground">
          Browser-Connectoren bleiben ohne Secrets. Der Batch vom {formatReviewedDate(published[0]?.lastResearchScanAt)} hat
          ClinicalTrials.gov, PubMed und openFDA serverseitig abgefragt.
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
        <h2 className="text-base font-semibold">Research Reports</h2>
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Substance</th>
                <th className="px-3 py-2 font-medium">FDA</th>
                <th className="px-3 py-2 font-medium">EMA</th>
                <th className="px-3 py-2 font-medium">Trials</th>
                <th className="px-3 py-2 font-medium">PubMed</th>
                <th className="px-3 py-2 font-medium">Community</th>
                <th className="px-3 py-2 font-medium">Last research</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((row) => (
                <tr key={row.slug} className="border-t border-border/60">
                  <td className="px-3 py-2 font-medium">{row.slug}</td>
                  <td className="px-3 py-2">{row.fda}</td>
                  <td className="px-3 py-2">{row.ema}</td>
                  <td className="px-3 py-2 tabular-nums">{row.clinicalTrials}</td>
                  <td className="px-3 py-2 tabular-nums">{row.pubmed}</td>
                  <td className="px-3 py-2">{row.community}</td>
                  <td className="px-3 py-2">{formatReviewedDate(row.lastResearch)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Review Queue</h2>
        <p className="text-sm text-muted-foreground">
          Der erste und zweite Research-Batch sind als published kuratiert. Neue Live-Funde bleiben Draft, bis sie geprüft sind.
        </p>
        {reviewQueue.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine offenen Review-Punkte in den veröffentlichten Profilen.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {reviewQueue.map((item) => (
              <li key={`${item.slug}-${item.id}`} className="rounded-lg border border-border/70 px-3 py-2">
                <span className="font-medium">{item.slug}</span>
                {" · "}
                <Badge variant={item.priority === "High" ? "warning" : "outline"}>{item.priority}</Badge>
                {" · "}
                {item.topic}
                <span className="mt-1 block text-xs text-muted-foreground">{item.note}</span>
              </li>
            ))}
          </ul>
        )}
        <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          {RESEARCH_PIPELINE.map((step) => (
            <li key={step.id}>
              {step.label} · {step.lane}
            </li>
          ))}
        </ul>
      </section>
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
