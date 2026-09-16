import { AlertTriangle, CheckCircle2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AdminGlobalSyncResult } from "@/services/adminCarts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: AdminGlobalSyncResult | null;
};

function StatRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export function AdminGlobalSyncResultDialog({ open, onOpenChange, result }: Props) {
  const errors = result?.errors ?? [];
  const hasErrors = errors.length > 0;
  const reconciliationHint = (result?.ambiguous ?? 0) + (result?.historicalPriceMissing ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasErrors ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
            )}
            Synchronisierung abgeschlossen
          </DialogTitle>
          <DialogDescription>
            Ergebnis vom Server — Warenkörbe, Preise und vollständige Kits.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="divide-y divide-border rounded-lg border border-border px-4">
            <StatRow label="Warenkörbe geprüft" value={result.cartsChecked} />
            <StatRow label="Positionen aktualisiert (Preise)" value={result.cartItemsChanged} />
            <StatRow label="Kits geprüft (status voll)" value={result.kitsChecked} />
            <StatRow label="Kits synchronisiert" value={result.kitsSynced} />
            <StatRow label="Kits ohne Änderung" value={result.kitsAlreadySynchronized} />
            <StatRow label="Offene Abweichungen (Hinweis)" value={reconciliationHint} />
            <StatRow label="Fehler" value={errors.length} />
          </div>
        ) : null}

        {result && !hasErrors && reconciliationHint === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Abweichungen gefunden.</p>
        ) : null}

        {hasErrors ? (
          <ul className="max-h-40 space-y-2 overflow-y-auto text-sm text-muted-foreground">
            {errors.map((entry, index) => (
              <li key={index} className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">
                {typeof entry === "object" && entry && "message" in entry
                  ? String((entry as { message?: string }).message)
                  : "Ein Kit konnte nicht synchronisiert werden."}
              </li>
            ))}
          </ul>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
