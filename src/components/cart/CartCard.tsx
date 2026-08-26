import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Archive, Copy, MoreVertical, Pin, PinOff, Trash2 } from "lucide-react";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CartStatusBadge } from "@/components/cart/CartStatusBadge";
import { RenameCartDialog } from "@/components/cart/RenameCartDialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useCartMutations } from "@/hooks/useCarts";
import { formatDateTime, formatEur, formatQuantity, formatUsd } from "@/lib/money";
import { toast } from "@/components/ui/toaster";
import type { CartSummaryRow, Tables } from "@/types/database";

interface CartCardProps {
  cart: Tables<"carts">;
  summary?: CartSummaryRow;
}

export function CartCard({ cart, summary }: CartCardProps) {
  const navigate = useNavigate();
  const { rename, duplicate, activate, archive, remove } = useCartMutations();

  const [renameOpen, setRenameOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  async function handleRename(name: string) {
    try {
      await rename.mutateAsync({ cart, name });
      setRenameOpen(false);
      toast.success("Warenkorb umbenannt.");
    } catch {
      toast.error("Umbenennen fehlgeschlagen.");
    }
  }

  async function handleDuplicate() {
    try {
      const newId = await duplicate.mutateAsync({ cartId: cart.id, newName: `${cart.name} (Kopie)` });
      toast.success("Warenkorb dupliziert.");
      navigate(`/carts/${newId}`);
    } catch {
      toast.error("Duplizieren fehlgeschlagen.");
    }
  }

  async function handleToggleActive() {
    try {
      await activate.mutateAsync(cart.id);
    } catch {
      toast.error("Konnte nicht als aktiv markiert werden.");
    }
  }

  async function handleArchive() {
    try {
      await archive.mutateAsync(cart);
      setArchiveOpen(false);
      toast.success("Warenkorb archiviert.");
    } catch {
      toast.error("Archivieren fehlgeschlagen.");
    }
  }

  async function handleDelete() {
    try {
      await remove.mutateAsync(cart.id);
      setDeleteOpen(false);
      toast.success("Warenkorb gelöscht.");
    } catch {
      toast.error("Löschen fehlgeschlagen.");
    }
  }

  return (
    <>
      <Card
        className={cart.is_active_cart ? "border-primary/50 ring-1 ring-primary/20" : undefined}
      >
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <div
            className="min-w-0 flex-1 cursor-pointer"
            onClick={() => navigate(`/carts/${cart.id}`)}
          >
            <div className="flex items-center gap-2">
              {cart.is_active_cart && <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />}
              <h3 className="truncate text-sm font-semibold">{cart.name}</h3>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <CartStatusBadge status={cart.status} />
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/carts/${cart.id}`)}>Öffnen</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRenameOpen(true)}>Umbenennen</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy /> Duplizieren
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleActive}>
                {cart.is_active_cart ? <PinOff /> : <Pin />}
                {cart.is_active_cart ? "Als aktiv entfernen" : "Als aktiv markieren"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {cart.status !== "archived" && (
                <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
                  <Archive /> Archivieren
                </DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 /> Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>

        <CardContent className="cursor-pointer" onClick={() => navigate(`/carts/${cart.id}`)}>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Artikel</dt>
            <dd className="text-right font-medium">{summary?.item_count ?? 0}</dd>
            <dt className="text-muted-foreground">Gesamtmenge</dt>
            <dd className="text-right font-medium">{formatQuantity(summary?.total_quantity ?? 0)}</dd>
            <dt className="text-muted-foreground">Summe USD</dt>
            <dd className="text-right font-medium tabular-nums">{formatUsd(summary?.total_usd ?? 0)}</dd>
            <dt className="text-muted-foreground">Summe EUR</dt>
            <dd className="text-right font-medium tabular-nums">
              {summary?.total_eur != null ? formatEur(summary.total_eur) : "—"}
            </dd>
          </dl>
          {(summary?.unresolved_count ?? 0) > 0 && (
            <p className="mt-3 rounded-md bg-warning/10 px-2.5 py-1.5 text-xs font-medium text-warning">
              {summary!.unresolved_count} Artikel nicht gefunden
            </p>
          )}
        </CardContent>

        <CardFooter className="justify-between text-xs text-muted-foreground">
          <span>Erstellt: {formatDateTime(cart.created_at)}</span>
          <span>Geändert: {formatDateTime(cart.updated_at)}</span>
        </CardFooter>
      </Card>

      <RenameCartDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        initialName={cart.name}
        loading={rename.isPending}
        onConfirm={handleRename}
      />

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Warenkorb archivieren?"
        description={`„${cart.name}" wird als archiviert markiert und aus der aktiven Übersicht ausgeblendet. Du kannst ihn jederzeit über den Status wieder aktivieren.`}
        confirmLabel="Archivieren"
        loading={archive.isPending}
        onConfirm={handleArchive}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Warenkorb löschen?"
        description={`„${cart.name}" wird gelöscht und verschwindet aus deiner Übersicht. Diese Aktion kann nicht über die Oberfläche rückgängig gemacht werden.`}
        confirmLabel="Endgültig löschen"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
