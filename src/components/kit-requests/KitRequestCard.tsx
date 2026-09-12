import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";
import {
  kitRequestCustomerStatusLabel,
  kitRequestProgressPercent,
} from "@/lib/kitRequests";
import { formatKitQuantity } from "@/lib/shop/kitUnits";
import type { ShopCategoryId } from "@/lib/shopCategories";
import { isShopCategoryId } from "@/lib/shopCategories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { KitRequestCard } from "@/services/kitRequests";

function statusVariant(status: KitRequestCard["status"], remaining: number): "default" | "success" | "secondary" | "warning" | "destructive" {
  if (status === "open" && remaining > 0 && remaining <= 2) return "warning";
  if (status === "open") return "default";
  if (status === "full") return "success";
  if (status === "expired") return "warning";
  if (status === "cancelled") return "destructive";
  return "secondary";
}

function requestCategoryId(category: string): ShopCategoryId {
  return isShopCategoryId(category) ? category : "peptides";
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
  const categoryId = requestCategoryId(request.category);
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
    <Card className="flex h-full min-w-0 flex-col overflow-hidden">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="break-words text-lg">{request.productName}</CardTitle>
            <p className="text-sm text-muted-foreground">{request.variantLabel}</p>
          </div>
          <Badge variant={statusVariant(request.status, request.remainingVials)}>
            {kitRequestCustomerStatusLabel(request.status, request.remainingVials)}
          </Badge>
        </div>
        {request.isCreator ? (
          <p className="text-sm font-medium text-primary">Du hast dieses Kit erstellt.</p>
        ) : request.isParticipant ? (
          <p className="text-sm font-medium text-primary">Du bist beigetreten.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Gestartet von Telegram Benutzername{" "}
            <span className="font-medium text-foreground">{request.creatorUsername}</span>
          </p>
        )}
      </CardHeader>
      <CardContent className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">
              {request.allocatedTotal} von {request.kitSizeVials} belegt
            </span>
            <span className="text-muted-foreground">{percent} %</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${percent}%` }}
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${request.allocatedTotal} von ${request.kitSizeVials} belegt`}
            />
          </div>
          {request.status === "open" ? (
            <p className="text-sm">Noch verfügbar: {formatKitQuantity(request.remainingVials, categoryId, request.kitSizeVials)}</p>
          ) : request.status === "full" ? (
            <p className="text-sm font-medium text-primary">Kit vollständig</p>
          ) : null}
        </div>

        {sharePriceUsd != null ? (
          <div>
            <p className="text-xs text-muted-foreground">
              {request.isParticipant || request.isCreator ? "Dein Anteil" : "Preis pro Anteil"}
            </p>
            <DualCurrencyPrice usd={sharePriceUsd} size="catalog" />
          </div>
        ) : null}

        {request.isParticipant && !request.isCreator ? (
          <p className="text-sm">
            Mein Anteil: {formatKitQuantity(request.myQuantity, categoryId, request.kitSizeVials)}
            {request.status === "open" && request.remainingVials > 0
              ? " · Wartet auf weitere Teilnehmer"
              : null}
          </p>
        ) : null}

        {request.note ? <p className="break-words text-sm text-muted-foreground">{request.note}</p> : null}
      </CardContent>
      <CardFooter className="mt-auto flex flex-col gap-2 sm:flex-row">
        {canJoin && onJoin ? (
          <Button className="min-h-11 w-full" onClick={() => onJoin(request)} disabled={joining}>
            Mitmachen
          </Button>
        ) : null}
        {canLeave && onLeave ? (
          <Button className="min-h-11 w-full" variant="outline" onClick={() => onLeave(request)}>
            Verlassen
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
      </CardFooter>
    </Card>
  );
}
