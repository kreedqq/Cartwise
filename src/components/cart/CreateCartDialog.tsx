import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCartSchema } from "@/lib/validation";
import { defaultCartName } from "@/lib/cart/defaultCartName";
import { useCarts, useCartMutations } from "@/hooks/useCarts";
import { toast } from "@/components/ui/toaster";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthProvider";

export function CreateCartDialog() {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const { create } = useCartMutations();
  const cartsQuery = useCarts();
  const { profile } = useAuth();
  const navigate = useNavigate();

  function suggestedName() {
    return defaultCartName(
      profile?.username,
      (cartsQuery.data ?? []).map((cart) => cart.name),
    );
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName(suggestedName());
      setNote("");
      setError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = createCartSchema.safeParse({ name, note: note || undefined });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Ungültige Eingabe.");
      return;
    }
    setError(null);
    try {
      const cart = await create.mutateAsync(result.data);
      toast.success(`Warenkorb „${cart.name}" wurde erstellt.`);
      setOpen(false);
      setName("");
      setNote("");
      navigate(`/carts/${cart.id}`);
    } catch (error) {
      console.error("Warenkorb erstellen fehlgeschlagen:", error);
      toast.error("Warenkorb konnte nicht erstellt werden.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Neuer Warenkorb
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Neuen Warenkorb erstellen</DialogTitle>
            <DialogDescription>
              Neue Warenkörbe starten mit deinem Benutzernamen. Du kannst den Namen vor dem Speichern anpassen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="cart-name">Name</Label>
              <Input
                id="cart-name"
                autoFocus
                value={name}
                invalid={!!error}
                onChange={(e) => setName(e.target.value)}
                placeholder={suggestedName()}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cart-note">Notiz (optional)</Label>
              <Textarea
                id="cart-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Zusätzliche Informationen zu diesem Warenkorb"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" loading={create.isPending}>
              Erstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
