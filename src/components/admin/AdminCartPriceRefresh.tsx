import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "@/components/ui/toaster";
import { previewOpenCartPriceRefresh, refreshOpenCartPrices } from "@/services/shopAreas";

export function AdminCartPriceRefresh() {
  const queryClient = useQueryClient();
  const [preview, setPreview] = React.useState<{ carts: number; items: number } | null>(null);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function handleOpen() {
    setLoading(true);
    try {
      const result = await previewOpenCartPriceRefresh();
      setPreview(result);
      setOpen(true);
    } catch (error) {
      console.error(error);
      toast.error("Vorschau der Warenkorbpreise fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      const result = await refreshOpenCartPrices();
      toast.success(
        `${result.items} Positionen in ${result.carts} Warenkörben aktualisiert.`,
      );
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["carts"] });
      await queryClient.invalidateQueries({ queryKey: ["cart-summaries"] });
      await queryClient.invalidateQueries({ queryKey: ["cart-items"] });
    } catch (error) {
      console.error(error);
      toast.error("Warenkorbpreise konnten nicht aktualisiert werden.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold">Warenkorb Preise</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Preise der offenen Warenkörbe anhand der aktuell zugewiesenen Rollen neu berechnen. Der gespeicherte
          Kundenpreis wird nicht erneut aufgeschlagen.
        </p>
      </div>
      <Button type="button" onClick={() => void handleOpen()} disabled={loading}>
        Preise aktualisieren
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Warenkorbpreise aktualisieren?"
        description={
          preview
            ? `Es werden ${preview.carts} offene Warenkörbe mit ${preview.items} Positionen neu berechnet.`
            : "Offene Warenkörbe werden neu berechnet."
        }
        confirmLabel="Preise aktualisieren"
        onConfirm={() => void handleConfirm()}
        loading={loading}
      />
    </div>
  );
}
