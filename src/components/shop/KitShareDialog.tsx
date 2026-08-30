import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, UserX, Users } from "lucide-react";

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
import { toast } from "@/components/ui/toaster";
import { QUERY_KEYS } from "@/lib/constants";
import { useAuth } from "@/context/AuthProvider";
import { formatUsd } from "@/lib/money";
import { variantLabelForProduct, type ShopProductGroup } from "@/lib/shop/display";
import {
  KIT_INVALID_TOTAL_MESSAGE,
  validateFullKitDistribution,
  validateKitAllocation,
} from "@/lib/shop/kitShare";
import {
  formatKitQuantity,
  KIT_SIZE_OPTIONS,
  kitQuantityUnitLabel,
} from "@/lib/shop/kitUnits";
import {
  kitShareableVariants,
  variantStrengthLabel,
} from "@/lib/shop/variantCoverage";
import type { KitShareMember } from "@/services/kitShareMembers";
import {
  assertKitSharePricePrivacy,
  createKitShare,
  getMyKitShare,
  inviteKitShareParticipant,
  type KitShareView,
  removeKitShareParticipant,
  updateKitShareDistribution,
  updateKitShareQuantity,
} from "@/services/kitShares";
import type { Tables } from "@/types/database";

interface KitShareDialogProps {
  /** Omit when opening an existing kit purely for editing (e.g. from Cart/Checkout). */
  group?: ShopProductGroup;
  initialProductId?: string;
  /** Opens directly into "edit existing kit" mode instead of "create new kit". */
  existingKitShareId?: string;
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
  if (/Verteilung|Kit Verteilung|Gesamtmenge|teilbar/i.test(message)) {
    return message;
  }
  if (/42501|403|permission/i.test(message)) {
    return "Der Kit Anteil konnte nicht synchronisiert werden.";
  }
  if (/P0001|22023|P0002|42703/i.test(message)) {
    return message || "Der Kit Anteil konnte nicht synchronisiert werden.";
  }
  return message || "Der Kit Anteil konnte nicht synchronisiert werden.";
}

