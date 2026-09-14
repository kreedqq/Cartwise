import { formatDateTime, formatUsd } from "@/lib/money";
import type { Tables } from "@/types/database";

export function OrderRevisionHistory({
  order,
  revisions,
  originalTotalUsd,
  adminNamesById,
}: {
  order: Pick<Tables<"orders">, "submitted_at" | "total_usd" | "revision_number">;
  revisions: Tables<"order_revisions">[];
  originalTotalUsd: number;
  adminNamesById?: Record<string, string | null>;
}) {
  const sorted = [...revisions].sort((a, b) => a.revision_number - b.revision_number);

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-md border border-border px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Originalbestellung</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(order.submitted_at)}</p>
        <p className="tabular-nums font-medium">{formatUsd(originalTotalUsd)}</p>
      </div>
      {sorted.map((rev) => (
        <div key={rev.id} className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
          <p className="text-xs font-semibold text-foreground">Revision {rev.revision_number}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(rev.created_at)}
            {rev.created_by && adminNamesById?.[rev.created_by]
              ? ` · Admin @${adminNamesById[rev.created_by]}`
              : null}
          </p>
          <p className="text-xs text-muted-foreground">{rev.reason}</p>
          <p className="tabular-nums">
            {formatUsd(rev.previous_total_usd)} → {formatUsd(rev.new_total_usd)} (
            {rev.difference_usd >= 0 ? "+" : ""}
            {formatUsd(rev.difference_usd)})
          </p>
        </div>
      ))}
      {sorted.length === 0 && order.revision_number === 0 ? (
        <p className="text-xs text-muted-foreground">Noch keine Korrekturen.</p>
      ) : null}
    </div>
  );
}
