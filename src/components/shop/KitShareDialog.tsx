import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";

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
import { QUERY_KEYS } from "@/lib/constants";
import { useAuth } from "@/context/AuthProvider";
import { formatUsd } from "@/lib/money";
import { variantLabelForProduct, type ShopProductGroup } from "@/lib/shop/display";
import {
  kitShareableVariants,
  kitSizeVialsForProduct,
  variantStrengthLabel,
} from "@/lib/shop/variantCoverage";
import type { KitShareMember } from "@/services/kitShareMembers";
import {
  addKitShareToCart,
  assertKitSharePricePrivacy,
  createKitShare,
  inviteKitShareParticipant,
  type KitShareView,
  updateKitShareQuantity,
} from "@/services/kitShares";
import type { Tables } from "@/types/database";

interface KitShareDialogProps {
  group: ShopProductGroup;
  initialProductId?: string;
  members: KitShareMember[];
  membersLoading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCartSynced?: () => void;
}

function resolveInitialVariantId(
  shareableVariants: readonly Tables<"products">[],
  initialProductId?: string,
): string {
  if (shareableVariants.length === 0) return "";
  if (initialProductId && shareableVariants.some((variant) => variant.id === initialProductId)) {
    return initialProductId;
  }
  return shareableVariants.length === 1 ? shareableVariants[0].id : "";
}

function kitSyncErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (/42501|403|permission/i.test(message)) {
    return "Der Kit Anteil konnte nicht synchronisiert werden.";
  }
  if (/P0001|22023|P0002|42703/i.test(message)) {
    return "Der Kit Anteil konnte nicht synchronisiert werden.";
  }
  return message || "Der Kit Anteil konnte nicht synchronisiert werden.";
}

