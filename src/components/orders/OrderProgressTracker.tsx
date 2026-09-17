import { Check } from "lucide-react";

import { formatDateTime } from "@/lib/money";
import {
  ORDER_PROGRESS_TIMELINE_STEPS,
  orderProgressTimelineState,
  type OrderProgressView,
} from "@/lib/orderProgress";
import { UI_TYPE } from "@/lib/design/tokens";
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
      <p className={cn(UI_TYPE.eyebrow, cancelled ? "text-destructive/80" : undefined)}>
        {cancelled ? "Storniert" : "Bestellfortschritt"}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-tight text-foreground sm:text-xl">{progress.statusLabel}</p>

      <div
        className="sr-only"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`Bestellfortschritt ${percent} Prozent`}
      />

      {cancelled ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {progress.comment || "Diese Bestellung wurde storniert."}
        </p>
      ) : (
        <ol className="mt-5" aria-label="Bestellfortschritt">
          {ORDER_PROGRESS_TIMELINE_STEPS.map((step, index) => {
            const state = orderProgressTimelineState(progress.statusKey, step.key);
            const isLast = index === ORDER_PROGRESS_TIMELINE_STEPS.length - 1;
            return (
              <li
                key={step.key}
                className="flex gap-3"
                aria-current={state === "current" ? "step" : undefined}
              >
                <div className="flex w-6 shrink-0 flex-col items-center">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
                      state === "complete" && "border-primary bg-primary text-primary-foreground",
                      state === "current" && "border-primary bg-background text-primary",
                      state === "upcoming" && "border-border bg-secondary/60 text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {state === "complete" ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    ) : (
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          state === "current" ? "bg-primary" : "bg-transparent",
                        )}
                      />
                    )}
                  </span>
                  {isLast ? null : (
                    <span
                      className={cn(
                        "mt-1 w-px flex-1 min-h-[1.15rem]",
                        state === "complete" ? "bg-primary/50" : "bg-border",
                      )}
                      aria-hidden
                    />
                  )}
                </div>
                <div className={cn("min-w-0 pb-4", isLast && "pb-0")}>
                  <p
                    className={cn(
                      "text-sm leading-snug",
                      state === "complete" && "font-medium text-foreground",
                      state === "current" && "font-semibold text-foreground",
                      state === "upcoming" && "text-muted-foreground",
                    )}
                  >
                    {step.title}
                  </p>
                  {state === "current" && progress.comment ? (
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{progress.comment}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {progress.updatedAt ? (
        <p className="mt-4 text-[11px] text-muted-foreground">Aktualisiert: {formatDateTime(progress.updatedAt)}</p>
      ) : null}
    </section>
  );
}
