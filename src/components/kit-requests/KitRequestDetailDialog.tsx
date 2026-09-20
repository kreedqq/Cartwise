import * as React from "react";

import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";
import { KitProgress } from "@/components/kit-requests/KitProgress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useKitRequest } from "@/hooks/useKitRequests";
import { kitRequestActionLabel } from "@/lib/kit/kitRequestActions";
import { KIT_ALMOST_FULL_REMAINING_THRESHOLD } from "@/lib/kit/kitShareState";
import { kitRequestCustomerStatusLabel } from "@/lib/kitRequests";
import { formatKitParticipantShare, resolveProductCategoryId } from "@/lib/quantityFormat";
import { formatVendorDosageDisplay } from "@/lib/shop/variantCoverage";
import { cn } from "@/lib/utils";

function creatorHandle(username: string): string {
  const trimmed = username.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : "Unbekannt";
}

export function KitRequestDetailDialog({
  kitId,
  open,
  onOpenChange,
  onJoin,
}: {
  kitId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoin?: () => void;
}) {
  const detailQuery = useKitRequest(open ? kitId ?? undefined : undefined);
  const rateQuery = useExchangeRate();
  const request = detailQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
        {detailQuery.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : detailQuery.isError || !request ? (
          <p className="text-sm text-destructive">Kit konnte nicht geladen werden.</p>
        ) : (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <DialogTitle>{request.productName}</DialogTitle>
                  <DialogDescription>
                    {formatVendorDosageDisplay(request.variantLabel, request.productCode)}
                  </DialogDescription>
                </div>
                <Badge variant="secondary">
                  {kitRequestCustomerStatusLabel(request.status, request.remainingVials)}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {(() => {
                const isAlmostFull =
                  request.status === "open" &&
                  request.remainingVials > 0 &&
                  request.remainingVials <= KIT_ALMOST_FULL_REMAINING_THRESHOLD;
                const isLastSpot = request.status === "open" && request.remainingVials === 1;
                const remainingLabel = isLastSpot
                  ? "Letzter Platz!"
                  : request.remainingVials > 0
                    ? `Noch ${request.remainingVials} freie Plätze`
                    : request.status === "full"
                      ? "Kit vollständig"
                      : null;
                return (
                  <div>
                    <KitProgress
                      allocated={request.allocatedTotal}
                      kitSize={request.kitSizeVials}
                      status={request.status}
                      isAlmostFull={isAlmostFull}
                      isLastSpot={isLastSpot}
                    />
                    {remainingLabel ? (
                      <p
                        className={cn(
                          "mt-2 text-sm",
                          isLastSpot || isAlmostFull
                            ? "font-semibold text-warning"
                            : request.status === "full"
                              ? "font-medium text-success"
                              : "text-muted-foreground",
                        )}
                      >
                        {remainingLabel}
                      </p>
                    ) : null}
                  </div>
                );
              })()}

              {request.isParticipant && request.myQuantity > 0 ? (
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dein Anteil</p>
                  <p className="mt-1 text-base font-semibold">
                    {formatKitParticipantShare(
                      request.myQuantity,
                      request.kitSizeVials,
                      resolveProductCategoryId({
                        name: request.productName,
                        code: request.productCode,
                        dosageVial: request.variantLabel,
                      }),
                    )}
                  </p>
                  {request.myUnitPriceUsd != null ? (
                    <DualCurrencyPrice
                      usd={request.myUnitPriceUsd * request.myQuantity}
                      rate={rateQuery.data?.rate ?? null}
                      size="summary"
                    />
                  ) : null}
                </div>
              ) : null}

              {request.participants && request.participants.length > 0 ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Teilnehmer</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {request.participants.map((p) => (
                      <li key={p.username} className="flex justify-between gap-2">
                        <span>{p.isSelf ? "Du" : creatorHandle(p.username)}</span>
                        <span className="tabular-nums text-muted-foreground">{p.quantity} Kit</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="text-sm text-muted-foreground">
                Erstellt von {creatorHandle(request.creatorUsername)}
              </p>
              {request.note ? <p className="text-sm">{request.note}</p> : null}
              {request.expiresAt ? (
                <p className="text-xs text-muted-foreground">
                  Ablauf:{" "}
                  {new Date(request.expiresAt).toLocaleString("de-DE", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              ) : null}

              {onJoin && request.status === "open" && !request.isParticipant && request.remainingVials > 0 ? (
                <Button className="min-h-11 w-full" onClick={onJoin}>
                  {kitRequestActionLabel("join")}
                </Button>
              ) : null}
              {onJoin && request.status === "open" && request.isParticipant && !request.isCreator ? (
                <Button className="min-h-11 w-full" variant="secondary" onClick={onJoin}>
                  {kitRequestActionLabel("change_quantity")} ({request.myQuantity})
                </Button>
              ) : null}
              {request.isParticipant && request.status === "open" ? (
                <p className="text-center text-sm font-medium text-success">Du bist dabei.</p>
              ) : null}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
