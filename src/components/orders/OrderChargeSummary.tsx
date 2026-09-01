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
  /** Admin-only frozen role surcharge. Omitted when no snapshot exists. */
  catalogSubtotalUsd?: number | null;
  roleSurchargeUsd?: number | null;
}

export function OrderChargeSummary({
  charges,
  shippingPending = false,
  catalogSubtotalUsd,
  roleSurchargeUsd,
}: OrderChargeSummaryProps) {
  const showConversion = !shippingPending && charges.convertedEur != null;
  const showRoleSurcharge =
    catalogSubtotalUsd != null && roleSurchargeUsd != null && Number.isFinite(catalogSubtotalUsd) && Number.isFinite(roleSurchargeUsd);

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Summen</p>

      {showRoleSurcharge && (
        <>
          <div className="flex justify-between">
            <span>Zwischensumme</span>
            <span className="tabular-nums">{formatUsd(catalogSubtotalUsd)}</span>
          </div>
          <div className="flex justify-between">
            <span>Rollenaufschlag</span>
            <span className="tabular-nums">{formatUsd(roleSurchargeUsd)}</span>
          </div>
        </>
      )}

      <div className="flex justify-between">
        <span>Produktsumme</span>
        <span className="tabular-nums">{formatUsd(charges.productUsd)}</span>
      </div>

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

      {!shippingPending && charges.china?.currency === "USD" && (
        <div className="flex justify-between border-t border-border/60 pt-2 font-medium">
          <span>Gesamt aus China</span>
          <span className="tabular-nums">{formatUsd(charges.usdSubtotal)}</span>
        </div>
      )}

      {showConversion && (
        <>
          <div className="border-t border-border/60 pt-2" />
          <div className="flex justify-between text-muted-foreground">
            <span>Umgerechnet</span>
            <span className="tabular-nums">{formatEur(charges.convertedEur)}</span>
          </div>
        </>
      )}

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
        {charges.finalEur == null && charges.leftoverEur > 0 && (
          <p className="mt-1 text-xs text-primary-foreground/75">
            EUR-Gesamtbetrag erst nach hinterlegtem Wechselkurs berechenbar.
          </p>
        )}
      </div>
    </div>
  );
}
