import { formatDateTime } from "@/lib/money";
import type { OrderProgressView } from "@/lib/orderProgress";
import { cn } from "@/lib/utils";

export function OrderProgressTracker({
  progress,
  className,
  compact = true,
}: {
  progress: OrderProgressView;
  className?: string;
  compact?: boolean;
}) {
  const percent = progress.progressPercent;
  const cancelled = progress.isCancelled;
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border p-4 sm:p-5",
        compact && "mx-auto w-full max-w-[50rem]",
        cancelled
          ? "border-destructive/25 bg-gradient-to-br from-card via-card to-destructive/5"
          : "border-primary/20 bg-gradient-to-br from-card via-card to-primary/5",
        className,
      )}
    >
      <p
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[0.18em]",
          cancelled ? "text-destructive/80" : "text-primary/80",
        )}
      >
        {cancelled ? "Storniert" : "Bestellfortschritt"}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-tight text-foreground sm:text-xl">{progress.statusLabel}</p>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Fortschritt</span>
          <span
            className={cn(
              "font-mono text-sm font-semibold tabular-nums",
              cancelled ? "text-destructive" : "text-primary",
            )}
          >
            {percent} %
          </span>
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
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              cancelled
                ? "bg-destructive/70"
                : "bg-gradient-to-r from-primary/70 via-primary to-accent shadow-[0_0_18px_hsl(var(--primary)/0.45)]",
            )}
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
