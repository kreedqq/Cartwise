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

  return (
    <article className="flex h-full min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold leading-tight">{request.productName}</h3>
          <p className="truncate text-sm text-muted-foreground">{request.variantLabel}</p>
        </div>
        <Badge variant={statusVariant(request.status, request.remainingVials)}>
          {kitRequestCustomerStatusLabel(request.status, request.remainingVials)}
        </Badge>
      </div>
      {!request.isCreator && !request.isParticipant ? (
        <p className="truncate text-xs text-muted-foreground">
          Telegram Benutzername {request.creatorUsername}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium">
            {request.allocatedTotal} von {request.kitSizeVials} Vials vergeben
          </span>
          <span className="text-muted-foreground">{percent} %</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
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
          <p className="text-sm">Noch {request.remainingVials} verfügbar</p>
        ) : request.status === "full" ? (
          <p className="text-sm font-medium text-primary">Kit vollständig</p>
        ) : null}
      </div>

      {sharePriceUsd != null ? (
        <DualCurrencyPrice usd={sharePriceUsd} rate={rateQuery.data?.rate ?? null} size="catalog" />
      ) : null}

      {request.note ? <p className="line-clamp-2 text-sm text-muted-foreground">{request.note}</p> : null}

      <div className="mt-auto flex flex-col gap-2">
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
      </div>
    </article>
  );
}
