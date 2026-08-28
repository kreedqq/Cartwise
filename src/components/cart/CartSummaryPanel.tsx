import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, RefreshCw, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDateTime, formatEur, formatQuantity, formatRate, formatUsd } from "@/lib/money";
import type { CartTotals } from "@/lib/money";
import type { ExchangeRateResult } from "@/services/exchangeRate";
import type { CartStatus } from "@/types/database";

interface CartSummaryPanelProps {
  cartId: string;
  cartStatus: CartStatus;
  totals: CartTotals;
  rate: ExchangeRateResult | undefined;
  rateLoading: boolean;
  onRefreshRate: () => void;
  onUpdatePrices: () => void;
  updatingPrices?: boolean;
}

export function CartSummaryPanel({
  cartId,
  cartStatus,
  totals,
  rate,
  rateLoading,
  onRefreshRate,
  onUpdatePrices,
  updatingPrices,
}: CartSummaryPanelProps) {
  const navigate = useNavigate();
  const canCheckout = cartStatus !== "ordered" && cartStatus !== "archived";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/70 bg-secondary/40 px-4 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Produktsumme USD</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-primary">{formatUsd(totals.totalUsd)}</p>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Produktsumme EUR</p>
        {totals.totalEur != null ? (
          <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{formatEur(totals.totalEur)}</p>
        ) : (
          <p className="mt-1 text-sm font-medium text-muted-foreground">Kein Wechselkurs verfügbar</p>
        )}
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Versand aus China und Versand aus Deutschland werden nach der Bestellung zugeordnet. Der Gesamt Endpreis inkl. Versand erscheint in der Bestellung.
        </p>
      </div>

      <Separator />

      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Positionen</dt>
          <dd className="font-medium">{totals.itemCount}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Gesamtmenge</dt>
          <dd className="font-medium">{formatQuantity(totals.totalQuantity)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Wechselkurs
          </dt>
          <dd className="font-medium tabular-nums">{rate?.rate ? formatRate(rate.rate) : "—"}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Kursstand
          </dt>
          <dd className="text-right font-medium">
            {rateLoading ? "Wird geladen …" : rate?.fetchedAt ? formatDateTime(rate.fetchedAt) : "—"}
          </dd>
        </div>
      </dl>

      {rate?.stale && (
        <p className="flex items-start gap-2 rounded-md bg-warning/10 p-2.5 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Wechselkurs konnte nicht aktualisiert werden - es wird der letzte bekannte Kurs angezeigt.
        </p>
      )}
      {rate?.error && !rate.rate && (
        <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {rate.error}
        </p>
      )}
      {(totals.unresolvedCount > 0 || totals.missingPriceCount > 0) && (
        <p className="flex items-start gap-2 rounded-md bg-warning/10 p-2.5 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {totals.unresolvedCount > 0 && <>{totals.unresolvedCount} Artikel nicht gefunden. </>}
          {totals.missingPriceCount > 0 && <>{totals.missingPriceCount} Position(en) ohne Preis.</>}
        </p>
      )}

      {canCheckout ? (
        <Button
          size="lg"
          className="w-full"
          disabled={totals.totalUsd <= 0}
          onClick={() => navigate(`/carts/${cartId}/checkout`)}
        >
          Bestellung prüfen
        </Button>
      ) : (
        <p className="rounded-md bg-secondary/60 p-2.5 text-center text-xs text-muted-foreground">
          {cartStatus === "ordered" ? "Dieser Warenkorb wurde bereits bestellt." : "Dieser Warenkorb ist archiviert."}
        </p>
      )}

      <div className="space-y-2">
        <Button variant="outline" size="sm" className="w-full" onClick={onRefreshRate} loading={rateLoading}>
          <RefreshCw /> Wechselkurs aktualisieren
        </Button>
        <Button size="sm" className="w-full" onClick={onUpdatePrices} loading={updatingPrices} disabled={!canCheckout}>
          Preise aktualisieren
        </Button>
      </div>

      {rate?.source && (
        <p className="text-center text-[11px] text-muted-foreground">
          Quelle: {rate.source} <Badge variant="outline" className="ml-1 align-middle">USD → EUR</Badge>
        </p>
      )}
    </div>
  );
}
