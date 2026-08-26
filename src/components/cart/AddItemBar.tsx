import * as React from "react";
import { ClipboardPaste, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartItemMutations } from "@/hooks/useCartItems";
import { toast } from "@/components/ui/toaster";
import { isValidQuantity } from "@/lib/money";

interface AddItemBarProps {
  cartId: string;
  nextPosition: number;
  currentRate: number | null;
  onOpenPasteImport: () => void;
}

export function AddItemBar({ cartId, nextPosition, currentRate, onOpenPasteImport }: AddItemBarProps) {
  const [code, setCode] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const codeRef = React.useRef<HTMLInputElement>(null);
  const { add } = useCartItemMutations(cartId);

  async function handleAdd(e?: React.FormEvent) {
    e?.preventDefault();
    if (code.trim() === "") {
      codeRef.current?.focus();
      return;
    }
    const qtyNum = Number(quantity.replace(",", "."));
    if (!isValidQuantity(qtyNum)) {
      toast.error("Bitte gib eine gültige Menge zwischen 0,001 und 100.000 ein.");
      return;
    }
    try {
      await add.mutateAsync({ productCode: code, quantity: qtyNum, nextPosition, rate: currentRate });
      setCode("");
      setQuantity("1");
      codeRef.current?.focus();
    } catch {
      toast.error("Position konnte nicht hinzugefügt werden.");
    }
  }

  return (
    <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/30 p-3">
      <Input
        ref={codeRef}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Artikelcode (z. B. ART-1001)"
        className="h-9 w-48 font-mono text-xs uppercase"
      />
      <Input
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        placeholder="Menge"
        inputMode="decimal"
        className="h-9 w-24 text-right tabular-nums"
      />
      <Button type="submit" size="sm" loading={add.isPending}>
        <Plus /> Hinzufügen
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onOpenPasteImport}>
        <ClipboardPaste /> Mehrere einfügen
      </Button>
      <p className="w-full text-xs text-muted-foreground sm:w-auto sm:ml-auto">
        Tipp: Enter fügt die Zeile hinzu und springt zurück ins Feld „Artikelcode".
      </p>
    </form>
  );
}
