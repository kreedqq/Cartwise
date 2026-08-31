import * as React from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { useJoinKitRequest } from "@/hooks/useKitRequests";
import { remainingQuantityOptions } from "@/lib/kitRequests";
import { formatUsd } from "@/lib/money";
import { formatKitQuantity, kitQuantityUnitLabelForCategory } from "@/lib/shop/kitUnits";
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

  const unit = isShopCategoryId(request.category)
    ? kitQuantityUnitLabelForCategory(request.category as ShopCategoryId)
    : "Vials";

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
        toast.success("Das Kit ist vollständig. Die Artikel wurden deinem Warenkorb hinzugefügt.");
      } else {
        toast.success(`Du hast ${formatKitQuantity(result.myQuantity, unit)} reserviert.`);
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
            <DialogTitle>Kit beitreten</DialogTitle>
            <DialogDescription>
              {request.productName} · {request.variantLabel}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">Noch {formatKitQuantity(request.remainingVials, unit)} offen.</p>
            {request.myUnitPriceUsd != null ? (
              <p className="text-sm font-medium">
                Kit-Preis: {formatUsd(request.myUnitPriceUsd)} / {unit === "Stück" ? "Stück" : "Vial"}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="join-qty">Wie viele {unit} möchtest du?</Label>
              <Select value={String(quantity)} onValueChange={(value) => setQuantity(Number(value))}>
                <SelectTrigger id="join-qty" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((qty) => (
                    <SelectItem key={qty} value={String(qty)}>
                      {formatKitQuantity(qty, unit)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button
              className="w-full sm:w-auto"
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
        title="Teilnahme bestätigen"
        confirmLabel="Beitreten"
        loading={joinMutation.isPending}
        onConfirm={() => void handleConfirm()}
        description={
          <div className="space-y-2 text-left text-sm text-foreground">
            <p>
              <span className="font-medium">{request.productName}</span>
              <span className="block text-muted-foreground">{request.variantLabel}</span>
            </p>
            <p>Du möchtest: {formatKitQuantity(quantity, unit)}</p>
            {previewUnit != null ? (
              <p>
                {formatUsd(previewUnit)} / {unit === "Stück" ? "Stück" : "Vial"}
              </p>
            ) : null}
            {previewPrice != null ? <p className="font-semibold">Gesamt: {formatUsd(previewPrice)}</p> : null}
          </div>
        }
      />
    </>
  );
}
