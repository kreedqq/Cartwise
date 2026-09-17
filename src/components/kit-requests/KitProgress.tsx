import { cn } from "@/lib/utils";

interface KitProgressProps {
  /** Vials already allocated across all participants. */
  allocated: number;
  /** Total kit size in vials. */
  kitSize: number;
  /** Current kit status — drives colour selection. */
  status: "open" | "full" | "cancelled" | "expired" | "ordered";
  /** True when remaining is within the "almost full" threshold. */
  isAlmostFull?: boolean;
  /** True when exactly 1 slot remains. */
  isLastSpot?: boolean;
  className?: string;
}

/**
 * Visual Kit progress indicator.
 *
 * - For kits of ≤ 15 vials: segmented slot row (each slot = 1 vial).
 *   Instantly communicates "8 of 10 spots taken" at a social level.
 * - For larger kits: proportional bar + percentage label.
 *
 * All values come from real server data — no fake counts.
 */
export function KitProgress({
  allocated,
  kitSize,
  status,
  isAlmostFull = false,
  isLastSpot = false,
  className,
}: KitProgressProps) {
  const percent =
    kitSize > 0 ? Math.min(100, Math.round((allocated / kitSize) * 100)) : 0;

  // Colour applied to filled slots / bar fill
  const fillCn = cn(
    status === "full"
      ? "bg-success"
      : isLastSpot || isAlmostFull
        ? "bg-warning"
        : "bg-primary",
  );

  // Label colour
  const labelCn = cn(
    "text-sm font-semibold tabular-nums leading-none",
    status === "full"
      ? "text-success"
      : isLastSpot || isAlmostFull
        ? "text-warning"
        : "text-foreground",
  );

  /* ── Slot view (≤ 15 vials) ─────────────────────────────────────────── */
  if (kitSize <= 15) {
    return (
      <div className={cn("space-y-2", className)}>
        {/* Segment row — each segment represents one vial slot */}
        <div
          className="flex gap-[3px]"
          role="progressbar"
          aria-valuenow={allocated}
          aria-valuemin={0}
          aria-valuemax={kitSize}
          aria-label={`${allocated} von ${kitSize} Vials vergeben`}
        >
          {Array.from({ length: kitSize }, (_, i) => (
            <div
              key={i}
              className={cn(
                "h-2.5 min-w-0 flex-1 rounded-sm transition-colors",
                i < allocated
                  ? fillCn
                  : "border border-border/50 bg-secondary/60",
              )}
            />
          ))}
        </div>

        {/* Fraction label */}
        <p className={labelCn}>
          {allocated} / {kitSize}
          <span className="ml-1.5 text-xs font-medium text-muted-foreground">
            Kits
          </span>
        </p>
      </div>
    );
  }

  /* ── Bar view (> 15 vials) ──────────────────────────────────────────── */
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className={labelCn}>
          {allocated} / {kitSize}
          <span className="ml-1.5 text-xs font-medium text-muted-foreground">
            Kits
          </span>
        </p>
        <span className="text-xs tabular-nums text-muted-foreground">
          {percent}&thinsp;%
        </span>
      </div>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${allocated} von ${kitSize} Vials vergeben`}
      >
        <div
          className={cn("h-full rounded-full transition-[width]", fillCn)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
