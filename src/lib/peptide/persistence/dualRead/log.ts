import type { DualReadReport } from "@/lib/peptide/persistence/dualRead/types";

const SECRET_PATTERN = /service_role|anon_key|jwt|bearer\s+[a-z0-9._-]+|password|token/i;

function sanitize(value: string): string {
  return SECRET_PATTERN.test(value) ? "[redacted]" : value;
}

/** Structured dual-read log. Never includes secrets, tokens, or personal data. */
export function logDualReadReport(report: DualReadReport): void {
  const payload = {
    source: "peptide-dual-read",
    mode: report.mode,
    displaySource: report.displaySource,
    verdict: report.verdict,
    fallback: report.fallback,
    criticalCount: report.criticalCount,
    counts: report.counts,
    totals: report.totals,
    critical: report.differences
      .filter((row) => row.critical)
      .slice(0, 50)
      .map((row) => ({
        family: row.family,
        status: row.status,
        key: sanitize(row.key),
        note: sanitize(row.note),
      })),
  };
  if (report.fallback) {
    console.warn("[peptide-dual-read]", payload);
    return;
  }
  if (report.criticalCount > 0) {
    console.warn("[peptide-dual-read]", payload);
    return;
  }
  console.info("[peptide-dual-read]", payload);
}
