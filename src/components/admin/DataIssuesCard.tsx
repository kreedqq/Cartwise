import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDataIssuesSummary } from "@/services/adminStats";

export function DataIssuesCard() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-data-issues"], queryFn: getDataIssuesSummary });

  const total = (data?.unresolvedCartItems ?? 0) + (data?.missingPriceProducts ?? 0) + (data?.inactiveProductsInUse ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Offene Datenprobleme</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : total === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> Keine offenen Probleme gefunden.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data!.unresolvedCartItems > 0 && (
              <li className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {data!.unresolvedCartItems} Position(en) in Warenkörben mit unbekanntem Artikelcode
              </li>
            )}
            {data!.inactiveProductsInUse > 0 && (
              <li className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {data!.inactiveProductsInUse} Position(en) verweisen auf deaktivierte Produkte
              </li>
            )}
            {data!.missingPriceProducts > 0 && (
              <li className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {data!.missingPriceProducts} Produkt(e) ohne gültigen Preis (0,00 USD)
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
