import * as React from "react";

import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useCreateKitRequest } from "@/hooks/useKitRequests";
import { useShopProducts } from "@/hooks/useShopProducts";
import { isValidCreatorQuantity } from "@/lib/kitRequests";
import type { ShopAreaKey } from "@/lib/shop/shopAreas";
import { groupAndSortShopProducts } from "@/lib/shop/display";
import { KIT_SIZE_OPTIONS, formatKitSizeOption, kitCategoryIdFor } from "@/lib/shop/kitUnits";
import { formatProductVariant, kitShareableVariants } from "@/lib/shop/variantCoverage";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

const STEPS = [
  { title: "Was möchtest du mit anderen teilen?", body: "Wähle zuerst das Produkt aus." },
  { title: "Welche Variante möchtest du?", body: "Wähle die Variante, die du gemeinsam mit anderen kaufen möchtest." },
  { title: "Wie groß soll das gemeinsame Kit sein?", body: "Ein Kit besteht aus mehreren Vials. Du kannst einen Teil selbst übernehmen und den Rest anderen Kunden anbieten." },
  { title: "Wie viele möchtest du selbst übernehmen?", body: "Du übernimmst diesen Anteil selbst. Die übrigen Plätze können andere Kunden übernehmen." },
  { title: "Möchtest du etwas dazuschreiben?", body: "Optional kannst du anderen Kunden einen kurzen Hinweis geben." },
  { title: "Fast geschafft", body: "Prüfe kurz, ob alles stimmt." },
] as const;

interface CreateKitRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shopArea: ShopAreaKey;
  initialProductId?: string;
  onCreated?: (id: string) => void;
}

export function CreateKitRequestDialog({
  open,
  onOpenChange,
  shopArea,
  initialProductId,
  onCreated,
}: CreateKitRequestDialogProps) {
  if (!open) return null;
  return (
    <CreateKitRequestWizard
      shopArea={shopArea}
      initialProductId={initialProductId}
      onOpenChange={onOpenChange}
      onCreated={onCreated}
    />
  );
}

