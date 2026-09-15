import type { AdminOrderCartAudit } from "@/services/adminOrderIntegrity";

type Props = {
  cartId: string | null;
  audit: AdminOrderCartAudit | null | undefined;
  isLoading?: boolean;
};

export function AdminOrderIntegrityBanner({ cartId, audit, isLoading }: Props) {
  if (!cartId || isLoading || !audit) return null;

  const s = audit;
  if (s.category === "pass") {
    return (
      <p className="rounded-lg border border-border bg-secondary/20 px-4 py-2 text-sm text-muted-foreground">
        Warenkorb nach Checkout: keine offenen Positionen auf dem Bestell-Warenkorb. Die abgesendete Bestellung
        bleibt unverändert in den Positionen unten.
      </p>
    );
  }

  if (s.category === "expected_remaining_cart") {
    return (
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-2 text-sm text-amber-950 dark:text-amber-100">
        Warenkorb nach Checkout:{" "}
        {s.remainingIncompleteKitLines > 0
          ? `${s.remainingIncompleteKitLines} unvollständige Kit-Anteile`
          : `${s.cartLinesRemaining} Position(en)`}{" "}
        liegen noch im Warenkorb — das ist nicht die historische Bestellung (siehe „Nach dem Checkout im
        Warenkorb“). {s.hint}
      </p>
    );
  }

  return (
    <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-2 text-sm text-amber-950 dark:text-amber-100">
      Warenkorb nach Checkout:{" "}
      {s.hint ?? "Historischer Abgleich unklar — abgesendete Positionen nur aus den Bestellzeilen."}
    </p>
  );
}
