import type { PostCheckoutCartLineView } from "@/lib/postCheckoutCartDisplay";

type Props = {
  lines: PostCheckoutCartLineView[];
  loading?: boolean;
  cartId: string | null;
};

export function AdminPostCheckoutCartSection({ lines, loading, cartId }: Props) {
  if (!cartId) {
    return (
      <p className="text-sm text-muted-foreground">
        Kein Warenkorb verknüpft — Restwarenkorb nach Checkout nicht verfügbar.
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Warenkorb nach Checkout wird geladen …</p>;
  }

  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine offenen Warenkorb-Positionen auf diesem Bestell-Warenkorb (ohne bereits abgesendete Zeilen).
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {lines.map((line) => (
        <li key={`${line.productCode}-${line.quantityLabel}-${line.evidence}`} className="space-y-1 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{line.productName}</p>
              <p className="font-mono text-xs text-muted-foreground">{line.productCode}</p>
            </div>
            <p className="text-sm tabular-nums">{line.quantityLabel}</p>
          </div>
          <p className="text-xs text-muted-foreground">{line.hint}</p>
        </li>
      ))}
    </ul>
  );
}
