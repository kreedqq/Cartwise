import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Archive, Copy, Pencil, Pin, PinOff, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CartStatusBadge, CART_STATUS_LABELS } from "@/components/cart/CartStatusBadge";
import { RenameCartDialog } from "@/components/cart/RenameCartDialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useCartMutations } from "@/hooks/useCarts";
import { isOpenCart } from "@/services/carts";
import { toast } from "@/components/ui/toaster";
import type { CartStatus, Tables } from "@/types/database";

const EDITABLE_STATUSES = (Object.keys(CART_STATUS_LABELS) as CartStatus[]).filter((status) => status !== "ordered");

export function CartHeader({ cart }: { cart: Tables<"carts"> }) {
  const navigate = useNavigate();
  const { rename, updateStatus, activate, duplicate, remove } = useCartMutations();
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const open = isOpenCart(cart.status);

  async function handleRename(name: string) {
    try {
      await rename.mutateAsync({ cart, name });
      setRenameOpen(false);
      toast.success("Warenkorb umbenannt.");
    } catch (error) {
      console.error("Warenkorb umbenennen fehlgeschlagen:", error);
      toast.error("Umbenennen fehlgeschlagen.");
    }
  }

  async function handleStatusChange(status: CartStatus) {
    try {
      await updateStatus.mutateAsync({ cart, status });
    } catch (error) {
      console.error("Warenkorb-Status ändern fehlgeschlagen:", error);
      toast.error("Status konnte nicht geändert werden.");
    }
  }

  async function handleDuplicate() {
    try {
      const newId = await duplicate.mutateAsync({ cartId: cart.id, newName: `${cart.name} (Kopie)` });
      toast.success("Warenkorb dupliziert.");
      navigate(`/carts/${newId}`);
    } catch (error) {
      console.error("Warenkorb duplizieren fehlgeschlagen:", error);
      toast.error("Duplizieren fehlgeschlagen.");
    }
  }

  async function handleDelete() {
    try {
      await remove.mutateAsync(cart.id);
      toast.success("Warenkorb gelöscht.");
      navigate("/dashboard");
    } catch (error) {
      console.error("Warenkorb löschen fehlgeschlagen:", error);
      toast.error("Löschen fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/dashboard")}>
        <ArrowLeft /> Zurück zur Übersicht
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {cart.is_active_cart && <Pin className="h-4 w-4 shrink-0 text-primary" />}
            <h1 className="truncate font-display text-2xl font-semibold tracking-tight">{cart.name}</h1>
            {open && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRenameOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CartStatusBadge status={cart.status} />
            {open && (
              <Select value={cart.status} onValueChange={(v) => handleStatusChange(v as CartStatus)}>
                <SelectTrigger className="h-8 w-52 text-xs">
                  <SelectValue placeholder="Status ändern" />
                </SelectTrigger>
                <SelectContent>
                  {EDITABLE_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CART_STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {open && (
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 /> Warenkorb löschen
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Aktionen
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {open && (
                <DropdownMenuItem onClick={() => activate.mutate(cart.id)}>
                  {cart.is_active_cart ? <PinOff /> : <Pin />}
                  {cart.is_active_cart ? "Als aktiv entfernen" : "Als aktiv markieren"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy /> Duplizieren
              </DropdownMenuItem>
              {open && (
                <DropdownMenuItem onClick={() => handleStatusChange("archived")}>
                  <Archive /> Archivieren
                </DropdownMenuItem>
              )}
              {open && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 /> Löschen
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <RenameCartDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        initialName={cart.name}
        loading={rename.isPending}
        onConfirm={handleRename}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Warenkorb löschen?"
        description={`„${cart.name}" wird gelöscht. Das ist nur für noch nicht abgeschickte Warenkörbe möglich.`}
        confirmLabel="Endgültig löschen"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
