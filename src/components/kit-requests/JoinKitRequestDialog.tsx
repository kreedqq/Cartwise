import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useInvalidateKitRequests, useJoinKitRequest, useUpdateKitRequestQuantity } from "@/hooks/useKitRequests";
import { kitJoinUserMessage } from "@/lib/kit/kitJoinErrors";
import { kitRequestFailureMessage, ownQuantityOptions } from "@/lib/kitRequests";
import { formatKitQuantity } from "@/lib/shop/kitUnits";
import { formatVendorDosageDisplay } from "@/lib/shop/variantCoverage";
import { isShopCategoryId, type ShopCategoryId } from "@/lib/shopCategories";
import { previewKitRequestJoin, type KitRequestCard } from "@/services/kitRequests";

interface JoinKitRequestDialogProps {
  request: KitRequestCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export function JoinKitRequestDialog({ request, open, onOpenChange }: JoinKitRequestDialogProps) {
  if (!open || !request) return null;
  return <JoinKitRequestDialogBody key={request.id} request={request} onOpenChange={onOpenChange} />;
}

function JoinKitRequestDialogBody({
  request,
  onOpenChange,
}: {
  request: KitRequestCard;
  onOpenChange: (open: boolean) => void;
}) {
  const isUpdate = request.isParticipant && request.myQuantity > 0;
  const joinMutation = useJoinKitRequest();
  const updateMutation = useUpdateKitRequestQuantity();
  const invalidate = useInvalidateKitRequests();
  const rateQuery = useExchangeRate();
  const options = ownQuantityOptions(request.kitSizeVials, request.allocatedTotal, request.myQuantity);
  const [quantity, setQuantity] = React.useState(isUpdate ? request.myQuantity : (options[0] ?? 1));
  const pending = joinMutation.isPending || updateMutation.isPending;

  const previewQuery = useQuery({
    queryKey: ["kit-join-preview", request.id, quantity] as const,
    queryFn: () => previewKitRequestJoin(request.id, quantity),
    enabled: !isUpdate,
    staleTime: 0,
  });

  const previewUnit = isUpdate
    ? request.myUnitPriceUsd
    : (previewQuery.data?.myUnitPriceUsd ?? null);
  const previewTotal = isUpdate
    ? request.myUnitPriceUsd != null
      ? request.myUnitPriceUsd * quantity
      : null
    : (previewQuery.data?.myPriceUsd ?? null);
  const previewLoading = !isUpdate && previewQuery.isFetching;
  const remainingAfter = isUpdate
    ? request.remainingVials + request.myQuantity - quantity
    : (previewQuery.data?.remainingAfterJoin ?? request.remainingVials);

  const categoryId: ShopCategoryId = isShopCategoryId(request.category) ? request.category : "peptides";
  const maxOwn = options[options.length - 1] ?? 0;
  const quantityInvalid = !options.includes(quantity);

  async function handleJoin() {
    if (quantityInvalid) {
      toast.error(`Maximal ${maxOwn} Kit verfügbar.`);
      return;
    }
    try {
      if (isUpdate) {
        const view = await updateMutation.mutateAsync({ id: request.id, quantity });
        invalidate();
        onOpenChange(false);
        toast.success(
          view.status === "full"
            ? "Anteil aktualisiert. Das Kit ist jetzt vollständig."
            : "Dein Kit-Anteil wurde aktualisiert.",
        );
        return;
      }
      const result = await joinMutation.mutateAsync({ id: request.id, quantity });
      invalidate();
      onOpenChange(false);
      toast.success(
        result.status === "full" && result.cartSynced
          ? "Dein Anteil wurde hinzugefügt. Das Kit ist jetzt vollständig."
          : "Dein Anteil wurde hinzugefügt.",
      );
    } catch (error) {
      toast.error(
        kitJoinUserMessage(
          error,
          kitRequestFailureMessage(error, isUpdate ? "update_kit_share_quantity" : "join_kit_request"),
        ),
      );
    }
  }

  const dosage = formatVendorDosageDisplay(request.variantLabel, request.productCode);
  const expires =
    request.expiresAt != null
      ? new Date(request.expiresAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })
      : null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isUpdate ? "Anteil anpassen" : "Kit beitreten"}</DialogTitle>
          <DialogDescription>
            {request.productName} · {dosage}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2">
            <StatRow label="Kit Größe" value={`${request.kitSizeVials} Kit`} />
            <StatRow label="Bereits vergeben" value={`${request.allocatedTotal} Kit`} />
            <StatRow
              label="Noch verfügbar"
              value={isUpdate ? `${request.remainingVials + request.myQuantity} Kit` : `${request.remainingVials} Kit`}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Dein Anteil</p>
            <div className="flex flex-wrap gap-2">
              {options.map((qty) => (
                <Button
                  key={qty}
                  type="button"
                  variant={quantity === qty ? "default" : "outline"}
                  className="min-h-11 min-w-14"
                  onClick={() => setQuantity(qty)}
                >
                  {qty}
                </Button>
              ))}
            </div>
            {quantityInvalid ? (
              <p className="text-sm text-destructive">Nur noch {maxOwn} Kit verfügbar.</p>
            ) : null}
          </div>

          <div className="rounded-xl border border-border p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Preis / Vial</p>
              {previewUnit != null ? (
                <DualCurrencyPrice usd={previewUnit} rate={rateQuery.data?.rate ?? null} size="catalog" />
              ) : (
                <p className="text-sm text-muted-foreground">{previewLoading ? "Preis wird geladen …" : "—"}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dein Gesamtpreis</p>
              {previewTotal != null ? (
                <DualCurrencyPrice usd={previewTotal} rate={rateQuery.data?.rate ?? null} size="summary" />
              ) : (
                <p className="text-sm text-muted-foreground">{previewLoading ? "…" : "—"}</p>
              )}
            </div>
            {!isUpdate && remainingAfter >= 0 ? (
              <p className="text-xs text-muted-foreground">
                Nach deinem Beitritt: noch {remainingAfter}{" "}
                {remainingAfter === 1 ? "Platz" : "Plätze"}
              </p>
            ) : null}
          </div>

          {request.note ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Hinweis: </span>
              {request.note}
            </p>
          ) : null}

          {expires ? <p className="text-xs text-muted-foreground">Ablauf: {expires}</p> : null}

          <p className="text-xs text-muted-foreground">
            Dein Anteil: {formatKitQuantity(quantity, categoryId, request.kitSizeVials)}
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            loading={pending}
            disabled={previewLoading || quantityInvalid || (isUpdate && quantity === request.myQuantity)}
            onClick={() => void handleJoin()}
          >
            {isUpdate ? "Menge speichern" : "Mitmachen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
