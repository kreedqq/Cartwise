import { ExternalLink } from "lucide-react";

import { formatDateTime } from "@/lib/money";
import {
  hasTrackingNumber,
  trackingCarrierLabel,
  type OrderTrackingFields,
} from "@/lib/tracking";
import { cn } from "@/lib/utils";

export function OrderTrackingCard({
  tracking,
  className,
  compact = true,
}: {
  tracking: Pick<
    OrderTrackingFields,
    "tracking_number" | "tracking_carrier" | "tracking_url" | "tracking_assigned_at"
  >;
  className?: string;
  compact?: boolean;
}) {
  if (!hasTrackingNumber(tracking)) return null;
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:p-5",
        compact && "mx-auto w-full max-w-[50rem]",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">Sendungsverfolgung</p>
      <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">
        {trackingCarrierLabel(tracking.tracking_carrier)}
      </p>
      <p className="mt-1 font-mono text-sm tracking-wide text-foreground">{tracking.tracking_number}</p>
      {tracking.tracking_assigned_at ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Zugewiesen: {formatDateTime(tracking.tracking_assigned_at)}
        </p>
      ) : null}
      {tracking.tracking_url ? (
        <a
          href={tracking.tracking_url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
        >
          <ExternalLink className="h-4 w-4" />
          Sendung verfolgen
        </a>
      ) : null}
    </section>
  );
}
