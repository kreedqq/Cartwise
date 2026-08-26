import * as React from "react";
import { ChevronUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CartSummaryPanel } from "@/components/cart/CartSummaryPanel";
import { formatEur, formatUsd } from "@/lib/money";
import type { CartTotals } from "@/lib/money";
import type { ExchangeRateResult } from "@/services/exchangeRate";

interface CartSummaryBarProps {
  totals: CartTotals;
  rate: ExchangeRateResult | undefined;
  rateLoading: boolean;
  onRefreshRate: () => void;
  onUpdatePrices: () => void;
  updatingPrices?: boolean;
}

export function CartSummaryBar(props: CartSummaryBarProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <>
      {/* Desktop: sticky summary card in the right column. */}
      <Card className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
        <CardHeader>
          <CardTitle>Zusammenfassung</CardTitle>
        </CardHeader>
        <CardContent>
          <CartSummaryPanel {...props} />
        </CardContent>
      </Card>

      {/* Mobile: compact sticky bottom bar that expands into a full panel. */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed inset-x-0 bottom-16 z-30 flex items-center justify-between border-t border-border bg-card/95 px-4 py-3 text-left shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur lg:hidden"
      >
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Gesamt</p>
          <p className="text-base font-bold tabular-nums leading-tight">{formatUsd(props.totals.totalUsd)}</p>
          <p className="text-xs font-medium tabular-nums text-primary">
            {props.totals.totalEur != null ? formatEur(props.totals.totalEur) : "Kein Kurs verfügbar"}
          </p>
        </div>
        <span className="flex items-center gap-1 text-xs font-medium text-primary">
          Details <ChevronUp className="h-4 w-4" />
        </span>
      </button>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="lg:hidden">
          <DialogHeader>
            <DialogTitle>Zusammenfassung</DialogTitle>
          </DialogHeader>
          <CartSummaryPanel {...props} />
        </DialogContent>
      </Dialog>
    </>
  );
}
