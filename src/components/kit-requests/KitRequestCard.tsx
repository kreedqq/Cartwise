import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import {
  kitRequestCustomerStatusLabel,
  kitRequestProgressPercent,
} from "@/lib/kitRequests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { KitRequestCard } from "@/services/kitRequests";

function statusVariant(status: KitRequestCard["status"], remaining: number): "default" | "success" | "secondary" | "warning" | "destructive" {
  if (status === "open" && remaining > 0 && remaining <= 2) return "warning";
  if (status === "open") return "default";
  if (status === "full") return "success";
  if (status === "expired") return "warning";
  if (status === "cancelled") return "destructive";
  return "secondary";
}

function creatorHandle(username: string): string {
  const trimmed = username.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : "Unbekannt";
}

interface KitRequestCardViewProps {
  request: KitRequestCard;
  onJoin?: (request: KitRequestCard) => void;
  onLeave?: (request: KitRequestCard) => void;
  onCancel?: (request: KitRequestCard) => void;
  onRetryCart?: (request: KitRequestCard) => void;
  joining?: boolean;
}

export function KitRequestCardView({
  request,
  onJoin,
  onLeave,
  onCancel,
  onRetryCart,
  joining,
}: KitRequestCardViewProps) {
  const rateQuery = useExchangeRate();
  const percent = kitRequestProgressPercent(request.allocatedTotal, request.kitSizeVials);
  const canJoin =
    request.status === "open" && !request.isCreator && !request.isParticipant && request.remainingVials > 0;
  const canLeave = request.status === "open" && request.isParticipant && !request.isCreator;
  const canCancel = request.status === "open" && request.isCreator;
  const showRetry = request.status === "full" && (request.isParticipant || request.isCreator) && onRetryCart;
  const sharePriceUsd =
    request.myQuantity > 0 && request.myUnitPriceUsd != null
      ? request.myUnitPriceUsd * request.myQuantity
      : request.myUnitPriceUsd;
  const remainingLabel =
    request.remainingVials === 1
      ? "Noch 1 Platz"
      : `Noch ${request.remainingVials} Plätze`;

  return (
    <article className="flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card">
      <header className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold leading-tight tracking-tight">
            {request.productName}
          </h3>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{request.variantLabel}</p>
        </div>
        <Badge className="shrink-0" variant={statusVariant(request.status, request.remainingVials)}>
          {kitRequestCustomerStatusLabel(request.status, request.remainingVials)}
        </Badge>
      </header>

      <div className="space-y-2 px-4 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-lg font-semibold tabular-nums leading-none">
            {request.allocatedTotal} / {request.kitSizeVials}{" "}
            <span className="text-sm font-medium text-muted-foreground">Kit</span>
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">{percent} %</p>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${request.allocatedTotal} von ${request.kitSizeVials} Vials vergeben`}
          />
        </div>
        {request.status === "open" ? (
          <p className="text-sm text-muted-foreground">{remainingLabel}</p>
        ) : request.status === "full" ? (
          <p className="text-sm font-medium text-primary">Kit vollständig</p>
        ) : null}
      </div>

      <div className="mt-auto flex flex-col gap-3 px-4 pb-4 pt-4">
        {sharePriceUsd != null ? (
          <div>
            <p className="text-xs text-muted-foreground">Dein Anteil</p>
            <DualCurrencyPrice
              usd={sharePriceUsd}
              rate={rateQuery.data?.rate ?? null}
              size="catalog"
              className="[&_[data-currency=eur]]:text-xl"
            />
          </div>
        ) : null}

        {request.note ? <p className="line-clamp-2 text-sm text-muted-foreground">{request.note}</p> : null}

        {canJoin && onJoin ? (
          <Button className="min-h-11 w-full" onClick={() => onJoin(request)} disabled={joining}>
            Mitmachen
          </Button>
        ) : null}
        {request.isParticipant && !canJoin ? (
          <Button className="min-h-11 w-full" variant="secondary" disabled>
            Dein Anteil
          </Button>
        ) : null}
        {canLeave && onLeave ? (
          <Button className="min-h-11 w-full" variant="outline" onClick={() => onLeave(request)}>
            Kit verlassen
          </Button>
        ) : null}
        {canCancel && onCancel ? (
          <Button className="min-h-11 w-full" variant="destructive" onClick={() => onCancel(request)}>
            Kit stornieren
          </Button>
        ) : null}
        {showRetry ? (
          <Button className="min-h-11 w-full" variant="outline" onClick={() => onRetryCart(request)}>
            Warenkorb aktualisieren
          </Button>
        ) : null}

        <p className="truncate text-[11px] text-muted-foreground">
          von {creatorHandle(request.creatorUsername)}
          <span className="sr-only"> Telegram Benutzername</span>
        </p>
      </div>
    </article>
  );
}
