import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { QUERY_KEYS } from "@/lib/constants";
import { shopAreaCatalogUnit } from "@/lib/shop/shopAreaPricing";
import {
  RETAIL_KIT_UNIT_DIVISOR,
  RETAIL_PRICE_FACTOR,
  SHOP_AREA_LABELS,
  isShopAreaKey,
  type ShopAreaKey,
  type ShopPricingProfile,
} from "@/lib/shop/shopAreas";
import { listCustomerRoles } from "@/services/customerRoles";
import {
  listAdminShopAreaRoleAccess,
  listAdminShopAreas,
  setAdminShopAreaRoles,
  updateAdminShopArea,
} from "@/services/shopAreas";

const PROFILE_LABELS: Record<ShopPricingProfile, string> = {
  retail: "Einzelverkauf",
  group_buy: "Group Buy",
};

export default function AdminShopAreasPage() {
  const queryClient = useQueryClient();
  const areasQuery = useQuery({ queryKey: QUERY_KEYS.adminShopAreas, queryFn: listAdminShopAreas });
  const accessQuery = useQuery({ queryKey: [...QUERY_KEYS.adminShopAreas, "access"], queryFn: listAdminShopAreaRoleAccess });
  const rolesQuery = useQuery({ queryKey: ["customer-roles"], queryFn: listCustomerRoles });
  const [savingKey, setSavingKey] = React.useState<string | null>(null);

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminShopAreas });
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myShopAreas });
  }

  const roles = rolesQuery.data ?? [];
  const access = accessQuery.data ?? [];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Shop-Bereiche"
        description="Ein Katalog, drei Bereiche. Rollen steuern die Sichtbarkeit. Preise kommen aus der zentralen Pipeline inkl. bestehendem Rollenaufschlag."
      />

      {areasQuery.isLoading && <Skeleton className="h-64 w-full" />}
      {areasQuery.isError && (
        <ErrorState message="Shop-Bereiche konnten nicht geladen werden." onRetry={() => areasQuery.refetch()} />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {(areasQuery.data ?? []).map((area) => {
          if (!isShopAreaKey(area.key)) return null;
          const areaKey = area.key;
          const assigned = access.filter((row) => row.shop_area_key === areaKey).map((row) => row.role_id);
          const profile = area.pricing_profile as ShopPricingProfile;
          return (
            <ShopAreaCard
              key={`${areaKey}|${area.name}|${String(area.is_active)}|${profile}|${assigned.slice().sort().join(",")}`}
              areaKey={areaKey}
              name={area.name}
              isActive={area.is_active}
              profile={profile}
              assignedRoleIds={assigned}
              roles={roles}
              saving={savingKey === areaKey}
              onSave={async (next) => {
                setSavingKey(areaKey);
                try {
                  await updateAdminShopArea(areaKey, {
                    name: next.name,
                    is_active: next.isActive,
                    pricing_profile: next.profile,
                  });
                  await setAdminShopAreaRoles(areaKey, next.roleIds);
                  toast.success(`${SHOP_AREA_LABELS[areaKey]} gespeichert.`);
                  await invalidate();
                } catch (error) {
                  console.error("Shop-Bereich speichern fehlgeschlagen:", error);
                  toast.error(error instanceof Error ? error.message : "Shop-Bereich konnte nicht gespeichert werden.");
                } finally {
                  setSavingKey(null);
                }
              }}
            />
          );
        })}
      </div>

      <AdminSection>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preisvorschau (Katalog, ohne Rollenaufschlag)</CardTitle>
            <CardDescription>
              Faktor {RETAIL_PRICE_FACTOR}, Kit-Teiler {RETAIL_KIT_UNIT_DIVISOR}. Der Rollenaufschlag wird danach genau
              einmal angewendet.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
            <PreviewLine
              title="Peptid / Water"
              shop={`${shopAreaCatalogUnit({ price_usd: 100 }, 1, "retail", true)} USD / Vial`}
              groupBuy="100 USD / Kit (bestehende Logik)"
            />
            <PreviewLine
              title="Injectable Oil"
              shop={`${shopAreaCatalogUnit({ price_usd: 18, bulk_price_usd: 160, bulk_price_min_quantity: 10 }, 1, "retail", false)} USD / Vial`}
              groupBuy="18 USD / Vial (bestehende Logik)"
            />
            <PreviewLine
              title="Oral"
              shop={`${shopAreaCatalogUnit({ price_usd: 20 }, 1, "retail", false)} USD / Packung`}
              groupBuy="20 USD / Packung (bestehende Logik)"
            />
          </CardContent>
        </Card>
      </AdminSection>
    </div>
  );
}

function PreviewLine({ title, shop, groupBuy }: { title: string; shop: string; groupBuy: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-muted-foreground">Shop: {shop}</p>
      <p className="text-muted-foreground">Group Buy: {groupBuy}</p>
    </div>
  );
}

function ShopAreaCard({
  areaKey,
  name,
  isActive,
  profile,
  assignedRoleIds,
  roles,
  saving,
  onSave,
}: {
  areaKey: ShopAreaKey;
  name: string;
  isActive: boolean;
  profile: ShopPricingProfile;
  assignedRoleIds: string[];
  roles: { id: string; name: string }[];
  saving: boolean;
  onSave: (next: { name: string; isActive: boolean; profile: ShopPricingProfile; roleIds: string[] }) => Promise<void>;
}) {
  const [localName, setLocalName] = React.useState(name);
  const [localActive, setLocalActive] = React.useState(isActive);
  const [localProfile, setLocalProfile] = React.useState(profile);
  const [roleIds, setRoleIds] = React.useState(assignedRoleIds);

  function toggleRole(roleId: string, checked: boolean) {
    setRoleIds((current) => (checked ? [...current, roleId] : current.filter((id) => id !== roleId)));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{SHOP_AREA_LABELS[areaKey]}</CardTitle>
          <Badge variant={localActive ? "secondary" : "outline"}>{localActive ? "Aktiv" : "Deaktiviert"}</Badge>
        </div>
        <CardDescription>Pricing: {PROFILE_LABELS[localProfile]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor={`name-${areaKey}`}>Name</Label>
          <Input id={`name-${areaKey}`} value={localName} onChange={(e) => setLocalName(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id={`active-${areaKey}`} checked={localActive} onCheckedChange={(v) => setLocalActive(v === true)} />
          <Label htmlFor={`active-${areaKey}`} className="font-normal">
            Aktiv
          </Label>
        </div>
        <div className="space-y-1">
          <Label>Pricing Profile</Label>
          <Select value={localProfile} onValueChange={(v) => setLocalProfile(v as ShopPricingProfile)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="retail">Einzelverkauf</SelectItem>
              <SelectItem value="group_buy">Group Buy</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Sichtbar für</Label>
          {roles.map((role) => (
            <div key={role.id} className="flex items-center gap-2">
              <Checkbox
                id={`${areaKey}-${role.id}`}
                checked={roleIds.includes(role.id)}
                onCheckedChange={(v) => toggleRole(role.id, v === true)}
              />
              <Label htmlFor={`${areaKey}-${role.id}`} className="font-normal">
                {role.name}
              </Label>
            </div>
          ))}
        </div>
        <Button
          type="button"
          loading={saving}
          onClick={() =>
            void onSave({ name: localName.trim() || name, isActive: localActive, profile: localProfile, roleIds })
          }
        >
          Speichern
        </Button>
      </CardContent>
    </Card>
  );
}
