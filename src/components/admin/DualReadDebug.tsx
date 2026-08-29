import type { DualReadReport } from "@/lib/peptide/persistence/dualRead/types";

export function DualReadDebug({ report }: { report: DualReadReport }) {
  const critical = report.differences.filter((row) => row.critical);
  const unresolved = report.differences.filter((row) => row.status === "UNRESOLVED");
  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
      <div>
        <h2 className="text-base font-semibold">Dual Read (Admin)</h2>
        <p className="text-sm text-muted-foreground">
          {report.mode === "legacy"
            ? "Notfall: öffentliches Lexikon liest nur Dateien (catalog.ts + published.json). Mode: legacy."
            : report.mode === "dual"
              ? "Dual: Legacy und Postgres werden nur verglichen. Public UI mischt nie — Postgres exklusiv, oder kompletter Datei-Fallback. Mode: dual."
              : `Öffentliches Lexikon: Postgres Primary. Dateien (catalog.ts + published.json) nur als exklusiver Fallback, nie gemischt im selben Request. Mode: ${report.mode}.`}
        </p>
      </div>
      <p className="text-sm">
        Verdict: <span className="font-medium">{report.verdict}</span>
        {report.fallback ? ` · Fallback ${report.fallback}` : ""}
        {` · critical ${report.criticalCount}`}
      </p>
      <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
        <div>MATCH {report.counts.MATCH}</div>
        <div>ORDER_ONLY {report.counts.ORDER_ONLY}</div>
        <div>FORMAT_ONLY {report.counts.FORMAT_ONLY}</div>
        <div>UNRESOLVED {report.counts.UNRESOLVED}</div>
        <div>MISSING {report.counts.MISSING}</div>
        <div>EXTRA {report.counts.EXTRA}</div>
        <div>DIFFERENT {report.counts.DIFFERENT}</div>
        <div>Community {report.totals.communityReports}</div>
      </dl>
      {critical.length > 0 ? (
        <ul className="space-y-1 text-xs text-destructive">
          {critical.slice(0, 20).map((row) => (
            <li key={`${row.family}:${row.key}`}>
              {row.family} · {row.status} · {row.key}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Keine kritischen Differenzen in diesem Lauf.</p>
      )}
      {unresolved.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          UNRESOLVED {unresolved.length} (u. a. hcg:ema-ovitrelle, semaglutide oral DailyMed, unmapped SKUs).
        </p>
      ) : null}
    </section>
  );
}