function CreateKitRequestWizard({
  shopArea,
  initialProductId,
  onOpenChange,
  onCreated,
}: {
  shopArea: ShopAreaKey;
  initialProductId?: string;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const productsQuery = useShopProducts(shopArea);
  const createMutation = useCreateKitRequest();
  const rateQuery = useExchangeRate();
  const groups = React.useMemo(
    () => groupAndSortShopProducts(productsQuery.data ?? []),
    [productsQuery.data],
  );

  const preset = (() => {
    if (!initialProductId) return { groupKey: "", productId: "" };
    for (const group of groups) {
      const shareable = kitShareableVariants(group.variants);
      if (shareable.some((variant) => variant.id === initialProductId)) {
        return { groupKey: group.groupKey, productId: initialProductId };
      }
    }
    return { groupKey: "", productId: initialProductId };
  })();

  const [step, setStep] = React.useState(initialProductId ? 2 : 0);
  const [pickedGroupKey, setPickedGroupKey] = React.useState<string | undefined>(undefined);
  const [pickedProductId, setPickedProductId] = React.useState<string | undefined>(undefined);
  const [kitSize, setKitSize] = React.useState(10);
  const [myQuantity, setMyQuantity] = React.useState(1);
  const [note, setNote] = React.useState("");
  const [created, setCreated] = React.useState<{
    id: string;
    quantity: number;
    remaining: number;
    priceUsd: number | null;
  } | null>(null);

  const groupKey = pickedGroupKey ?? preset.groupKey;
  const selectedGroup = groups.find((group) => group.groupKey === groupKey || group.displayName === groupKey);
  const variants = selectedGroup ? kitShareableVariants(selectedGroup.variants) : [];
  const productId =
    pickedProductId !== undefined
      ? pickedProductId || (variants.length === 1 ? variants[0].id : "")
      : preset.productId || (variants.length === 1 ? variants[0].id : "");
  const selectedProduct = variants.find((variant) => variant.id === productId) as Tables<"products"> | undefined;
  const categoryId = kitCategoryIdFor(selectedProduct ?? { category: "PEPTIDES" });
  const maxCreatorQty = Math.max(1, kitSize - 1);
  const creatorQuantity = Math.min(myQuantity, maxCreatorQty);
  const remainingAfter = kitSize - creatorQuantity;

  function close() {
    setStep(initialProductId ? 2 : 0);
    setPickedGroupKey(undefined);
    setPickedProductId(undefined);
    setKitSize(10);
    setMyQuantity(1);
    setNote("");
    setCreated(null);
    onOpenChange(false);
  }

  function canContinue() {
    if (step === 0) return Boolean(groupKey);
    if (step === 1) return Boolean(selectedProduct);
    if (step >= 2) return Boolean(selectedProduct) && isValidCreatorQuantity(kitSize, creatorQuantity);
    return true;
  }

  async function handleCreate() {
    if (!selectedProduct) {
      toast.error("Bitte wähle Produkt und Variante.");
      return;
    }
    if (!isValidCreatorQuantity(kitSize, creatorQuantity)) {
      toast.error("Es muss mindestens 1 Platz für andere Kunden offen bleiben.");
      return;
    }
    try {
      const card = await createMutation.mutateAsync({
        productId: selectedProduct.id,
        kitSizeVials: kitSize,
        myQuantity: creatorQuantity,
        note: note.trim() || null,
        shopArea,
      });
      setCreated({
        id: card.id,
        quantity: creatorQuantity,
        remaining: remainingAfter,
        priceUsd: card.myPriceUsd,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Das hat leider nicht funktioniert. Dein Kit wurde nicht verändert. Bitte versuche es noch einmal.",
      );
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        {created ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Kit Gesuch erstellt</DialogTitle>
              <DialogDescription>Dein Gesuch ist jetzt für andere Kunden sichtbar.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 rounded-xl bg-secondary/40 p-4 text-sm">
              <p>Dein Anteil: {created.quantity} von {kitSize}</p>
              <p>Noch gesucht: {created.remaining} von {kitSize}</p>
              {created.priceUsd != null ? (
                <div>
                  <p className="text-xs text-muted-foreground">Dein Anteil</p>
                  <DualCurrencyPrice usd={created.priceUsd} rate={rateQuery.data?.rate ?? null} size="summary" />
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="min-h-11 w-full" onClick={() => { onCreated?.(created.id); close(); }}>
                Gesuch ansehen
              </Button>
              <Button className="min-h-11 w-full" variant="outline" onClick={close}>
                Schließen
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <DialogHeader>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Schritt {step + 1} von {STEPS.length}
              </p>
              <DialogTitle>{STEPS[step].title}</DialogTitle>
              <DialogDescription>{STEPS[step].body}</DialogDescription>
            </DialogHeader>

            {step === 0 ? (
              <div className="grid gap-2">
                {groups.map((group) => (
                  <ChoiceButton
                    key={group.groupKey}
                    active={groupKey === group.groupKey}
                    onClick={() => {
                      setPickedGroupKey(group.groupKey);
                      setPickedProductId("");
                    }}
                    title={group.displayName}
                  />
                ))}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-2">
                {variants.map((variant) => (
                  <ChoiceButton
                    key={variant.id}
                    active={productId === variant.id}
                    onClick={() => setPickedProductId(variant.id)}
                    title={formatProductVariant(variant)}
                  />
                ))}
              </div>
            ) : null}

            {step >= 2 && step <= 4 && selectedProduct ? (
              <div className="rounded-xl border border-border px-4 py-3 text-sm">
                <p className="font-medium">{selectedGroup?.displayName}</p>
                <p className="text-muted-foreground">{formatProductVariant(selectedProduct)}</p>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="flex flex-wrap gap-2">
                {KIT_SIZE_OPTIONS.map((size) => (
                  <Button
                    key={size}
                    type="button"
                    variant={kitSize === size ? "default" : "outline"}
                    className="min-h-12 min-w-[5.5rem]"
                    onClick={() => {
                      setKitSize(size);
                      setMyQuantity((qty) => Math.min(qty, Math.max(1, size - 1)));
                    }}
                  >
                    {formatKitSizeOption(size, categoryId)}
                  </Button>
                ))}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: maxCreatorQty }, (_, index) => index + 1).map((qty) => (
                    <Button
                      key={qty}
                      type="button"
                      variant={creatorQuantity === qty ? "default" : "outline"}
                      className="min-h-12 min-w-12"
                      onClick={() => setMyQuantity(qty)}
                    >
                      {qty}
                    </Button>
                  ))}
                </div>
                <div className="rounded-xl bg-secondary/40 p-4 text-sm">
                  <p>Du übernimmst: {creatorQuantity} von {kitSize}</p>
                  <p>Noch gesucht: {remainingAfter} von {kitSize}</p>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <Textarea
                value={note}
                maxLength={280}
                onChange={(event) => setNote(event.target.value)}
                placeholder="z. B. bevorzugte Aufteilung"
              />
            ) : null}

            {step === 5 ? (
              <div className="space-y-3 rounded-xl bg-secondary/40 p-4 text-sm">
                <SummaryRow label="Produkt" value={selectedGroup?.displayName ?? "—"} />
                <SummaryRow label="Variante" value={selectedProduct ? formatProductVariant(selectedProduct) : "—"} />
                <SummaryRow label="Gesamtes Kit" value={`${kitSize} Vials`} />
                <SummaryRow label="Dein Anteil" value={`${creatorQuantity} Vials`} />
                <SummaryRow label="Noch gesucht" value={`${remainingAfter} Vials`} />
                {selectedProduct ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Dein voraussichtlicher Anteil</p>
                    <DualCurrencyPrice
                      usd={selectedProduct.price_usd * creatorQuantity}
                      rate={rateQuery.data?.rate ?? null}
                      size="summary"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Der genaue Anteilspreis wird beim Erstellen bestätigt.
                    </p>
                  </div>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  Du übernimmst deinen Anteil. Andere Kunden können die übrigen Vials übernehmen. Sobald das Kit
                  vollständig aufgeteilt ist, wird es gemeinsam abgewickelt.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                className="min-h-11 w-full sm:w-auto"
                variant="outline"
                onClick={() => (step === 0 ? close() : setStep((value) => value - 1))}
              >
                {step === 0 ? "Abbrechen" : "Zurück"}
              </Button>
              {step < STEPS.length - 1 ? (
                <Button className="min-h-11 w-full sm:w-auto" disabled={!canContinue()} onClick={() => setStep((value) => value + 1)}>
                  Weiter
                </Button>
              ) : (
                <Button
                  className="min-h-11 w-full sm:w-auto"
                  disabled={createMutation.isPending || !canContinue()}
                  onClick={() => void handleCreate()}
                >
                  {createMutation.isPending ? "Wird erstellt …" : "Kit Gesuch erstellen"}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChoiceButton({
  active,
  title,
  onClick,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
        active ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-primary/50",
      )}
    >
      {title}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
