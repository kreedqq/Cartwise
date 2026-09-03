import { Badge } from "@/components/ui/badge";
import type { SharedKitAdminView } from "@/lib/kitOrderSummary";

export function SharedKitAdminCard({ kit }: { kit: SharedKitAdminView }) {
  return (
    <div className="space-y-3 px-4 py-4">
      <div>
        <p className="text-sm font-semibold">{kit.productName}</p>
        <p className="text-xs text-muted-foreground">Kit Größe: {kit.kitSize} Stück</p>
      </div>
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Teilnehmer</p>
        <ul className="space-y-2">
          {kit.participants.map((participant) => (
            <li
              key={`${kit.kitShareId}-${participant.userId}`}
              className={
                participant.isCurrentOrder
                  ? "rounded-md border border-primary/30 bg-primary/5 px-3 py-2"
                  : "rounded-md border border-border px-3 py-2"
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{participant.telegramLabel}</p>
                  <p className="text-xs text-muted-foreground sm:hidden">{participant.shareLabel}</p>
                  <p className="text-xs text-muted-foreground sm:hidden">{participant.statusLabel}</p>
                </div>
                <div className="hidden items-center gap-3 text-sm sm:flex">
                  <span className="tabular-nums">{participant.shareLabel}</span>
                  <span>{participant.statusLabel}</span>
                </div>
                {participant.isCurrentOrder && (
                  <Badge variant="secondary" className="text-[10px]">
                    aktuelle Bestellung
                  </Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-sm">
        Kit Fortschritt: <span className="font-medium">{kit.progressLabel}</span>
        {kit.complete ? <span className="ml-2 font-medium text-primary">Kit vollständig</span> : null}
      </p>
    </div>
  );
}
