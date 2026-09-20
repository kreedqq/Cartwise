import * as React from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { QUERY_KEYS } from "@/lib/constants";
import { formatUsd } from "@/lib/money";
import { shopAreaCatalogUnit } from "@/lib/shop/shopAreaPricing";
import { applyAreaRoleSellUnit } from "@/lib/shop/shopAreaRolePricing";
import {
  DEFAULT_BASE_PRICE_FACTOR_PCT,
  formatShopAreaLabel,
  isShopAreaKey,
  type ShopAreaKey,
  type ShopPricingProfile,
} from "@/lib/shop/shopAreas";
import { listCustomerRoles } from "@/services/customerRoles";
import {
  listAdminShopAreaRoleSellFactors,
  listAdminShopAreas,
  saveAdminShopAreaRoleSellFactors,
} from "@/services/shopAreas";

const GLOBAL_SAMPLE_USD = 100;
const DEFAULT_ROLE_SELL_FACTOR_PCT = 100;

function parseSellFactorPctInput(raw: string): number | null {
  const value = Number(raw.replace(",", ".").trim());
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function AdminPricingRulesPanel({ initialAreaKey }: { initialAreaKey?: ShopAreaKey | null }) {
  const queryClient = useQueryClient();
  const rolesQuery = useQuery({ queryKey: ["customer-roles"], queryFn: listCustomerRoles });
  const areasQuery = useQuery({ queryKey: QUERY_KEYS.adminShopAreas, queryFn: listAdminShopAreas });

  const areas = areasQuery.data ?? [];
  const roles = (rolesQuery.data ?? []).filter((role) => role.is_active);

  const [areaKey, setAreaKey] = React.useState<ShopAreaKey>(() =>
    initialAreaKey && isShopAreaKey(initialAreaKey) ? initialAreaKey : "shop",
  );

  const area = areas.find((item) => item.key === areaKey);
  const profile = (area?.pricing_profile ?? "retail") as ShopPricingProfile;

  const sellFactorsQuery = useQuery({
    queryKey: QUERY_KEYS.adminShopAreaConfig(areaKey).concat("role-sell-factors"),
    queryFn: () => listAdminShopAreaRoleSellFactors(areaKey),
    enabled: !!area,
  });

  const [roleFactorDraft, setRoleFactorDraft] = React.useState<Record<string, string> | null>(null);
  const [saving, setSaving] = React.useState(false);

  const areaFactor = area?.base_price_factor_pct ?? DEFAULT_BASE_PRICE_FACTOR_PCT;

  const savedRoleFactorInputs = React.useMemo(() => {
    const next: Record<string, string> = {};
    for (const role of roles) {
      const row = sellFactorsQuery.data?.find((entry) => entry.role_id === role.id);
      next[role.id] = row != null ? String(row.sell_factor_pct) : String(DEFAULT_ROLE_SELL_FACTOR_PCT);
    }
    return next;
  }, [roles, sellFactorsQuery.data]);

  const roleFactorInputs = roleFactorDraft ?? savedRoleFactorInputs;

  const safeFactor = Number.isFinite(areaFactor) && areaFactor > 0 ? areaFactor : DEFAULT_BASE_PRICE_FACTOR_PCT;
  const catalogAfterArea = shopAreaCatalogUnit(
    { price_usd: GLOBAL_SAMPLE_USD },
    1,
    profile,
    profile === "group_buy",
    safeFactor,
  );

  async function saveAll() {
    if (!area) {
      toast.error("Verkaufsbereich konnte nicht geladen werden.");
      return;
    }

    const entries: { roleId: string; sellFactorPct: number }[] = [];
    for (const role of roles) {
      const parsed = parseSellFactorPctInput(roleFactorInputs[role.id] ?? "");
      if (parsed == null) {
        toast.error(`Ungültiger Verkaufspreisfaktor für Rolle „${role.name}“ (muss > 0 % sein).`);
        return;
      }
      entries.push({ roleId: role.id, sellFactorPct: parsed });
    }

    setSaving(true);
    try {
      await saveAdminShopAreaRoleSellFactors(areaKey, entries);
      setRoleFactorDraft(null);
      toast.success("Preisregeln gespeichert.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminShopAreas }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.shopProducts(areaKey) }),
        sellFactorsQuery.refetch(),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preisregeln konnten nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  if (rolesQuery.isLoading || areasQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (rolesQuery.isError || areasQuery.isError) {
    return (
      <ErrorState
        message="Preisregeln konnten nicht geladen werden."
        onRetry={() => {
          void rolesQuery.refetch();
          void areasQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verkaufsbereich-Preisregeln</CardTitle>
          <CardDescription>
            Verkaufspreisfaktor pro Rolle in diesem Bereich: 100&nbsp;% = Bereichskatalogpreis, 125&nbsp;% = ×1,25,
            200&nbsp;% = doppelter Bereichskatalogpreis. Shop, Warenkorb und Bestellungen nutzen dieselbe
            Server-Pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="pricing-area-select">Verkaufsbereich</Label>
              <Select
                value={areaKey}
                onValueChange={(value) => {
                  setAreaKey(value as ShopAreaKey);
                  setRoleFactorDraft(null);
                }}
              >
                <SelectTrigger id="pricing-area-select" className="w-[min(100%,16rem)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {formatShopAreaLabel(item.key as ShopAreaKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label id="pricing-area-factor-label">Bereichsgrundpreis</Label>
              <p
                id="pricing-area-factor"
                className="text-lg font-semibold tabular-nums"
                aria-labelledby="pricing-area-factor-label"
              >
                {areaFactor} %
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Der Bereichsgrundpreis wird unter{" "}
            <span className="font-medium text-foreground">Shop → Verkaufsbereiche → Preise</span> verwaltet.
          </p>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to={`/admin/shop-areas/${areaKey}`}>Verkaufsbereich öffnen</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Vorschau-Basis: Händler {formatUsd(GLOBAL_SAMPLE_USD)} → Bereichskatalog {formatUsd(catalogAfterArea)} (
            {formatShopAreaLabel(areaKey)}).
          </p>

          {sellFactorsQuery.isLoading ? <Skeleton className="h-32 w-full" /> : null}
          {sellFactorsQuery.isError ? (
            <ErrorState
              message="Bereichs-Rollenpreise konnten nicht geladen werden."
              onRetry={() => void sellFactorsQuery.refetch()}
            />
          ) : null}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rolle</TableHead>
                  <TableHead className="min-w-[9rem]">Verkaufspreisfaktor</TableHead>
                  <TableHead className="min-w-[8rem]">Vorschau</TableHead>
                  <TableHead className="min-w-[8rem]">Quelle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => {
                  const factor =
                    parseSellFactorPctInput(roleFactorInputs[role.id] ?? "") ?? DEFAULT_ROLE_SELL_FACTOR_PCT;
                  const previewUsd = applyAreaRoleSellUnit(catalogAfterArea, factor);
                  return (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0.01}
                            step={0.01}
                            className="h-8 w-24"
                            value={roleFactorInputs[role.id] ?? ""}
                            onChange={(event) =>
                              setRoleFactorDraft((current) => ({
                                ...(current ?? savedRoleFactorInputs),
                                [role.id]: event.target.value,
                              }))
                            }
                            aria-label={`Verkaufspreisfaktor für ${role.name}`}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">{formatUsd(previewUsd)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        Bereich {formatShopAreaLabel(areaKey)} · {factor} %
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">Live-Vorschau (Bereichskatalog {formatUsd(catalogAfterArea)})</p>
            <ul className="space-y-1 text-muted-foreground">
              {roles.map((role) => {
                const factor =
                  parseSellFactorPctInput(roleFactorInputs[role.id] ?? "") ?? DEFAULT_ROLE_SELL_FACTOR_PCT;
                const previewUsd = applyAreaRoleSellUnit(catalogAfterArea, factor);
                return (
                  <li key={role.id}>
                    <span className="text-foreground">{role.name}</span>: {factor} % →{" "}
                    <span className="tabular-nums text-foreground">{formatUsd(previewUsd)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Button type="button" loading={saving} onClick={() => void saveAll()}>
        Änderungen speichern
      </Button>
    </div>
  );
}