export function KitShareDialog({
  group,
  initialProductId,
  members,
  membersLoading,
  open,
  onOpenChange,
  onCartSynced,
}: KitShareDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const shareableVariants = React.useMemo(() => kitShareableVariants(group.variants), [group.variants]);
  const [selectedVariantId, setSelectedVariantId] = React.useState(() =>
    resolveInitialVariantId(shareableVariants, initialProductId),
  );
  const product = shareableVariants.find((variant) => variant.id === selectedVariantId) ?? null;
  const kitSize = product ? kitSizeVialsForProduct(product) ?? 0 : 0;
  const hasMultipleShareableVariants = shareableVariants.length > 1;
  const strengthLabel = product ? variantStrengthLabel(product) : null;

  const [myQuantity, setMyQuantity] = React.useState("1");
  const [selectedMemberId, setSelectedMemberId] = React.useState("");
  const [memberQuantity, setMemberQuantity] = React.useState("1");
  const [kitView, setKitView] = React.useState<KitShareView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function invalidateCarts() {
    if (!user) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.carts(user.id) }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cartSummaries(user.id) }),
    ]);
  }

  function resetDialogState() {
    setMyQuantity("1");
    setSelectedMemberId("");
    setMemberQuantity("1");
    setKitView(null);
    setError(null);
    setBusy(false);
    setSelectedVariantId(resolveInitialVariantId(shareableVariants, initialProductId));
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetDialogState();
    onOpenChange(nextOpen);
  }

  if (shareableVariants.length === 0) return null;

  const quantityOptions = Array.from({ length: kitSize }, (_, i) => i + 1);
  const variantMissing = hasMultipleShareableVariants && !product;

  async function handleCreateKit() {
    if (!product) {
      setError("Bitte zuerst eine Produktstärke auswählen.");
      return;
    }
    const qty = Number(myQuantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > kitSize) {
      setError("Bitte eine gültige Menge wählen.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const view = await createKitShare(product.id, kitSize, qty);
      assertKitSharePricePrivacy(view);
      setKitView(view);
      await invalidateCarts();
      toast.success("Kit wurde erstellt. Dein Kit Anteil wurde dem Warenkorb hinzugefügt.");
    } catch (err) {
      setError(kitSyncErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleMyQuantityChange(value: string) {
    setMyQuantity(value);
    if (!kitView) return;
    const qty = Number(value);
    if (!Number.isInteger(qty) || qty < 1) return;
    setBusy(true);
    setError(null);
    try {
      const view = await updateKitShareQuantity(kitView.id, qty);
      assertKitSharePricePrivacy(view);
      setKitView(view);
      await invalidateCarts();
      toast.success("Dein Kit Anteil wurde im Warenkorb aktualisiert.");
    } catch (err) {
      setError(kitSyncErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddMember() {
    if (!kitView || !selectedMemberId) return;
    const qty = Number(memberQuantity);
    if (!Number.isInteger(qty) || qty < 1) {
      setError("Bitte eine gültige Menge wählen.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const view = await inviteKitShareParticipant(kitView.id, selectedMemberId, qty);
      assertKitSharePricePrivacy(view);
      setKitView(view);
      setSelectedMemberId("");
      setMemberQuantity("1");
      await invalidateCarts();
      toast.success(
        view.canAddToCart
          ? "Kit Anteil erfolgreich zugewiesen. Alle Anteile wurden synchronisiert."
          : "Kit Anteil erfolgreich zugewiesen. Der Anteil wurde dem Warenkorb des Teilnehmers hinzugefügt.",
      );
    } catch (err) {
      setError(kitSyncErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleFinish() {
    if (!kitView) return;
    setBusy(true);
    setError(null);
    try {
      if (kitView.canAddToCart) {
        await addKitShareToCart(kitView.id);
      }
      await invalidateCarts();
      onCartSynced?.();
      handleOpenChange(false);
    } catch (err) {
      setError(kitSyncErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function handleVariantChange(value: string) {
    if (kitView) {
      setError("Die Produktstärke kann nach Kit-Erstellung nicht mehr geändert werden.");
      return;
    }
    setSelectedVariantId(value);
    setError(null);
  }

  const lockedProductName = kitView?.productName ?? group.displayName;
  const lockedStrengthLabel = kitView
    ? variantStrengthLabel({
        code: kitView.productCode,
        name: kitView.productName,
        dosage_vial: product?.dosage_vial ?? null,
      })
    : strengthLabel;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Kit teilen
          </DialogTitle>
          <DialogDescription>
            Verteile ein {kitSize || "…"}-Vial-Kit auf mehrere Mitglieder. Anteile werden automatisch in die
            Warenkörbe synchronisiert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Produkt</p>
              <p className="font-medium">{lockedProductName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Stärke</p>
              {kitView || !hasMultipleShareableVariants ? (
                <p className="font-medium">{lockedStrengthLabel ?? "Standard"}</p>
              ) : (
                <Select value={selectedVariantId || undefined} onValueChange={handleVariantChange} disabled={busy}>
                  <SelectTrigger className="min-w-[11rem] w-full" aria-label="Produktstärke wählen">
                    <SelectValue placeholder="Stärke wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {shareableVariants.map((variant) => (
                      <SelectItem key={variant.id} value={variant.id}>
                        {variantLabelForProduct(variant)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Kit</p>
              <p className="font-medium">{kitSize} Vials</p>
            </div>
          </div>

          {variantMissing && (
            <p className="text-sm text-muted-foreground">Bitte zuerst eine Produktstärke auswählen.</p>
          )}

          <div className="space-y-2">
            <Label>Mein Anteil</Label>
            <Select
              value={myQuantity}
              onValueChange={kitView ? handleMyQuantityChange : setMyQuantity}
              disabled={busy || variantMissing || (kitView != null && kitView.status !== "open" && kitView.status !== "full")}
            >
              <SelectTrigger className="min-w-[11rem] w-full" aria-label="Meine Kit-Menge">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {quantityOptions.map((qty) => (
                  <SelectItem key={qty} value={String(qty)}>
                    {qty} Vial{qty === 1 ? "" : "s"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!kitView ? (
            <Button type="button" className="w-full" onClick={handleCreateKit} disabled={busy || variantMissing}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kit erstellen"}
            </Button>
          ) : (
            <>
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mitglied hinzufügen</p>
                <Select value={selectedMemberId} onValueChange={setSelectedMemberId} disabled={membersLoading || busy}>
                  <SelectTrigger className="min-w-[11rem] w-full" aria-label="Mitglied auswählen">
                    <SelectValue placeholder={membersLoading ? "Mitglieder werden geladen …" : "Mitglied auswählen"} />
                  </SelectTrigger>
                  <SelectContent>
                    {members.length === 0 && !membersLoading ? (
                      <SelectItem value="__none__" disabled>
                        Keine weiteren Mitglieder verfügbar
                      </SelectItem>
                    ) : (
                      members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.displayName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Select value={memberQuantity} onValueChange={setMemberQuantity} disabled={busy}>
                    <SelectTrigger className="w-[120px] min-w-[7rem]" aria-label="Menge für Mitglied">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {quantityOptions.map((qty) => (
                        <SelectItem key={qty} value={String(qty)}>
                          {qty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="secondary" onClick={handleAddMember} disabled={!selectedMemberId || busy}>
                    Hinzufügen
                  </Button>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="font-medium">Verteilung</p>
                {kitView.participants.map((p) => (
                  <div key={`${p.displayName}-${p.quantity}-${p.isSelf}`} className="flex justify-between text-muted-foreground">
                    <span>{p.displayName}</span>
                    <span>{p.quantity} Vials</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2">
                  <p>
                    Vergeben: {kitView.allocatedTotal} / {kitView.kitSizeVials} Vials
                  </p>
                  {kitView.remainingVials > 0 ? (
                    <p className="text-muted-foreground">Noch {kitView.remainingVials} Vials verfügbar.</p>
                  ) : (
                    <p className="font-medium text-success">Kit vollständig verteilt · Warenkörbe synchronisiert</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Mein Preis (nur für dich sichtbar)</p>
                <p className="text-lg font-semibold tabular-nums">{formatUsd(kitView.myPriceUsd)}</p>
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        {kitView && (
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button type="button" className="w-full" disabled={!kitView.canAddToCart || busy} onClick={handleFinish}>
              Fertig
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => handleOpenChange(false)}>
              Schließen
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function KitShareButton({
  group,
  selectedProductId,
  onClick,
}: {
  group: ShopProductGroup;
  selectedProductId: string;
  onClick: () => void;
}) {
  const shareableVariants = kitShareableVariants(group.variants);
  if (shareableVariants.length === 0) return null;

  const selectedIsShareable = shareableVariants.some((variant) => variant.id === selectedProductId);
  const needsVariantPick = shareableVariants.length > 1 && !selectedIsShareable;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 shrink-0"
      onClick={onClick}
      disabled={needsVariantPick}
      title={needsVariantPick ? "Bitte zuerst eine Produktstärke auswählen." : undefined}
    >
      <Users className="mr-1.5 h-4 w-4" />
      Kit teilen
    </Button>
  );
}