export function KitShareDialog({
  group,
  initialProductId,
  existingKitShareId,
  members,
  membersLoading,
  open,
  onOpenChange,
  onCartSynced: _onCartSynced,
}: KitShareDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const shareableVariants = React.useMemo(
    () => (group ? kitShareableVariants(group.variants) : []),
    [group],
  );
  const [selectedVariantId, setSelectedVariantId] = React.useState(() =>
    resolveInitialVariantId(shareableVariants, initialProductId),
  );
  const product = shareableVariants.find((variant) => variant.id === selectedVariantId) ?? null;
  const hasMultipleShareableVariants = shareableVariants.length > 1;
  const unitLabel = product ? kitQuantityUnitLabel(product) : "Vials";

  const [selectedKitSize, setSelectedKitSize] = React.useState(String(KIT_SIZE_OPTIONS[0]));
  const kitSize = Number(selectedKitSize) || KIT_SIZE_OPTIONS[0];

  const [myQuantity, setMyQuantity] = React.useState("1");
  const [selectedMemberId, setSelectedMemberId] = React.useState("");
  const [memberQuantity, setMemberQuantity] = React.useState("1");
  const [kitView, setKitView] = React.useState<KitShareView | null>(null);
  const [editMode, setEditMode] = React.useState(false);
  const [editQuantities, setEditQuantities] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [loadingExisting, setLoadingExisting] = React.useState(false);

  React.useEffect(() => {
    if (!open || !existingKitShareId || kitView) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoadingExisting(true);
        setError(null);
      }
    });
    getMyKitShare(existingKitShareId)
      .then((view) => {
        if (cancelled) return;
        assertKitSharePricePrivacy(view);
        setKitView(view);
      })
      .catch((err) => {
        if (!cancelled) setError(kitSyncErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, existingKitShareId, kitView]);

  const activeKitSize = kitView?.kitSizeVials ?? kitSize;

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
    setEditMode(false);
    setEditQuantities({});
    setError(null);
    setBusy(false);
    setSelectedKitSize(String(KIT_SIZE_OPTIONS[0]));
    setSelectedVariantId(resolveInitialVariantId(shareableVariants, initialProductId));
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetDialogState();
    onOpenChange(nextOpen);
  }

  if (!existingKitShareId && shareableVariants.length === 0) return null;

  const quantityOptions = Array.from({ length: activeKitSize }, (_, i) => i + 1);
  const variantMissing = hasMultipleShareableVariants && !product;

  const editParticipants = kitView?.participants ?? [];
  const editTotal = editParticipants.reduce((sum, p) => {
    const raw = editQuantities[p.displayName] ?? String(p.quantity);
    const qty = Number(raw);
    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);

  const editValidation = kitView
    ? validateFullKitDistribution(activeKitSize, editParticipants.map((p) => ({
        quantity: Number(editQuantities[p.displayName] ?? p.quantity) || 0,
      })))
    : null;

  async function handleCreateKit() {
    if (!product) {
      setError("Bitte zuerst eine Variante auswählen.");
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

    const allocation = validateKitAllocation(kitView.kitSizeVials, [
      { quantity: qty },
      ...kitView.participants.filter((p) => !p.isSelf).map((p) => ({ quantity: p.quantity })),
    ]);
    if (!allocation.ok) {
      setError(allocation.message);
      return;
    }

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
        view.status === "full"
          ? "Kit Anteil erfolgreich zugewiesen. Alle Anteile wurden synchronisiert."
          : "Kit Anteil erfolgreich zugewiesen. Der Anteil wurde dem Warenkorb des Teilnehmers hinzugefügt.",
      );
    } catch (err) {
      setError(kitSyncErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function startEditMode() {
    if (!kitView) return;
    const initial: Record<string, string> = {};
    for (const p of kitView.participants) {
      initial[p.displayName] = String(p.quantity);
    }
    setEditQuantities(initial);
    setEditMode(true);
    setError(null);
  }

  function handleEditQuantityChange(displayName: string, value: string) {
    setEditQuantities((prev) => ({ ...prev, [displayName]: value }));
  }

  async function handleSaveDistribution() {
    if (!kitView || !user) return;

    const distribution = kitView.participants.map((p) => {
      const userId = p.isSelf ? user.id : p.userId;
      if (!userId) {
        throw new Error("Teilnehmer-ID fehlt");
      }
      return {
        userId,
        quantity: Number(editQuantities[p.displayName] ?? p.quantity),
      };
    });

    if (distribution.some((d) => !Number.isInteger(d.quantity) || d.quantity < 1)) {
      setError("Bitte gültige Mengen für alle Teilnehmer eingeben.");
      return;
    }

    const validation = validateFullKitDistribution(
      kitView.kitSizeVials,
      distribution.map((d) => ({ quantity: d.quantity })),
    );
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const view = await updateKitShareDistribution(kitView.id, distribution);
      assertKitSharePricePrivacy(view);
      setKitView(view);
      setEditMode(false);
      await invalidateCarts();
      toast.success("Verteilung gespeichert. Alle Warenkörbe wurden synchronisiert.");
    } catch (err) {
      setError(kitSyncErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function handleVariantChange(value: string) {
    if (kitView) {
      setError("Die Variante kann nach Kit-Erstellung nicht mehr geändert werden.");
      return;
    }
    setSelectedVariantId(value);
    setError(null);
  }

  async function handleRemoveParticipant(participantUserId: string) {
    if (!kitView) return;
    setBusy(true);
    setError(null);
    try {
      const view = await removeKitShareParticipant(kitView.id, participantUserId);
      assertKitSharePricePrivacy(view);
      setKitView(view);
      await invalidateCarts();
      toast.success("Teilnehmer wurde entfernt. Warenkörbe wurden synchronisiert.");
    } catch (err) {
      setError(kitSyncErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const lockedProductName = kitView?.productName ?? group?.displayName ?? "Produkt";
  const lockedVariantLabel = kitView
    ? variantStrengthLabel({
        code: kitView.productCode,
        name: kitView.productName,
        dosage_vial: product?.dosage_vial ?? null,
      })
    : product
      ? variantLabelForProduct(product)
      : null;

  const isCreator = Boolean(kitView && user && kitView.isCreator);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Kit teilen
          </DialogTitle>
          <DialogDescription>
            Teile ein gemeinsames {activeKitSize}-Einheiten-Kit. Anteile werden automatisch in die Warenkörbe
            synchronisiert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
            <div>
              <p className="text-xs text-muted-foreground">Produkt</p>
              <p className="font-medium">{lockedProductName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Variante</p>
              {kitView || !hasMultipleShareableVariants ? (
                <p className="font-medium">{lockedVariantLabel ?? "Standard"}</p>
              ) : (
                <Select value={selectedVariantId || undefined} onValueChange={handleVariantChange} disabled={busy}>
                  <SelectTrigger className="min-w-[11rem] w-full" aria-label="Variante wählen">
                    <SelectValue placeholder="Variante wählen" />
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
              <p className="text-xs text-muted-foreground">Kitgröße</p>
              {kitView ? (
                <p className="font-medium">
                  {activeKitSize} {unitLabel}
                </p>
              ) : (
                <Select value={selectedKitSize} onValueChange={setSelectedKitSize} disabled={busy || variantMissing}>
                  <SelectTrigger className="min-w-[11rem] w-full" aria-label="Kitgröße wählen">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KIT_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} {unitLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {variantMissing && (
            <p className="text-sm text-muted-foreground">Bitte zuerst eine Variante auswählen.</p>
          )}

          {loadingExisting && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Kit wird geladen …
            </div>
          )}

          {!kitView && !existingKitShareId && (
            <div className="space-y-2">
              <Label>Mein Anteil</Label>
              <Select value={myQuantity} onValueChange={setMyQuantity} disabled={busy || variantMissing}>
                <SelectTrigger className="min-w-[11rem] w-full" aria-label="Meine Kit-Menge">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {quantityOptions.map((qty) => (
                    <SelectItem key={qty} value={String(qty)}>
                      {formatKitQuantity(qty, unitLabel)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" className="w-full" onClick={handleCreateKit} disabled={busy || variantMissing}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kit erstellen"}
              </Button>
            </div>
          )}

          {kitView && !editMode && (
            <>
              <div className="space-y-2">
                <Label>Mein Anteil</Label>
                <Select
                  value={String(kitView.myQuantity)}
                  onValueChange={handleMyQuantityChange}
                  disabled={
                    busy || kitView.status === "cancelled" || kitView.status === "ordered" || kitView.myHasOrdered
                  }
                >
                  <SelectTrigger className="min-w-[11rem] w-full" aria-label="Meine Kit-Menge">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {quantityOptions.map((qty) => (
                      <SelectItem key={qty} value={String(qty)}>
                        {formatKitQuantity(qty, unitLabel)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {kitView.myHasOrdered && (
                  <p className="text-xs text-muted-foreground">
                    Du hast diesen Kit-Anteil bereits bestellt. Deine Menge ist ein fester Bestellwert und kann nicht
                    mehr geändert werden.
                  </p>
                )}
              </div>

              {isCreator && kitView.status === "open" && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Mitglied hinzufügen
                  </p>
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
              )}

              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">Verteilung</p>
                  {isCreator && kitView.participants.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="h-8 gap-1" onClick={startEditMode} disabled={busy}>
                      <Pencil className="h-3.5 w-3.5" />
                      Verteilung bearbeiten
                    </Button>
                  )}
                </div>
                {kitView.participants.map((p) => (
                  <div
                    key={`${p.displayName}-${p.quantity}`}
                    className="flex items-center justify-between gap-2 text-muted-foreground"
                  >
                    <span className="truncate">
                      {p.displayName}
                      {p.hasOrdered && (
                        <span className="ml-1.5 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                          Bestellt
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span>{formatKitQuantity(p.quantity, unitLabel)}</span>
                      {isCreator &&
                        !p.isSelf &&
                        p.userId &&
                        !p.hasOrdered &&
                        kitView.status !== "cancelled" &&
                        kitView.status !== "ordered" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            title={`${p.displayName} entfernen`}
                            aria-label={`${p.displayName} entfernen`}
                            disabled={busy}
                            onClick={() => handleRemoveParticipant(p.userId as string)}
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </Button>
                        )}
                    </div>
                  </div>
                ))}
                <div className="border-t border-border pt-2">
                  <p>
                    Gesamt: {kitView.allocatedTotal} / {kitView.kitSizeVials} {unitLabel}
                  </p>
                  {kitView.status === "full" ? (
                    <p className="font-medium text-success">Kit vollständig · Warenkörbe synchronisiert</p>
                  ) : (
                    <p className="text-muted-foreground">
                      Noch {kitView.remainingVials} {unitLabel} verfügbar
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Mein Preis (nur für dich sichtbar)</p>
                <p className="text-lg font-semibold tabular-nums">{formatUsd(kitView.myPriceUsd)}</p>
              </div>
            </>
          )}

          {kitView && editMode && (
            <div className="space-y-3 rounded-lg border border-primary/30 p-3">
              <p className="font-medium">Verteilung bearbeiten</p>
              {kitView.participants.map((p) => (
                <div key={p.displayName} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {p.displayName}
                    {p.hasOrdered && (
                      <span className="ml-1.5 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                        Bestellt
                      </span>
                    )}
                  </span>
                  <Input
                    type="number"
                    min={1}
                    max={activeKitSize}
                    value={editQuantities[p.displayName] ?? String(p.quantity)}
                    onChange={(e) => handleEditQuantityChange(p.displayName, e.target.value)}
                    className="h-9 w-20 text-right tabular-nums"
                    disabled={busy || p.hasOrdered}
                    title={p.hasOrdered ? "Bereits bestellt: die Menge ist ein fester Bestellwert." : undefined}
                    aria-label={`Menge für ${p.displayName}`}
                  />
                </div>
              ))}
              <p className={editValidation?.ok === false ? "text-destructive" : "text-muted-foreground"}>
                Gesamt: {editTotal} / {activeKitSize} {unitLabel}
              </p>
              {editValidation?.ok === false && (
                <p className="text-sm text-destructive">
                  {editTotal % 10 !== 0 && editTotal === activeKitSize
                    ? KIT_INVALID_TOTAL_MESSAGE
                    : editValidation.message}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="flex-1"
                  disabled={busy || editValidation?.ok !== true}
                  onClick={handleSaveDistribution}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verteilung speichern"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditMode(false)} disabled={busy}>
                  Abbrechen
                </Button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        {kitView && !editMode && (
          <DialogFooter className="flex-col gap-2 sm:flex-col">
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
      title={needsVariantPick ? "Bitte zuerst eine Variante auswählen." : undefined}
    >
      <Users className="mr-1.5 h-4 w-4" />
      Kit teilen
    </Button>
  );
}
