import { formatDateTime } from "@/lib/money";
import type { OrderProgressView } from "@/lib/orderProgress";
import { cn } from "@/lib/utils";

export function OrderProgressTracker({
  progress,
  className,
}: {
  progress: OrderProgressView;
  className?: string;
}) {
  const percent = progress.progressPercent;
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:p-5",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">Bestellfortschritt</p>
      <p className="mt-2 text-lg font-semibold tracking-tight text-foreground sm:text-xl">{progress.statusLabel}</p>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Fortschritt</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-primary">{percent} %</span>
        </div>
        <div
          className="relative h-3 w-full overflow-hidden rounded-full bg-secondary/80 ring-1 ring-inset ring-border"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={`Bestellfortschritt ${percent} Prozent`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/70 via-primary to-accent shadow-[0_0_18px_hsl(var(--primary)/0.45)] transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      {progress.comment ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{progress.comment}</p>
      ) : null}
      {progress.updatedAt ? (
        <p className="mt-3 text-[11px] text-muted-foreground">Aktualisiert: {formatDateTime(progress.updatedAt)}</p>
      ) : null}
    </section>
  );
}
