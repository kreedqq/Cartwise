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
  const options = remainingQuantityOptions(request.remainingVials);
  const [quantity, setQuantity] = React.useState(options[0] ?? 1);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [previewPrice, setPreviewPrice] = React.useState<number | null>(null);
  const [previewUnit, setPreviewUnit] = React.useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);

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
      if (result.status === "full" && result.cartSynced) {
        toast.success("Du bist diesem Kit beigetreten. Das Kit ist vollständig. Die Artikel liegen in deinem Warenkorb.");
      } else {
        toast.success(
          `Du bist diesem Kit beigetreten. ${formatKitQuantity(result.myQuantity, categoryId, request.kitSizeVials)} · Wartet auf weitere Teilnehmer.`,
        );
      }
      setConfirmOpen(false);
      onOpenChange(false);
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
            <DialogTitle>Kit teilen</DialogTitle>
            <DialogDescription>
              {request.productName} · {request.variantLabel}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              Kit: {formatKitQuantity(request.kitSizeVials, categoryId, request.kitSizeVials)} · Bereits{" "}
              {request.allocatedTotal} / {request.kitSizeVials} · Noch verfügbar:{" "}
              {formatKitQuantity(request.remainingVials, categoryId, request.kitSizeVials)}
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
                <DualCurrencyPrice usd={liveTotal} size="summary" />
              ) : (
                <p className="text-sm text-muted-foreground">Preis erscheint nach der Bestätigung.</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Du zahlst nur für deinen Anteil.</p>
            </div>
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
              Du möchtest {formatKitQuantity(quantity, categoryId, request.kitSizeVials)} dieses Kits übernehmen.
            </p>
            {previewPrice != null ? (
              <div>
                <p className="text-xs text-muted-foreground">Dein Anteil</p>
                <DualCurrencyPrice usd={previewPrice} size="summary" />
              </div>
            ) : previewUnit != null ? (
              <DualCurrencyPrice usd={previewUnit * quantity} size="summary" />
            ) : null}
          </div>
        }
      />
    </>
  );
}
