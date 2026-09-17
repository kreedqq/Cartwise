import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";
import { KitProgress } from "@/components/kit-requests/KitProgress";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import {
  kitRequestActionLabel,
  kitRequestPrimaryAction,
} from "@/lib/kit/kitRequestActions";
import { kitRequestCustomerStatusLabel } from "@/lib/kitRequests";
import { KIT_ALMOST_FULL_REMAINING_THRESHOLD } from "@/lib/kit/kitShareState";
import { getProductUnitLabel } from "@/lib/quantityFormat";
import { formatVendorDosageDisplay } from "@/lib/shop/variantCoverage";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EditKitShareButton } from "@/components/shop/EditKitShareButton";
import type { KitRequestCard } from "@/services/kitRequests";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** True when the kit expires within 48 hours. */
function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  return msLeft > 0 && msLeft < 2 * 24 * 60 * 60 * 1000;
}

/** Short locale-aware expiry string, e.g. "20. Sept., 19:00". */
function formatExpiryShort(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("de-DE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function creatorHandle(username: string): string {
  const trimmed = username.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : "Unbekannt";
}

/**
 * Dynamic card container classes.
 *
 * Open kits get a subtle primary tint to distinguish them from product cards.
 * FOMO states (almost full / last spot) shift to a warm warning tint.
 * Inactive kits are intentionally desaturated.
 */
function cardContainerCn(
  status: KitRequestCard["status"],
  isAlmostFull: boolean,
  isLastSpot: boolean,
): string {
  if (status === "full")
    return "border-success/25 bg-success/[0.03]";
  if (status === "expired" || status === "cancelled")
    return "border-border bg-card opacity-80";
  if (status === "ordered")
    return "border-success/20 bg-success/[0.02]";
  if (isLastSpot)
    return "border-warning/55 bg-warning/[0.07]";
  if (isAlmostFull)
    return "border-warning/35 bg-warning/[0.04]";
  // Normal open kit
  return "border-primary/20 bg-primary/[0.04]";
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface KitRequestCardViewProps {
  request: KitRequestCard;
  onJoin?: (request: KitRequestCard) => void;
  onLeave?: (request: KitRequestCard) => void;
  onCancel?: (request: KitRequestCard) => void;
  onRetryCart?: (request: KitRequestCard) => void;
  onDetails?: (request: KitRequestCard) => void;
  joining?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

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
  const primary = kitRequestPrimaryAction(request);
  const canJoin = primary === "join";
  const canChangeQuantity = primary === "change_quantity";
  const canLeave =
    request.status === "open" && request.isParticipant && !request.isCreator;
  const canCancel = request.status === "open" && request.isCreator;
  const showRetry = primary === "retry_cart" && onRetryCart;
  const disabledPrimary = [
    "full",
    "expired",
    "cancelled",
    "ordered",
    "locked",
  ].includes(primary);
  const unitLabel = getProductUnitLabel({
    category: request.category,
    name: request.productName,
    code: request.productCode,
    dosageVial: request.variantLabel,
  });

  // ── FOMO signals (real data only, no fabrication) ───────────────────────
  const isAlmostFull =
    request.status === "open" &&
    request.remainingVials > 0 &&
    request.remainingVials <= KIT_ALMOST_FULL_REMAINING_THRESHOLD;
  const isLastSpot = request.status === "open" && request.remainingVials === 1;
  const expiringSoon = isExpiringSoon(request.expiresAt);
  const expiryLabel = formatExpiryShort(request.expiresAt);

  const remainingLabel = isLastSpot
    ? "Letzter Platz!"
    : request.remainingVials > 0
      ? `Noch ${request.remainingVials} freie Plätze`
      : null;

  return (
    <article
      className={cn(
        "flex h-full min-w-0 flex-col overflow-hidden border transition-colors",
        cardContainerCn(request.status, isAlmostFull, isLastSpot),
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em]",
          isLastSpot || isAlmostFull
            ? "bg-warning/15 text-warning"
            : request.status === "full"
              ? "bg-success/15 text-success"
              : "bg-primary/10 text-primary",
        )}
      >
        <span>{kitRequestCustomerStatusLabel(request.status, request.remainingVials)}</span>
        {expiringSoon ? <span>Läuft bald ab</span> : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
      <header className="min-w-0">
        <h3 className="truncate font-display text-xl font-semibold leading-tight tracking-tight">
          {request.productName}
        </h3>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {formatVendorDosageDisplay(request.variantLabel, request.productCode)}
        </p>
      </header>

      <div className="mt-5">
        <p className="font-display text-4xl font-semibold tabular-nums leading-none tracking-tight">
          {request.allocatedTotal}
          <span className="text-muted-foreground"> / {request.kitSizeVials}</span>
        </p>
        <KitProgress
          allocated={request.allocatedTotal}
          kitSize={request.kitSizeVials}
          status={request.status}
          isAlmostFull={isAlmostFull}
          isLastSpot={isLastSpot}
          className="mt-3"
        />

        {/* Remaining / status copy below the bar */}
        <div className="mt-2 min-h-[1.25rem]">
          {request.status === "open" && remainingLabel ? (
            <p
              className={cn(
                "text-sm leading-tight",
                isLastSpot || isAlmostFull
                  ? "font-semibold text-warning"
                  : "text-muted-foreground",
              )}
            >
              {remainingLabel}
            </p>
          ) : request.status === "full" ? (
            <p className="text-sm font-medium text-success">Kit vollständig</p>
          ) : null}
        </div>

        {/* Expiry date — only show when meaningful */}
        {expiryLabel && (
          <p
            className={cn(
              "mt-1 text-xs",
              expiringSoon ? "font-medium text-warning" : "text-muted-foreground",
            )}
          >
            {expiringSoon ? "⚡ Endet " : "Läuft ab: "}
            {expiryLabel}
          </p>
        )}
      </div>

      {/* ── Footer ── Price, note, creator, actions ──────────────────────── */}
      <div className="mt-auto flex flex-col gap-3 pt-5">
        {/* My price share — prominent, anchors the value proposition */}
        {request.myUnitPriceUsd != null ? (
          <div>
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dein Anteil
            </p>
            <DualCurrencyPrice
              usd={request.myUnitPriceUsd}
              rate={rateQuery.data?.rate ?? null}
              unit={unitLabel}
              size="catalog"
              className="[&_[data-currency=eur]]:text-xl"
            />
          </div>
        ) : null}

        {request.note ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {request.note}
          </p>
        ) : null}

        {/* Creator handle */}
        <p className="truncate text-xs text-muted-foreground">
          von {creatorHandle(request.creatorUsername)}
          <span className="sr-only"> Telegram Benutzername</span>
        </p>

        {/* ── Actions ─────────────────────────────────────────────────── */}
        {onDetails ? (
          <Button
            type="button"
            className="min-h-11 w-full"
            variant="ghost"
            onClick={() => onDetails(request)}
          >
            Details ansehen
          </Button>
        ) : null}
        {canJoin && onJoin ? (
          <Button
            className="min-h-11 w-full"
            onClick={() => onJoin(request)}
            disabled={joining}
          >
            {kitRequestActionLabel("join")}
          </Button>
        ) : null}
        {canChangeQuantity && onJoin ? (
          <Button
            className="min-h-11 w-full"
            variant="secondary"
            onClick={() => onJoin(request)}
            disabled={joining}
          >
            {kitRequestActionLabel("change_quantity")} ({request.myQuantity})
          </Button>
        ) : null}
        {request.isCreator && request.status === "open" ? (
          <Button className="min-h-11 w-full" variant="secondary" disabled>
            {kitRequestActionLabel("view_mine")}
          </Button>
        ) : null}
        {request.isParticipant && request.status === "full" ? (
          <EditKitShareButton
            kitShareId={request.id}
            presentation="participantCard"
          />
        ) : null}
        {disabledPrimary && !canJoin && !canChangeQuantity ? (
          <Button className="min-h-11 w-full" variant="secondary" disabled>
            {kitRequestActionLabel(primary)}
          </Button>
        ) : null}
        {canLeave && onLeave ? (
          <Button
            className="min-h-11 w-full"
            variant="outline"
            onClick={() => onLeave(request)}
          >
            Kit verlassen
          </Button>
        ) : null}
        {canCancel && onCancel ? (
          <Button
            className="min-h-11 w-full"
            variant="destructive"
            onClick={() => onCancel(request)}
          >
            Kit stornieren
          </Button>
        ) : null}
        {showRetry ? (
          <Button
            className="min-h-11 w-full"
            variant="outline"
            onClick={() => onRetryCart(request)}
          >
            Warenkorb aktualisieren
          </Button>
        ) : null}
      </div>
      </div>
    </article>
  );
}
