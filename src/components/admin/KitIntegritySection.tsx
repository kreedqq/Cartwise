import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

import { AdminSection } from "@/components/admin/AdminSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  kitReconcileIssueLabel,
  kitReconcileOverallLabel,
  kitReconcileParticipantStatusLabel,
  type KitReconcileReport,
} from "@/lib/kit/kitReconciliation";

function creatorHandle(username: string): string {
  const trimmed = username.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : "Unbekannt";
}

function formatCheckedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

function quantityDelta(participant: number, cart: number): number | null {
  if (participant === cart) return null;
  return participant - cart;
}

/** After checkout the cart line is often cleared while the order snapshot keeps the share. */
function participantCartDeltaIsExpected(row: KitReconcileReport["participants"][number]): boolean {
  if (row.status === "HEALTHY") return true;
  if (!row.orderId) return false;
  if (row.orderSnapshotQuantity == null) return false;
  return row.orderSnapshotQuantity === row.participantQuantity && row.cartQuantity === 0;
}

export function KitIntegritySection({
  report,
  loading,
  error,
  onRetry,
  kitSize,
  allocatedTotal,
  participantCount,
}: {
  report: KitReconcileReport | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  kitSize: number;
  allocatedTotal: number;
  participantCount: number;
}) {
  const healthy = report?.overallStatus === "HEALTHY";
  const needsAttention = report?.reconciliationRequired === true;

  return (
    <AdminSection
      title="Kit Integrität"
      description="Read-only Prüfung von Allocation, Warenkörben und Bestellbezug. Es werden keine Daten automatisch geändert."
      padded
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}

      {error ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-destructive">Integritätsprüfung konnte nicht geladen werden.</p>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Erneut prüfen
          </Button>
        </div>
      ) : null}

      {!loading && !error && report ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {healthy && !needsAttention ? (
              <Badge className="gap-1 bg-emerald-600/10 text-emerald-800 hover:bg-emerald-600/10 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                {kitReconcileOverallLabel(report.overallStatus)}
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                {kitReconcileOverallLabel(report.overallStatus)}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">
              Allocation {allocatedTotal} / {kitSize} · {participantCount} Teilnehmer
            </span>
            <span className="text-xs text-muted-foreground">
              Letzte Prüfung: {formatCheckedAt(report.checkedAt)}
            </span>
          </div>

          {healthy && !needsAttention ? (
            <p className="text-sm text-muted-foreground">
              {report.healthyParticipantCount} von {report.participantCount} Teilnehmer-Warenkörben synchron.
              Keine Abweichungen erkannt.
            </p>
          ) : (
            <div
              className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm"
              role="alert"
            >
              <p className="font-medium text-foreground">Synchronisationsabweichung</p>
              <p className="mt-1 text-muted-foreground">
                Keine automatische Änderung durchgeführt. Bitte manuell prüfen oder bestehende Admin-Sync nutzen.
              </p>
            </div>
          )}

          <ul className="space-y-2">
            {report.participants.map((row) => {
              const delta = quantityDelta(row.participantQuantity, row.cartQuantity);
              const warn = row.status !== "HEALTHY";
              return (
                <li
                  key={row.userId}
                  className="rounded-lg border border-border px-3 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{creatorHandle(row.username)}</span>
                    <Badge variant={warn ? "destructive" : "secondary"}>
                      {kitReconcileParticipantStatusLabel(row.status)}
                    </Badge>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                    <div>
                      <dt className="text-muted-foreground">Teilnehmer</dt>
                      <dd className="font-medium tabular-nums">{row.participantQuantity} Kit</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Warenkorb</dt>
                      <dd className="font-medium tabular-nums">{row.cartQuantity} Kit</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Zeilen</dt>
                      <dd className="font-medium tabular-nums">{row.cartLineCount}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Bestellung</dt>
                      <dd>
                        {row.orderId ? (
                          <Link to={`/admin/orders/${row.orderId}`} className="text-primary underline-offset-2 hover:underline">
                            Öffnen
                          </Link>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                  </dl>
                  {delta != null && delta !== 0 && !participantCartDeltaIsExpected(row) ? (
                    <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                      Abweichung: {Math.abs(delta)} Kit {delta > 0 ? "fehlen im Warenkorb" : "zu viel im Warenkorb"}
                    </p>
                  ) : null}
                  {delta != null &&
                  delta !== 0 &&
                  participantCartDeltaIsExpected(row) &&
                  row.orderId ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Anteil bestellt ({row.orderSnapshotQuantity} Kit) — Warenkorb leer nach Checkout.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {report.issues.filter((i) => i.severity === "warning" || i.severity === "error").length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Details</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {report.issues
                  .filter((issue) => issue.severity === "warning" || issue.severity === "error")
                  .map((issue, index) => (
                    <li key={`${issue.code}-${index}`}>
                      {kitReconcileIssueLabel(issue.code)}
                      {issue.participantQuantity != null && issue.cartQuantity != null
                        ? ` (${issue.participantQuantity} vs ${issue.cartQuantity})`
                        : null}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </AdminSection>
  );
}
