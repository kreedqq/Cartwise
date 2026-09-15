import { useQuery } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { auditOrderCartIntegrity } from "@/services/adminOrderIntegrity";
import type { Tables } from "@/types/database";

type Props = {
  orderId: string;
  cartId: string | null;
  orderItems: Tables<"order_items">[];
};

export function AdminOrderIntegrityBanner({ orderId, cartId, orderItems }: Props) {
  const audit = useQuery({
    queryKey: [...QUERY_KEYS.adminOrderIntegrity, orderId],
    queryFn: () => auditOrderCartIntegrity({ orderId, cartId, orderItems }),
    enabled: Boolean(cartId) && orderItems.length > 0,
    staleTime: 60_000,
  });

  if (!cartId || audit.isLoading || !audit.data) return null;

  const s = audit.data;
  if (s.category === "pass") {
    return (
      <p className="rounded-lg border border-border bg-secondary/20 px-4 py-2 text-sm text-muted-foreground">
        Warenkorb-Abgleich: Bestellung wirkt vollständig (keine offenen Cart-Zeilen am Order-Cart).
      </p>
    );
  }

  if (s.category === "expected_remaining_cart") {
    return (
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-2 text-sm text-amber-950 dark:text-amber-100">
        Warenkorb-Abgleich: {s.remainingIncompleteKitLines > 0
          ? `${s.remainingIncompleteKitLines} unvollständige Kit-Anteile`
          : `${s.cartLinesRemaining} Position(en)`}{" "}
        liegen noch im Warenkorb (typisch bei Checkout mit übersprungenen Kit-Linien).{" "}
        {s.hint}
      </p>
    );
  }

  return (
    <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm text-destructive">
      Warenkorb-Abgleich: manuell prüfen — {s.hint ?? s.category}
    </p>
  );
}
