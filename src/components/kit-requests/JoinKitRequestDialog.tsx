import * as React from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
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
import { useJoinKitRequest, useUpdateKitRequestQuantity } from "@/hooks/useKitRequests";
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

export function JoinKitRequestDialog({ request, open, onOpenChange }: JoinKitRequestDialogProps) {
  if (!open || !request) return null;
  return <JoinKitRequestDialogBody request={request} onOpenChange={onOpenChange} />;
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
  const rateQuery = useExchangeRate();
  const options = ownQuantityOptions(request.kitSizeVials, request.allocatedTotal, request.myQuantity);
  const [quantity, setQuantity] = React.useState(isUpdate ? request.myQuantity : (options[0] ?? 1));
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [previewPrice, setPreviewPrice] = React.useState<number | null>(null);
  const [previewUnit, setPreviewUnit] = React.useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [joined, setJoined] = React.useState<{ quantity: number; full: boolean; price: number | null } | null>(null);

  const categoryId: ShopCategoryId = isShopCategoryId(request.category) ? request.category : "peptides";
  const maxOwn = options[options.length - 1] ?? 0;
  const liveTotal =
    previewPrice ??
    (request.myUnitPriceUsd != null ? request.myUnitPriceUsd * quantity : null);
  const pending = joinMutation.isPending || updateMutation.isPending;

  async function handlePrepareConfirm() {
    if (isUpdate) {
      setConfirmOpen(true);
      return;
    }
    setPreviewLoading(true);
    try {
      const preview = await previewKitRequestJoin(request.id, quantity);
      setPreviewPrice(preview.myPriceUsd);
      setPreviewUnit(preview.myUnitPriceUsd);
      setConfirmOpen(true);
    } catch (error) {
      toast.error(kitRequestFailureMessage(error, "preview_kit_request_join"));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleConfirm() {
    try {
      if (isUpdate) {
        const view = await updateMutation.mutateAsync({ id: request.id, quantity });
        const full = view.status === "full";
        setJoined({ quantity: view.myQuantity, full, price: request.myUnitPriceUsd != null ? request.myUnitPriceUsd * view.myQuantity : null });
        setConfirmOpen(false);
        toast.success(full ? "Anteil aktualisiert. Das Kit ist vollständig." : "Dein Kit Anteil wurde aktualisiert.");
        return;
      }
      const result = await joinMutation.mutateAsync({ id: request.id, quantity });
      const full = result.status === "full" && result.cartSynced;
      setJoined({ quantity: result.myQuantity, full, price: previewPrice });
      setConfirmOpen(false);
      toast.success(full ? "Du bist dabei! Das Kit ist vollständig." : "Du bist dabei!");
    } catch (error) {
      toast.error(kitRequestFailureMessage(error, isUpdate ? "update_kit_share_quantity" : "join_kit_request"));
    }
  }

  return (
    <>
      <Dialog
        open={!confirmOpen}
        onOpenChange={(next) => {
          if (!next) onOpenChange(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {joined
                ? isUpdate
                  ? "Anteil aktualisiert"
                  : "Du bist dabei!"
                : isUpdate
                  ? "Menge ändern"
                  : "Wie viele möchtest du übernehmen?"}
            </DialogTitle>
            <DialogDescription>
              {request.productName} · {formatVendorDosageDisplay(request.variantLabel, request.productCode)}
            </DialogDescription>
          </DialogHeader>
          {joined ? (
            <div className="space-y-3">
              <p className="text-sm">
                Dein Anteil: {formatKitQuantity(joined.quantity, categoryId, request.kitSizeVials)}
              </p>
              {joined.price != null ? (
                <div>
                  <p className="text-xs text-muted-foreground">Preis</p>
                  <DualCurrencyPrice usd={joined.price} rate={rateQuery.data?.rate ?? null} size="summary" />
                </div>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {joined.full ? "Das Kit ist vollständig und liegt in deinem Warenkorb." : "Andere Kunden können die übrigen Plätze noch übernehmen."}
              </p>
              <Button className="min-h-11 w-full" onClick={() => onOpenChange(false)}>
                Schließen
              </Button>
            </div>
          ) : (
          <div className="space-y-4">
            <p className="text-sm">
              {isUpdate
                ? `Aktuell ${request.myQuantity} · maximal ${maxOwn} möglich`
                : `Noch ${request.remainingVials} verfügbar`}
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {isUpdate ? "Neue Menge" : "Wie viele möchtest du übernehmen?"}
              </p>
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
            </div>
            <div className="rounded-lg bg-secondary/40 p-4">
              <p className="text-xs text-muted-foreground">Dein Anteil</p>
              {liveTotal != null ? (
                <DualCurrencyPrice usd={liveTotal} rate={rateQuery.data?.rate ?? null} size="summary" />
              ) : (
                <p className="text-sm text-muted-foreground">Preis erscheint nach der Bestätigung.</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Du zahlst nur für deinen Anteil.</p>
            </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button className="min-h-11 w-full sm:w-auto" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button
              className="min-h-11 w-full sm:w-auto"
              onClick={() => void handlePrepareConfirm()}
              disabled={previewLoading || options.length === 0 || (isUpdate && quantity === request.myQuantity)}
            >
              {previewLoading ? "Bitte warten …" : "Weiter"}
            </Button>
          </DialogFooter>
          </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Passt alles?"
        confirmLabel={isUpdate ? "Menge speichern" : "Mit diesem Anteil beitreten"}
        loading={pending}
        onConfirm={() => void handleConfirm()}
        description={
          <div className="space-y-3 text-left text-sm text-foreground">
            <p>
              {request.productName} · {formatVendorDosageDisplay(request.variantLabel, request.productCode)}
            </p>
            <p>Dein Anteil: {formatKitQuantity(quantity, categoryId, request.kitSizeVials)}</p>
            {!isUpdate ? <p>Noch verfügbare Plätze: {request.remainingVials}</p> : null}
            {previewPrice != null ? (
              <div>
                <p className="text-xs text-muted-foreground">Preis</p>
                <DualCurrencyPrice usd={previewPrice} rate={rateQuery.data?.rate ?? null} size="summary" />
              </div>
            ) : previewUnit != null ? (
              <DualCurrencyPrice usd={previewUnit * quantity} rate={rateQuery.data?.rate ?? null} size="summary" />
            ) : null}
          </div>
        }
      />
    </>
  );
}
