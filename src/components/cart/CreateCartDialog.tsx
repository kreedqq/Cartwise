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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCartMutations } from "@/hooks/useCarts";
import { toast } from "@/components/ui/toaster";
import { useNavigate } from "react-router-dom";

export function CreateCartDialog() {
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const { create } = useCartMutations();
  const navigate = useNavigate();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setNote("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const cart = await create.mutateAsync({ note: note.trim() || undefined });
      toast.success(`Warenkorb „${cart.name}" wurde erstellt.`);
      setOpen(false);
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
              Der Name folgt automatisch deinem Telegram Benutzernamen. Du kannst ihn nicht unabhängig ändern.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="cart-note">Notiz (optional)</Label>
              <Textarea
                id="cart-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Zusätzliche Informationen zu diesem Warenkorb"
                rows={3}
                maxLength={2000}
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
