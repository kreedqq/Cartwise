import {
  formatEur,
  formatMoney,
  formatUsd,
  GRAND_TOTAL_LABEL,
  SHIPPING_LABEL_CHINA,
  SHIPPING_LABEL_GERMANY,
  type OrderCharges,
} from "@/lib/money";

interface OrderChargeSummaryProps {
  charges: OrderCharges;
  /** Checkout: shipping is assigned by an admin after the order exists. */
  shippingPending?: boolean;
}

export function OrderChargeSummary({ charges, shippingPending = false }: OrderChargeSummaryProps) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
      <div className="flex justify-between">
        <span>Produktsumme</span>
        <span className="tabular-nums">{formatUsd(charges.productUsd)}</span>
      </div>
      {charges.productEur != null && (
        <div className="flex justify-between text-muted-foreground">
          <span>Produktsumme EUR</span>
          <span className="tabular-nums">{formatEur(charges.productEur)}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span>{SHIPPING_LABEL_CHINA}</span>
        <span className="tabular-nums">
          {shippingPending
            ? "wird nach der Bestellung zugeordnet"
            : charges.china
              ? formatMoney(charges.china.amount, charges.china.currency)
              : "—"}
        </span>
      </div>
      <div className="flex justify-between">
        <span>{SHIPPING_LABEL_GERMANY}</span>
        <span className="tabular-nums">
          {shippingPending
            ? "wird nach der Bestellung zugeordnet"
            : charges.germany
              ? formatMoney(charges.germany.amount, charges.germany.currency)
              : "—"}
        </span>
      </div>
      <div className="mt-3 rounded-xl bg-primary px-4 py-4 text-primary-foreground">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/70">
          {GRAND_TOTAL_LABEL}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{charges.grandDisplay}</p>
      </div>
    </div>
  );
}
