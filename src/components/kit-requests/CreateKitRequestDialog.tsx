import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { useCreateKitRequest } from "@/hooks/useKitRequests";
import { useShopProducts } from "@/hooks/useShopProducts";
import { isValidCreatorQuantity } from "@/lib/kitRequests";
import { groupAndSortShopProducts } from "@/lib/shop/display";
import { KIT_SIZE_OPTIONS, formatKitQuantity, formatKitSizeOption, kitCategoryIdFor } from "@/lib/shop/kitUnits";
import { formatProductVariant, kitShareableVariants } from "@/lib/shop/variantCoverage";
import type { Tables } from "@/types/database";

interface CreateKitRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateKitRequestDialog({ open, onOpenChange }: CreateKitRequestDialogProps) {
  const productsQuery = useShopProducts();
  const createMutation = useCreateKitRequest();
  const groups = React.useMemo(
    () => groupAndSortShopProducts(productsQuery.data ?? []),
    [productsQuery.data],
  );

  const [groupKey, setGroupKey] = React.useState("");
  const [productId, setProductId] = React.useState("");
  const [kitSize, setKitSize] = React.useState(10);
  const [myQuantity, setMyQuantity] = React.useState(1);
  const [note, setNote] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");

  const selectedGroup = groups.find((g) => g.groupKey === groupKey || g.displayName === groupKey);
  const variants = React.useMemo(
    () => (selectedGroup ? kitShareableVariants(selectedGroup.variants) : []),
    [selectedGroup],
  );
  const selectedProduct = variants.find((v) => v.id === productId) as Tables<"products"> | undefined;
  const categoryId = kitCategoryIdFor(selectedProduct ?? { category: "PEPTIDES" });
  const maxCreatorQty = Math.max(1, kitSize - 1);
  const creatorQuantity = Math.min(myQuantity, maxCreatorQty);

  function resetForm() {
    setGroupKey("");
    setProductId("");
    setKitSize(10);
    setMyQuantity(1);
    setNote("");
    setExpiresAt("");
  }

  async function handleSubmit() {
    if (!selectedProduct) {
      toast.error("Bitte wähle Produkt und Variante.");
      return;
    }
    if (!isValidCreatorQuantity(kitSize, creatorQuantity)) {
      toast.error("Ungültige Menge. Es muss mindestens 1 Einheit offen bleiben.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        productId: selectedProduct.id,
        kitSizeVials: kitSize,
        myQuantity: creatorQuantity,
        note: note.trim() || null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      toast.success("Kit-Gesuch wurde erstellt.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gesuch konnte nicht erstellt werden.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kit-Gesuch erstellen</DialogTitle>
          <DialogDescription>
            Du reservierst deinen eigenen Anteil. Andere Benutzer können die restlichen Einheiten übernehmen.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="kit-request-product">Produkt</Label>
            <Select
              value={groupKey}
              onValueChange={(value) => {
                setGroupKey(value);
                setProductId("");
              }}
            >
              <SelectTrigger id="kit-request-product" className="w-full">
                <SelectValue placeholder="Produkt wählen" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.groupKey} value={group.groupKey}>
                    {group.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kit-request-variant">Variante</Label>
            <Select value={productId} onValueChange={setProductId} disabled={variants.length === 0}>
              <SelectTrigger id="kit-request-variant" className="w-full">
                <SelectValue placeholder="Variante wählen" />
              </SelectTrigger>
              <SelectContent>
                {variants.map((variant) => (
                  <SelectItem key={variant.id} value={variant.id}>
                    {formatProductVariant(variant)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kit-request-size">Gesamtmenge</Label>
              <Select
                value={String(kitSize)}
                onValueChange={(value) => {
                  const next = Number(value);
                  setKitSize(next);
                  setMyQuantity((qty) => Math.min(qty, Math.max(1, next - 1)));
                }}
              >
                <SelectTrigger id="kit-request-size" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIT_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {formatKitSizeOption(size, categoryId)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kit-request-mine">Dein Anteil</Label>
              <Select value={String(creatorQuantity)} onValueChange={(value) => setMyQuantity(Number(value))}>
                <SelectTrigger id="kit-request-mine" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxCreatorQty }, (_, i) => i + 1).map((qty) => (
                    <SelectItem key={qty} value={String(qty)}>
                      {formatKitQuantity(qty, categoryId, kitSize)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Gesucht: {formatKitQuantity(kitSize - creatorQuantity, categoryId, kitSize)}
          </p>

          <div className="space-y-2">
            <Label htmlFor="kit-request-note">Hinweis (optional)</Label>
            <Textarea
              id="kit-request-note"
              value={note}
              maxLength={280}
              onChange={(event) => setNote(event.target.value)}
              placeholder="z. B. bevorzugte Aufteilung"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kit-request-expires">Ablaufdatum (optional)</Label>
            <Input
              id="kit-request-expires"
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => void handleSubmit()} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Wird erstellt …" : "Gesuch erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
