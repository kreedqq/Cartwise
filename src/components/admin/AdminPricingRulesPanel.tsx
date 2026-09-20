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
import { applyRoleMarkup, formatUsd } from "@/lib/money";
import { shopAreaCatalogUnit } from "@/lib/shop/shopAreaPricing";
import {
  applyAreaRoleSellUnit,
  roleMarkupPercentToSellFactorPct,
} from "@/lib/shop/shopAreaRolePricing";
import {
  DEFAULT_BASE_PRICE_FACTOR_PCT,
  formatShopAreaLabel,
  isShopAreaKey,
  type ShopAreaKey,
  type ShopPricingProfile,
} from "@/lib/shop/shopAreas";
import { listCustomerRoles, upsertCustomerRole } from "@/services/customerRoles";
import {
  listAdminShopAreaRoleSellFactors,
  listAdminShopAreas,
  saveAdminShopAreaRoleSellFactors,
} from "@/services/shopAreas";
const GLOBAL_SAMPLE_USD = 100;

function parsePositiveNumber(raw: string): number | null {
  const value = Number(raw.replace(",", ".").trim());
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function parseExplicitSellFactor(raw: string | undefined): number | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const value = Number(trimmed.replace(",", "."));
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

  const [globalMarkupDraft, setGlobalMarkupDraft] = React.useState<Record<string, string> | null>(null);
  const [roleFactorDraft, setRoleFactorDraft] = React.useState<Record<string, string> | null>(null);
  const [saving, setSaving] = React.useState(false);

  const areaFactor = area?.base_price_factor_pct ?? DEFAULT_BASE_PRICE_FACTOR_PCT;

  const savedGlobalInputs = React.useMemo(() => {
    const next: Record<string, string> = {};
    for (const role of roles) next[role.id] = String(role.markup_percent);
    return next;
  }, [roles]);

  const globalMarkupInputs = globalMarkupDraft ?? savedGlobalInputs;

  const savedRoleFactorInputs = React.useMemo(() => {
    const next: Record<string, string> = {};
    for (const role of roles) {
      const row = sellFactorsQuery.data?.find((entry) => entry.role_id === role.id);
      next[role.id] = row != null ? String(row.sell_factor_pct) : "";
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
    for (const role of roles) {
      const parsed = parsePositiveNumber(globalMarkupInputs[role.id] ?? "");
      if (parsed == null) {
        toast.error(`Ungültiger globaler Aufschlag für „${role.name}“.`);
        return;
      }
    }

    const entries: { roleId: string; sellFactorPct: number | null }[] = [];
    for (const role of roles) {
      const raw = roleFactorInputs[role.id]?.trim();
      if (!raw) {
        entries.push({ roleId: role.id, sellFactorPct: null });
        continue;
      }
      const parsed = Number(raw.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast.error(`Ungültiger Bereichspreis für Rolle „${role.name}“ (muss > 0 % sein).`);
        return;
      }
      entries.push({ roleId: role.id, sellFactorPct: parsed });
    }

    setSaving(true);
    try {
      for (const role of roles) {
        const draftMarkup = parsePositiveNumber(globalMarkupInputs[role.id] ?? "");
        if (draftMarkup != null && draftMarkup !== Number(role.markup_percent)) {
          await upsertCustomerRole({
            id: role.id,
            name: role.name,
            markupPercent: draftMarkup,
            isActive: role.is_active,
            canUseKitRequests: role.can_use_kit_requests === true,
          });
        }
      }
      await saveAdminShopAreaRoleSellFactors(areaKey, entries);
      setGlobalMarkupDraft(null);
      setRoleFactorDraft(null);
      toast.success("Preisregeln gespeichert.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customer-roles"] }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminShopAreas }),
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
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Globale Rollenpreise</CardTitle>
          <CardDescription>
            Diese Regeln gelten standardmäßig in allen Verkaufsbereichen, wenn dort keine individuelle Bereichsregel
            existiert. Leerer Bereichspreis (—) bedeutet: diese globale Regel greift.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rolle</TableHead>
                <TableHead className="min-w-[7rem]">Globaler Aufschlag</TableHead>
                <TableHead className="min-w-[7rem]">Verkaufspreis bei {formatUsd(GLOBAL_SAMPLE_USD)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => {
                const markup = parsePositiveNumber(globalMarkupInputs[role.id] ?? "") ?? Number(role.markup_percent);
                const preview = applyRoleMarkup(GLOBAL_SAMPLE_USD, markup);
                return (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          className="h-8 w-24"
                          value={globalMarkupInputs[role.id] ?? ""}
                          onChange={(event) =>
                            setGlobalMarkupDraft((current) => ({
                              ...(current ?? savedGlobalInputs),
                              [role.id]: event.target.value,
                            }))
                          }
                          aria-label={`Globaler Aufschlag für ${role.name}`}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">{formatUsd(preview)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verkaufsbereich-Preisregeln</CardTitle>
          <CardDescription>
            Bereichsgrundpreis und optionale Verkaufsfaktoren pro Rolle auf dem Bereichskatalog. Explizit 100&nbsp;% ist
            nicht dasselbe wie leer (globaler Fallback).
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
            Beispiel Händler {formatUsd(GLOBAL_SAMPLE_USD)} → Bereichskatalog {formatUsd(catalogAfterArea)} (
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
                  <TableHead className="min-w-[8rem]">Bereichspreis</TableHead>
                  <TableHead className="min-w-[8rem]">Vorschau</TableHead>
                  <TableHead className="min-w-[8rem]">Quelle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => {
                  const explicit = parseExplicitSellFactor(roleFactorInputs[role.id]);
                  const globalMarkup =
                    parsePositiveNumber(globalMarkupInputs[role.id] ?? "") ?? Number(role.markup_percent);
                  const previewUsd = applyAreaRoleSellUnit(catalogAfterArea, explicit, globalMarkup);
                  return (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0.01}
                            step={0.01}
                            placeholder="—"
                            className="h-8 w-24"
                            value={roleFactorInputs[role.id] ?? ""}
                            onChange={(event) =>
                              setRoleFactorDraft((current) => ({
                                ...(current ?? savedRoleFactorInputs),
                                [role.id]: event.target.value,
                              }))
                            }
                            aria-label={`Bereichspreis Faktor für ${role.name}`}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">{formatUsd(previewUsd)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {explicit != null ? (
                          <span>Bereich {explicit} %</span>
                        ) : (
                          <span>
                            Global {globalMarkup} % ({roleMarkupPercentToSellFactorPct(globalMarkup).toFixed(0)} %)
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">Vorschau (Bereichskatalog {formatUsd(catalogAfterArea)})</p>
            <ul className="space-y-1 text-muted-foreground">
              {roles.map((role) => {
                const explicit = parseExplicitSellFactor(roleFactorInputs[role.id]);
                const globalMarkup =
                  parsePositiveNumber(globalMarkupInputs[role.id] ?? "") ?? Number(role.markup_percent);
                const previewUsd = applyAreaRoleSellUnit(catalogAfterArea, explicit, globalMarkup);
                const label =
                  explicit != null
                    ? `Bereich ${explicit} %`
                    : `Global ${globalMarkup} % → ${roleMarkupPercentToSellFactorPct(globalMarkup).toFixed(0)} %`;
                return (
                  <li key={role.id}>
                    <span className="text-foreground">{role.name}</span>: {label} →{" "}
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
