import * as React from "react";
import { Link } from "react-router-dom";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminOpenCarts } from "@/hooks/useAdminCarts";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/constants";
import { formatDateTime, formatUsd } from "@/lib/money";
import { formatShopAreaLabel } from "@/lib/shop/shopAreas";
import { listAdminShopAreas } from "@/services/shopAreas";

export default function AdminCartsPage() {
  const [shopArea, setShopArea] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const areasQuery = useQuery({ queryKey: QUERY_KEYS.adminShopAreas, queryFn: listAdminShopAreas });
  const cartsQuery = useAdminOpenCarts(
    shopArea === "all" ? null : shopArea,
    search.trim() || null,
  );

  const rows = (cartsQuery.data ?? []).filter((row) => {
    if (shopArea !== "all" && !row.shop_areas.includes(shopArea)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <AdminPageHeader
        section="Bestellungen"
        title="Warenkörbe"
        description="Offene Kundenwarenkörbe einsehen und bearbeiten."
      />

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Kunde oder Warenkorb …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="space-y-1">
          <Label id="admin-carts-area-label" htmlFor="admin-carts-area" className="sr-only">
            Shop-Bereich
          </Label>
          <Select value={shopArea} onValueChange={setShopArea}>
            <SelectTrigger id="admin-carts-area" className="w-[220px]" aria-labelledby="admin-carts-area-label">
              <SelectValue placeholder="Shop-Bereich" />
            </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Bereiche</SelectItem>
            {(areasQuery.data ?? []).map((area) => (
              <SelectItem key={area.key} value={area.key}>
                {area.name || formatShopAreaLabel(area.key)}
              </SelectItem>
            ))}
          </SelectContent>
          </Select>
        </div>
      </div>

      {cartsQuery.isLoading && <Skeleton className="h-48 w-full" />}
      {cartsQuery.isError && (
        <ErrorState message="Warenkörbe konnten nicht geladen werden." onRetry={() => cartsQuery.refetch()} />
      )}

      {!cartsQuery.isLoading && !cartsQuery.isError && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kunde</TableHead>
                <TableHead>Warenkorb</TableHead>
                <TableHead>Bereiche</TableHead>
                <TableHead>Positionen</TableHead>
                <TableHead>Gesamt</TableHead>
                <TableHead>Kit</TableHead>
                <TableHead>Geändert</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    Keine offenen Warenkörbe.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.cart_id}>
                    <TableCell>
                      <Link className="font-medium underline-offset-2 hover:underline" to={`/admin/carts/${row.cart_id}`}>
                        {row.username}
                      </Link>
                    </TableCell>
                    <TableCell>{row.cart_name}</TableCell>
                    <TableCell className="text-sm">
                      {row.shop_areas.map((a) => formatShopAreaLabel(a)).join(", ")}
                    </TableCell>
                    <TableCell>{row.item_count}</TableCell>
                    <TableCell>{formatUsd(row.total_usd)}</TableCell>
                    <TableCell>
                      {row.has_kit ? <Badge variant="secondary">Kit</Badge> : "—"}
                      {row.has_submitted_lines ? (
                        <Badge className="ml-1" variant="outline">
                          Bestellt
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(row.updated_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
