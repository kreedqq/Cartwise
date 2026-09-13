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
import { useJoinKitRequest } from "@/hooks/useKitRequests";
import { remainingQuantityOptions } from "@/lib/kitRequests";
import { formatKitQuantity } from "@/lib/shop/kitUnits";
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
  const joinMutation = useJoinKitRequest();
  const rateQuery = useExchangeRate();
  const options = remainingQuantityOptions(request.remainingVials);
  const [quantity, setQuantity] = React.useState(options[0] ?? 1);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [previewPrice, setPreviewPrice] = React.useState<number | null>(null);
  const [previewUnit, setPreviewUnit] = React.useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [joined, setJoined] = React.useState<{ quantity: number; full: boolean; price: number | null } | null>(null);

  const categoryId: ShopCategoryId = isShopCategoryId(request.category) ? request.category : "peptides";
  const liveTotal =
    previewPrice ??
    (request.myUnitPriceUsd != null ? request.myUnitPriceUsd * quantity : null);

  async function handlePrepareConfirm() {
    setPreviewLoading(true);
    try {
      const preview = await previewKitRequestJoin(request.id, quantity);
      setPreviewPrice(preview.myPriceUsd);
      setPreviewUnit(preview.myUnitPriceUsd);
      setConfirmOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Vorschau nicht verfügbar. Bitte aktualisieren.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleConfirm() {
    try {
      const result = await joinMutation.mutateAsync({ id: request.id, quantity });
      const full = result.status === "full" && result.cartSynced;
      setJoined({ quantity: result.myQuantity, full, price: previewPrice });
      setConfirmOpen(false);
      toast.success(full ? "Du bist dabei. Das Kit ist vollständig." : "Du bist dabei.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Beitritt fehlgeschlagen.");
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
            <DialogTitle>{joined ? "Du bist dabei." : "Kit teilen"}</DialogTitle>
            <DialogDescription>
              {request.productName} · {request.variantLabel}
            </DialogDescription>
          </DialogHeader>
          {joined ? (
            <div className="space-y-3">
              <p className="text-sm">
                Dein Anteil: {formatKitQuantity(joined.quantity, categoryId, request.kitSizeVials)}
              </p>
              <p className="text-sm">
                {request.allocatedTotal + joined.quantity} von {request.kitSizeVials} Vials vergeben
              </p>
              {joined.price != null ? (
                <div>
                  <p className="text-xs text-muted-foreground">Preis</p>
                  <DualCurrencyPrice usd={joined.price} rate={rateQuery.data?.rate ?? null} size="summary" />
                </div>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {joined.full ? "Kit vollständig. Die Artikel liegen in deinem Warenkorb." : "Warte auf weitere Teilnehmer"}
              </p>
              <Button className="min-h-11 w-full" onClick={() => onOpenChange(false)}>
                Schließen
              </Button>
            </div>
          ) : (
          <div className="space-y-4">
            <p className="text-sm">
              Kit: {formatKitQuantity(request.kitSizeVials, categoryId, request.kitSizeVials)} · Bereits{" "}
              {request.allocatedTotal} / {request.kitSizeVials} · Noch verfügbar: {request.remainingVials}
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">Wie viel möchtest du übernehmen?</p>
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
              disabled={previewLoading || options.length === 0}
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
        title="Kit beitreten"
        confirmLabel="Kit beitreten"
        loading={joinMutation.isPending}
        onConfirm={() => void handleConfirm()}
        description={
          <div className="space-y-3 text-left text-sm text-foreground">
            <p>
              Du übernimmst {formatKitQuantity(quantity, categoryId, request.kitSizeVials)}.
            </p>
            {previewPrice != null ? (
              <div>
                <p className="text-xs text-muted-foreground">Dein Anteil</p>
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
