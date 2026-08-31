import { formatUsd } from "@/lib/money";
import {
  kitRequestProgressPercent,
  kitRequestStatusLabel,
} from "@/lib/kitRequests";
import { formatKitQuantity, kitQuantityUnitLabelForCategory } from "@/lib/shop/kitUnits";
import type { ShopCategoryId } from "@/lib/shopCategories";
import { isShopCategoryId } from "@/lib/shopCategories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { KitRequestCard } from "@/services/kitRequests";

function statusVariant(status: KitRequestCard["status"]): "default" | "success" | "secondary" | "warning" | "destructive" {
  if (status === "open") return "default";
  if (status === "full") return "success";
  if (status === "expired") return "warning";
  if (status === "cancelled") return "destructive";
  return "secondary";
}

function categoryUnit(category: string): "Vials" | "Stück" {
  if (isShopCategoryId(category)) {
    return kitQuantityUnitLabelForCategory(category as ShopCategoryId);
  }
  return "Vials";
}

function formatCreatedAt(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
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
  const unit = categoryUnit(request.category);
  const percent = kitRequestProgressPercent(request.allocatedTotal, request.kitSizeVials);
  const canJoin =
    request.status === "open" && !request.isCreator && !request.isParticipant && request.remainingVials > 0;
  const canLeave = request.status === "open" && request.isParticipant && !request.isCreator;
  const canCancel = request.status === "open" && request.isCreator;
  const showRetry = request.status === "full" && (request.isParticipant || request.isCreator) && onRetryCart;

  return (
    <Card className="flex h-full min-w-0 flex-col overflow-hidden">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="break-words text-lg">{request.productName}</CardTitle>
            <p className="text-sm text-muted-foreground">{request.variantLabel}</p>
          </div>
          <Badge variant={statusVariant(request.status)}>{kitRequestStatusLabel(request.status)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          von <span className="font-medium text-foreground">{request.creatorUsername}</span>
        </p>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">
              {formatKitQuantity(request.allocatedTotal, unit)} / {request.kitSizeVials}
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
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {request.creatorQuantity} von {request.kitSizeVials} {unit} bereits vom Ersteller
          </p>
          {request.status === "open" ? (
            <p className="text-sm">Noch {formatKitQuantity(request.remainingVials, unit)}</p>
          ) : null}
        </div>

        {request.myUnitPriceUsd != null ? (
          <p className="text-base font-semibold">{formatUsd(request.myUnitPriceUsd)} / {unit === "Stück" ? "Stück" : "Vial"}</p>
        ) : null}

        {request.isParticipant && !request.isCreator ? (
          <p className="text-sm text-primary">
            Du bist mit {formatKitQuantity(request.myQuantity, unit)} dabei.
            {request.status === "open" && request.remainingVials > 0
              ? ` Es werden noch ${formatKitQuantity(request.remainingVials, unit)} benötigt.`
              : null}
            {request.status === "full" ? " Kit vollständig." : null}
          </p>
        ) : null}

        {request.note ? <p className="break-words text-sm text-muted-foreground">{request.note}</p> : null}

        <p className="text-xs text-muted-foreground">{formatCreatedAt(request.createdAt)}</p>
      </CardContent>
      <CardFooter className="mt-auto flex flex-col gap-2 sm:flex-row">
        {canJoin && onJoin ? (
          <Button className="w-full" onClick={() => onJoin(request)} disabled={joining}>
            Beitreten
          </Button>
        ) : null}
        {canLeave && onLeave ? (
          <Button className="w-full" variant="outline" onClick={() => onLeave(request)}>
            Teilnahme stornieren
          </Button>
        ) : null}
        {canCancel && onCancel ? (
          <Button className="w-full" variant="destructive" onClick={() => onCancel(request)}>
            Gesuch stornieren
          </Button>
        ) : null}
        {showRetry ? (
          <Button className="w-full" variant="outline" onClick={() => onRetryCart(request)}>
            Warenkorb erneut synchronisieren
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
