import * as React from "react";

import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { useCartItemMutations } from "@/hooks/useCartItems";
import { ConcurrencyError } from "@/lib/errors";
import { isValidQuantity } from "@/lib/money";
import { toast } from "@/components/ui/toaster";
import type { SaveStatus } from "@/components/common/SaveStatusIndicator";
import type { Tables } from "@/types/database";
import type { ComputedCartItem } from "@/hooks/useCartComputed";

/**
 * Encapsulates the "Excel cell" editing behaviour for one cart_item row:
 * local input state, debounced autosave, per-field save status, and
 * optimistic-concurrency conflict handling. Shared between the desktop
 * table row and the mobile card view so both stay in sync.
 */
export function useCartItemRow(item: ComputedCartItem, cartId: string, currentRate: number | null) {
  const mutations = useCartItemMutations(cartId);

  const [codeInput, setCodeInput] = React.useState(item.product_code_input);
  const [quantityInput, setQuantityInput] = React.useState(String(item.quantity));
  const [noteInput, setNoteInput] = React.useState(item.note ?? "");
  const [quantityError, setQuantityError] = React.useState<string | null>(null);
  const [codeStatus, setCodeStatus] = React.useState<SaveStatus>("idle");
  const [quantityStatus, setQuantityStatus] = React.useState<SaveStatus>("idle");
  const [noteStatus, setNoteStatus] = React.useState<SaveStatus>("idle");

  // Keep local input state synced when the server row changes (e.g. after a
  // price refresh triggered elsewhere, or a realtime update from another
  // tab). This is the "adjust state when a prop changes" pattern React's own
  // docs endorse (https://react.dev/learn/you-might-not-need-an-effect); it
  // is intentionally scoped to one field per effect so unrelated edits don't
  // clobber each other's in-flight input.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setCodeInput(item.product_code_input), [item.product_code_input]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setQuantityInput(String(item.quantity)), [item.quantity]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setNoteInput(item.note ?? ""), [item.note]);

  function handleConflict(refetchLabel: string) {
    toast.error(`${refetchLabel} wurde zwischenzeitlich geändert. Die Zeile wurde aktualisiert.`, {
      description: "Bitte prüfe den neuen Stand, bevor du erneut speicherst.",
    });
  }

  const commitCode = React.useCallback(
    async (value: string) => {
      if (value.trim() === "" || value === item.product_code_snapshot || value === item.product_code_input) {
        if (value.trim() === "") return;
      }
      setCodeStatus("saving");
      try {
        await mutations.updateCode.mutateAsync({ item, newCode: value, rate: currentRate });
        setCodeStatus("saved");
      } catch (error) {
        setCodeStatus("error");
        if (error instanceof ConcurrencyError) handleConflict("Diese Zeile");
        else toast.error("Artikelcode konnte nicht gespeichert werden.");
      }
    },
    [item, mutations.updateCode, currentRate],
  );

  const commitQuantity = React.useCallback(
    async (raw: string) => {
      const normalized = Number(raw.replace(",", "."));
      if (!isValidQuantity(normalized)) {
        setQuantityError("Menge muss zwischen 0,001 und 100.000 liegen.");
        return;
      }
      setQuantityError(null);
      if (normalized === item.quantity) return;
      setQuantityStatus("saving");
      try {
        await mutations.updateQuantity.mutateAsync({ item, quantity: normalized });
        setQuantityStatus("saved");
      } catch (error) {
        setQuantityStatus("error");
        if (error instanceof ConcurrencyError) handleConflict("Diese Zeile");
        else toast.error("Menge konnte nicht gespeichert werden.");
      }
    },
    [item, mutations.updateQuantity],
  );

  const commitNote = React.useCallback(
    async (value: string) => {
      if (value === (item.note ?? "")) return;
      setNoteStatus("saving");
      try {
        await mutations.updateNote.mutateAsync({ item, note: value });
        setNoteStatus("saved");
      } catch (error) {
        setNoteStatus("error");
        if (error instanceof ConcurrencyError) handleConflict("Diese Zeile");
        else toast.error("Notiz konnte nicht gespeichert werden.");
      }
    },
    [item, mutations.updateNote],
  );

  const { debounced: debouncedQuantity, flush: flushQuantity } = useDebouncedCallback(commitQuantity, 700);
  const { debounced: debouncedNote, flush: flushNote } = useDebouncedCallback(commitNote, 900);

  function onCodeChange(value: string) {
    setCodeInput(value);
  }
  function onCodeBlur() {
    void commitCode(codeInput);
  }
  function onQuantityChange(value: string) {
    setQuantityInput(value);
    debouncedQuantity(value);
  }
  function onQuantityBlur() {
    flushQuantity();
  }
  function onNoteChange(value: string) {
    setNoteInput(value);
    debouncedNote(value);
  }
  function onNoteBlur() {
    flushNote();
  }

  async function remove() {
    try {
      await mutations.remove.mutateAsync(item.id);
    } catch {
      toast.error("Position konnte nicht gelöscht werden.");
    }
  }

  async function duplicate(nextPosition: number) {
    try {
      await mutations.duplicate.mutateAsync({ item: item as Tables<"cart_items">, nextPosition });
    } catch {
      toast.error("Position konnte nicht dupliziert werden.");
    }
  }

  return {
    codeInput,
    quantityInput,
    noteInput,
    quantityError,
    codeStatus,
    quantityStatus,
    noteStatus,
    onCodeChange,
    onCodeBlur,
    onQuantityChange,
    onQuantityBlur,
    onNoteChange,
    onNoteBlur,
    remove,
    duplicate,
    removing: mutations.remove.isPending,
    duplicating: mutations.duplicate.isPending,
  };
}
