import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { formatDateTime, formatRate } from "@/lib/money";

export function ExchangeRateStatusCard() {
  const { data: rate, isFetching, refresh } = useExchangeRate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wechselkurs USD → EUR</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-3xl font-bold tabular-nums">{rate?.rate ? formatRate(rate.rate) : "—"}</p>
        <div className="flex items-center gap-2 text-sm">
          {rate?.rate && !rate.stale ? (
            <span className="inline-flex items-center gap-1 text-success">
              <CheckCircle2 className="h-4 w-4" /> Aktuell
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-warning">
              <AlertTriangle className="h-4 w-4" /> {rate?.rate ? "Veraltet" : "Nicht verfügbar"}
            </span>
          )}
          <span className="text-muted-foreground">· {rate?.fetchedAt ? formatDateTime(rate.fetchedAt) : "—"}</span>
        </div>
        <p className="text-xs text-muted-foreground">Quelle: {rate?.source ?? "—"}</p>
        {rate?.error && <p className="text-xs text-destructive">{rate.error}</p>}
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" onClick={() => refresh()} loading={isFetching}>
          <RefreshCw /> Jetzt aktualisieren
        </Button>
      </CardFooter>
    </Card>
  );
}
