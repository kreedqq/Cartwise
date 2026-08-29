import * as React from "react";
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
import { formatUsd } from "@/lib/money";
import { isKitShareableProduct, kitSizeVialsForProduct } from "@/lib/shop/variantCoverage";
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
  product: Tables<"products">;
  members: KitShareMember[];
  membersLoading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddedToCart?: () => void;
}

export function KitShareDialog({
  product,
  members,
  membersLoading,
  open,
  onOpenChange,
  onAddedToCart,
}: KitShareDialogProps) {
  const kitSize = kitSizeVialsForProduct(product) ?? 0;
  const [myQuantity, setMyQuantity] = React.useState("1");
  const [selectedMemberId, setSelectedMemberId] = React.useState("");
  const [memberQuantity, setMemberQuantity] = React.useState("1");
  const [kitView, setKitView] = React.useState<KitShareView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  function resetDialogState() {
    setMyQuantity("1");
    setSelectedMemberId("");
    setMemberQuantity("1");
    setKitView(null);
    setError(null);
    setBusy(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetDialogState();
    onOpenChange(nextOpen);
  }

  if (!isKitShareableProduct(product) || kitSize < 2) return null;

  const quantityOptions = Array.from({ length: kitSize }, (_, i) => i + 1);

  async function handleCreateKit() {
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
      toast.success("Kit wurde erstellt.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kit konnte nicht erstellt werden.");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Menge konnte nicht geändert werden.");
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
      toast.success("Mitglied wurde zum Kit hinzugefügt.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mitglied konnte nicht hinzugefügt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddToCart() {
    if (!kitView?.canAddToCart) {
      setError(`Noch ${kitView?.remainingVials ?? kitSize} Vials verfügbar. Das Kit muss vollständig verteilt sein.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addKitShareToCart(kitView.id);
      toast.success("Kit-Anteil wurde zum Warenkorb hinzugefügt.");
      onAddedToCart?.();
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kit-Anteil konnte nicht hinzugefügt werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Kit teilen
          </DialogTitle>
          <DialogDescription>
            Verteile ein {kitSize}-Vial-Kit auf mehrere Mitglieder. Bestellbar erst bei vollständiger Verteilung.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <p className="font-medium">{product.name}</p>
            <p className="text-muted-foreground">Kitgröße: {kitSize} Vials</p>
          </div>

          <div className="space-y-2">
            <Label>Mein Anteil</Label>
            <Select
              value={myQuantity}
              onValueChange={kitView ? handleMyQuantityChange : setMyQuantity}
              disabled={busy || (kitView != null && kitView.status !== "open" && kitView.status !== "full")}
            >
              <SelectTrigger aria-label="Meine Kit-Menge">
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
            <Button type="button" className="w-full" onClick={handleCreateKit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kit erstellen"}
            </Button>
          ) : (
            <>
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mitglied hinzufügen</p>
                <Select value={selectedMemberId} onValueChange={setSelectedMemberId} disabled={membersLoading || busy}>
                  <SelectTrigger aria-label="Mitglied auswählen">
                    <SelectValue placeholder={membersLoading ? "Mitglieder werden geladen …" : "Mitglied auswählen"} />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Select value={memberQuantity} onValueChange={setMemberQuantity} disabled={busy}>
                    <SelectTrigger className="w-[120px]" aria-label="Menge für Mitglied">
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
                    <p className="font-medium text-success">Kit vollständig verteilt</p>
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
            <Button type="button" className="w-full" disabled={!kitView.canAddToCart || busy} onClick={handleAddToCart}>
              Kit-Anteil in den Warenkorb
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
  product,
  onClick,
}: {
  product: Tables<"products">;
  onClick: () => void;
}) {
  if (!isKitShareableProduct(product)) return null;
  return (
    <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={onClick}>
      <Users className="mr-1.5 h-4 w-4" />
      Kit teilen
    </Button>
  );
}
