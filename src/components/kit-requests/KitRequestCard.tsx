import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import {
  kitRequestActionLabel,
  kitRequestPrimaryAction,
} from "@/lib/kit/kitRequestActions";
import {
  kitRequestCustomerStatusLabel,
  kitRequestProgressPercent,
} from "@/lib/kitRequests";
import { getProductUnitLabel } from "@/lib/quantityFormat";
import { formatVendorDosageDisplay } from "@/lib/shop/variantCoverage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditKitShareButton } from "@/components/shop/EditKitShareButton";
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
  onDetails?: (request: KitRequestCard) => void;
  joining?: boolean;
}

export function KitRequestCardView({
  request,
  onJoin,
  onLeave,
  onCancel,
  onRetryCart,
  onDetails,
  joining,
}: KitRequestCardViewProps) {
  const rateQuery = useExchangeRate();
  const percent = kitRequestProgressPercent(request.allocatedTotal, request.kitSizeVials);
  const primary = kitRequestPrimaryAction(request);
  const canJoin = primary === "join";
  const canChangeQuantity = primary === "change_quantity";
  const canLeave = request.status === "open" && request.isParticipant && !request.isCreator;
  const canCancel = request.status === "open" && request.isCreator;
  const showRetry = primary === "retry_cart" && onRetryCart;
  const disabledPrimary = ["full", "expired", "cancelled", "ordered", "locked"].includes(primary);
  const unitLabel = getProductUnitLabel({
    category: request.category,
    name: request.productName,
    code: request.productCode,
    dosageVial: request.variantLabel,
  });
  const remainingLabel =
    request.remainingVials === 1
      ? "Noch 1 Platz"
      : `Noch ${request.remainingVials} Plätze`;

  return (
    <article className="flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card px-4 py-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold leading-tight tracking-tight">
            {request.productName}
          </h3>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {formatVendorDosageDisplay(request.variantLabel, request.productCode)}
          </p>
        </div>
        <Badge className="shrink-0" variant={statusVariant(request.status, request.remainingVials)}>
          {kitRequestCustomerStatusLabel(request.status, request.remainingVials)}
        </Badge>
      </header>

      <div className="mt-4 space-y-2">
        <p className="text-lg font-semibold tabular-nums leading-none">
          {request.allocatedTotal} / {request.kitSizeVials}{" "}
          <span className="text-sm font-medium text-muted-foreground">Kit</span>
        </p>
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

      <div className="mt-auto flex flex-col gap-3 pt-4">
        {request.myUnitPriceUsd != null ? (
          <div>
            <p className="text-xs text-muted-foreground">Dein Anteil</p>
            <DualCurrencyPrice
              usd={request.myUnitPriceUsd}
              rate={rateQuery.data?.rate ?? null}
              unit={unitLabel}
              size="catalog"
              className="[&_[data-currency=eur]]:text-xl"
            />
          </div>
        ) : null}

        {request.note ? <p className="line-clamp-2 text-sm text-muted-foreground">{request.note}</p> : null}

        <p className="truncate text-[11px] text-muted-foreground">
          von {creatorHandle(request.creatorUsername)}
          <span className="sr-only"> Telegram Benutzername</span>
        </p>

        {onDetails ? (
          <Button type="button" className="min-h-11 w-full" variant="ghost" onClick={() => onDetails(request)}>
            Details ansehen
          </Button>
        ) : null}
        {canJoin && onJoin ? (
          <Button className="min-h-11 w-full" onClick={() => onJoin(request)} disabled={joining}>
            {kitRequestActionLabel("join")}
          </Button>
        ) : null}
        {canChangeQuantity && onJoin ? (
          <Button className="min-h-11 w-full" variant="secondary" onClick={() => onJoin(request)} disabled={joining}>
            {kitRequestActionLabel("change_quantity")} ({request.myQuantity})
          </Button>
        ) : null}
        {request.isCreator && request.status === "open" ? (
          <Button className="min-h-11 w-full" variant="secondary" disabled>
            {kitRequestActionLabel("view_mine")}
          </Button>
        ) : null}
        {request.isParticipant && request.status === "full" ? (
          <EditKitShareButton kitShareId={request.id} presentation="participantCard" />
        ) : null}
        {disabledPrimary && !canJoin && !canChangeQuantity ? (
          <Button className="min-h-11 w-full" variant="secondary" disabled>
            {kitRequestActionLabel(primary)}
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
