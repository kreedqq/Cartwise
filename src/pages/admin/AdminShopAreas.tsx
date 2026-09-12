import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { MAX_PDF_SIZE_BYTES, QUERY_KEYS } from "@/lib/constants";
import { formatDateTime, formatUsd } from "@/lib/money";
import { usesKitNoun } from "@/lib/quantityFormat";
import { shopCategoryIdFor } from "@/lib/shopCategories";
import {
  areaCategorySource,
  effectiveAreaCategoryKey,
  type AreaCategory,
} from "@/lib/shop/areaCategories";
import {
  areaPriceSource,
  effectiveAreaPriceUsd,
  shopAreaCatalogUnit,
  shopAreaSellUnitPrice,
} from "@/lib/shop/shopAreaPricing";
import {
  DEFAULT_BASE_PRICE_FACTOR_PCT,
  formatShopAreaLabel,
  isShopAreaKey,
  SHOP_AREA_STATUSES,
  SHOP_PRICING_PROFILES,
  type ShopAreaKey,
  type ShopPricingProfile,
} from "@/lib/shop/shopAreas";
import {
  matchVendorCatalogRows,
  vendorOverrideConflicts,
  type VendorCatalogMatchResult,
} from "@/lib/shop/vendorCatalog";
import { ACCEPTED_IMPORT_ACCEPT, ACCEPTED_IMPORT_LABEL, detectImportSourceKind } from "@/services/productImportSource";
import { listCustomerRoles } from "@/services/customerRoles";
import { listAllProducts } from "@/services/products";
import {
  applyVendorCatalogFromFile,
  createAdminShopAreaCategory,
  getAdminShopAreaDocument,
  deactivateAdminShopArea,
  deleteAdminShopArea,
  listAdminShopAreaCategories,
  listAdminShopAreaProductPrices,
  listAdminShopAreaProducts,
  listAdminShopAreaRoleAccess,
  listAdminShopAreas,
  renameAdminShopAreaCategory,
  reorderAdminShopAreaCategories,
  setAdminShopAreaCategoryActive,
  setAdminShopAreaManualPrice,
  setAdminShopAreaProductCategory,
  setAdminShopAreaRoles,
  signedAdminShopAreaDocumentUrl,
  updateAdminShopArea,
} from "@/services/shopAreas";
import { AdminCreateShopAreaDialog } from "@/components/admin/AdminCreateShopAreaDialog";
import { AreaDesignPanel } from "@/components/admin/AreaDesignPanel";
import { parseVendorCatalogFile } from "@/services/vendorCatalogImport";
import type { Tables } from "@/types/database";

export default function AdminShopAreasPage() {
  const queryClient = useQueryClient();
  const areasQuery = useQuery({ queryKey: QUERY_KEYS.adminShopAreas, queryFn: listAdminShopAreas });
  const accessQuery = useQuery({ queryKey: [...QUERY_KEYS.adminShopAreas, "access"], queryFn: listAdminShopAreaRoleAccess });
  const rolesQuery = useQuery({ queryKey: ["customer-roles"], queryFn: listCustomerRoles });
  const productsQuery = useQuery({ queryKey: ["admin-products"], queryFn: () => listAllProducts() });
  const [areaKey, setAreaKey] = React.useState<ShopAreaKey>("shop");
  const [createOpen, setCreateOpen] = React.useState(false);

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminShopAreas });
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myShopAreas });
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminShopAreaConfig(areaKey) });
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.shopAreaStorefront(areaKey) });
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.shopProducts(areaKey) });
  }

  const roles = rolesQuery.data ?? [];
  const access = accessQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const selected = (areasQuery.data ?? []).find((area) => area.key === areaKey);
  const assigned = access.filter((row) => row.shop_area_key === areaKey).map((row) => row.role_id);
  const lockedProfile = (selected?.pricing_profile === "group_buy" ? "group_buy" : "retail") as ShopPricingProfile;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Verkaufsbereiche"
        description="Händlerdatei bestimmt das Sortiment. Grundpreis × Bereichs-% × Rolle = Endpreis. Der globale Produkt-Master bleibt unverändert."
      />

      {areasQuery.isLoading && <Skeleton className="h-64 w-full" />}
      {areasQuery.isError && (
        <ErrorState message="Verkaufsbereiche konnten nicht geladen werden." onRetry={() => areasQuery.refetch()} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(areasQuery.data ?? []).map((area) => (
          <Button
            key={area.key}
            type="button"
            size="sm"
            variant={areaKey === area.key ? "default" : "outline"}
            onClick={() => setAreaKey(area.key)}
          >
            {area.name}
          </Button>
        ))}
        <Button type="button" size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
          + Neuen Bereich hinzufügen
        </Button>
      </div>
      <AdminCreateShopAreaDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        areas={areasQuery.data ?? []}
        onCreated={(key) => {
          setAreaKey(key);
          void invalidate();
        }}
      />

      {selected && isShopAreaKey(selected.key) && (
        <Tabs key={areaKey} defaultValue="haendlerkatalog" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="allgemein">Allgemein</TabsTrigger>
            <TabsTrigger value="haendlerkatalog">Händlerkatalog</TabsTrigger>
            <TabsTrigger value="produkte">Produkte</TabsTrigger>
            <TabsTrigger value="preise">Preise</TabsTrigger>
            <TabsTrigger value="design">Design</TabsTrigger>
          </TabsList>
          <TabsContent value="allgemein">
            <AreaIdentityCard key={`${areaKey}|identity`} area={selected} onChanged={invalidate} />
          </TabsContent>
          <TabsContent value="haendlerkatalog">
            <VendorCatalogPanel areaKey={areaKey} products={products} onChanged={invalidate} />
          </TabsContent>
          <TabsContent value="produkte">
            <VendorProductsPanel areaKey={areaKey} profile={lockedProfile} products={products} onChanged={invalidate} />
          </TabsContent>
          <TabsContent value="preise">
            <AreaSettingsCard
              key={`${areaKey}|${selected.name}|${String(selected.is_active)}|${assigned.slice().sort().join(",")}|${selected.base_price_factor_pct}`}
              areaKey={areaKey}
              area={selected}
              profile={lockedProfile}
              assignedRoleIds={assigned}
              roles={roles}
              onChanged={invalidate}
            />
          </TabsContent>
          <TabsContent value="design">
            <AreaDesignPanel area={selected} onChanged={invalidate} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function AreaIdentityCard({
  area,
  onChanged,
}: {
  area: Tables<"shop_areas">;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = React.useState(area.name);
  const [shortName, setShortName] = React.useState(area.short_name ?? area.name);
  const [subtitle, setSubtitle] = React.useState(area.subtitle ?? "");
  const [status, setStatus] = React.useState(area.status || (area.is_active ? "active" : "disabled"));
  const [hubVisible, setHubVisible] = React.useState(area.hub_visible !== false);
  const [profile, setProfile] = React.useState<ShopPricingProfile>(
    area.pricing_profile === "group_buy" ? "group_buy" : "retail",
  );
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!name.trim()) {
      toast.error("Name darf nicht leer sein.");
      return;
    }
    setSaving(true);
    try {
      await updateAdminShopArea(area.key, {
        name: name.trim(),
        short_name: shortName.trim() || name.trim(),
        subtitle: subtitle.trim() || null,
        status,
        hub_visible: hubVisible,
        is_active: status !== "disabled",
        pricing_profile: profile,
      });
      toast.success("Bereich gespeichert.");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bereich konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    setSaving(true);
    try {
      await deactivateAdminShopArea(area.key);
      toast.success("Bereich deaktiviert.");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Deaktivieren fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await deleteAdminShopArea(area.key);
      toast.success("Bereich gelöscht.");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Löschen nicht möglich. Bereich nur deaktivieren.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Allgemein</CardTitle>
        <CardDescription>
          Anzeigename und Status. Der technische Key {area.key} bleibt unverändert.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Kurzname</Label>
            <Input value={shortName} onChange={(event) => setShortName(event.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Untertitel</Label>
            <Input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHOP_AREA_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === "active"
                      ? "Aktiv"
                      : value === "disabled"
                        ? "Deaktiviert"
                        : value === "coming_soon"
                          ? "Bald verfügbar"
                          : "Temporär geschlossen"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Pricing Profile</Label>
            <Select
              value={profile}
              onValueChange={(value: ShopPricingProfile) => setProfile(value)}
              disabled={area.is_system}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHOP_PRICING_PROFILES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === "retail" ? "Retail" : "Group Buy"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={hubVisible} onCheckedChange={(value) => setHubVisible(value === true)} />
            Im Shop Hub anzeigen
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Pfad: /shop/{area.slug} · Faktor {area.base_price_factor_pct} %
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" loading={saving} onClick={() => void save()}>
            Speichern
          </Button>
          <Button type="button" variant="outline" disabled={saving} onClick={() => void deactivate()}>
            Deaktivieren
          </Button>
          {!area.is_system ? (
            <Button type="button" variant="destructive" disabled={saving} onClick={() => void remove()}>
              Löschen
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function AreaSettingsCard({
  areaKey,
  area,
  profile,
  assignedRoleIds,
  roles,
  onChanged,
}: {
  areaKey: ShopAreaKey;
  area: Tables<"shop_areas">;
  profile: ShopPricingProfile;
  assignedRoleIds: string[];
  roles: { id: string; name: string }[];
  onChanged: () => Promise<void>;
}) {
  const [factor, setFactor] = React.useState(area.base_price_factor_pct ?? DEFAULT_BASE_PRICE_FACTOR_PCT);
  const [roleIds, setRoleIds] = React.useState(assignedRoleIds);
  const [saving, setSaving] = React.useState(false);
  const isRetail = profile === "retail";
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : DEFAULT_BASE_PRICE_FACTOR_PCT;

  async function save() {
    const value = Number(factor);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Faktor muss eine positive Zahl sein.");
      return;
    }
    setSaving(true);
    try {
      await updateAdminShopArea(areaKey, { base_price_factor_pct: value, pricing_profile: profile });
      await setAdminShopAreaRoles(areaKey, roleIds);
      toast.success(`${formatShopAreaLabel(areaKey)} gespeichert.`);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Einstellungen konnten nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  const kitCatalog = shopAreaCatalogUnit({ price_usd: 100 }, 1, isRetail ? "retail" : "group_buy", true, safeFactor);
  const kitSell = shopAreaSellUnitPrice({ price_usd: 100 }, 1, 25, isRetail ? "retail" : "group_buy", true, safeFactor);
  const unitCatalog = shopAreaCatalogUnit({ price_usd: 100 }, 1, isRetail ? "retail" : "group_buy", false, safeFactor);
  const unitSell = shopAreaSellUnitPrice({ price_usd: 100 }, 1, 25, isRetail ? "retail" : "group_buy", false, safeFactor);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bereichs-%-Grundpreis {formatShopAreaLabel(areaKey)}</CardTitle>
        <CardDescription>
          Dieser Faktor gilt für alle Händlerartikel des Bereichs. Der Grundpreis bleibt pro Artikel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor={`factor-${areaKey}`}>Bereichs-%-Grundpreis</Label>
            <Input
              id={`factor-${areaKey}`}
              type="number"
              min={1}
              className="w-32"
              value={factor}
              onChange={(event) => setFactor(Number(event.target.value))}
            />
          </div>
        </div>
        <div className="space-y-1 rounded-lg border border-border p-3 text-sm">
          <p className="font-medium">Vorschau bei 100,00 USD Grundpreis und 25 % Rolle</p>
          {isRetail ? (
            <>
              <p>Peptid-Kit (÷ 10): {formatUsd(100)} → {formatUsd(kitCatalog)} Bereichspreis → {formatUsd(kitSell)} Kunde</p>
              <p>Einzelpreis (Oil/Oral): {formatUsd(100)} → {formatUsd(unitCatalog)} Bereichspreis → {formatUsd(unitSell)} Kunde</p>
            </>
          ) : (
            <p>
              {formatUsd(100)} × {safeFactor} % → {formatUsd(unitCatalog)} Bereichspreis → {formatUsd(unitSell)} Kunde
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Sichtbar für</Label>
          <div className="flex flex-wrap gap-3">
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={roleIds.includes(role.id)}
                  onCheckedChange={(checked) =>
                    setRoleIds((current) =>
                      checked === true ? [...current, role.id] : current.filter((id) => id !== role.id),
                    )
                  }
                />
                {role.name}
              </label>
            ))}
          </div>
        </div>
        <Button type="button" loading={saving} onClick={() => void save()}>
          Einstellungen speichern
        </Button>
      </CardContent>
    </Card>
  );
}

function VendorCatalogPanel({
  areaKey,
  products,
  onChanged,
}: {
  areaKey: ShopAreaKey;
  products: Tables<"products">[];
  onChanged: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const docQuery = useQuery({
    queryKey: QUERY_KEYS.adminShopAreaConfig(areaKey).concat("document"),
    queryFn: () => getAdminShopAreaDocument(areaKey),
  });
  const catalogQuery = useQuery({
    queryKey: QUERY_KEYS.adminShopAreaConfig(areaKey).concat("products"),
    queryFn: () => listAdminShopAreaProducts(areaKey),
  });
  const pricesQuery = useQuery({
    queryKey: QUERY_KEYS.adminShopAreaConfig(areaKey).concat("prices"),
    queryFn: () => listAdminShopAreaProductPrices(areaKey),
  });
  const categoriesQuery = useQuery({
    queryKey: QUERY_KEYS.adminShopAreaConfig(areaKey).concat("categories"),
    queryFn: () => listAdminShopAreaCategories(areaKey),
  });
  const [busy, setBusy] = React.useState(false);
  const [keepManuals, setKeepManuals] = React.useState(true);
  const [pending, setPending] = React.useState<{ file: File; result: VendorCatalogMatchResult } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const conflicts = pending
    ? vendorOverrideConflicts(pending.result.matched, pricesQuery.data ?? [])
    : [];

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_PDF_SIZE_BYTES) {
      toast.error("Datei ist größer als 10 MB.");
      return;
    }
    if (!detectImportSourceKind(file.name)) {
      toast.error(`Erlaubt: ${ACCEPTED_IMPORT_LABEL}.`);
      return;
    }
    setBusy(true);
    try {
      const parsed = await parseVendorCatalogFile(file);
      setPending({
        file,
        result: matchVendorCatalogRows(parsed.rows, products, categoriesQuery.data ?? []),
      });
      setKeepManuals(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Datei konnte nicht gelesen werden.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function applyPending() {
    if (!pending) return;
    setBusy(true);
    try {
      const rows = pending.result.matched.map((entry) => ({
        vendor_code: entry.code,
        product_id: entry.product_id,
        price_usd: entry.price_usd,
        bulk_price_usd: entry.bulk_price_usd,
        bulk_price_min_quantity: entry.bulk_price_min_quantity,
        vendor_name: entry.name,
        vendor_dosage: entry.dosage_vial,
        vendor_raw: entry.vendor_raw,
        imported_category_key: entry.imported_category_key,
      }));
      const { applied } = await applyVendorCatalogFromFile(areaKey, pending.file, rows, keepManuals);
      toast.success(
        keepManuals && (applied.kept_manuals ?? 0) > 0
          ? `Händlerkatalog angewendet: ${applied.added} Artikel, ${applied.kept_manuals} manuelle Preise behalten.`
          : `Händlerkatalog angewendet: ${applied.added} Artikel.`,
      );
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminShopAreaConfig(areaKey) });
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Händlerkatalog konnte nicht angewendet werden.");
    } finally {
      setBusy(false);
    }
  }

  async function openCurrent() {
    const path = docQuery.data?.storage_path;
    if (!path) return;
    try {
      window.open(await signedAdminShopAreaDocumentUrl(path), "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dokument konnte nicht geöffnet werden.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Händlerkatalog {formatShopAreaLabel(areaKey)}</CardTitle>
        <CardDescription>
          Nur Artikel aus der Händlerdatei. SKUs ohne globales Produkt werden trotzdem übernommen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {docQuery.data ? (
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">Aktuelle Händlerdatei (angewendet): {docQuery.data.file_name}</p>
            <p className="text-muted-foreground">Angewendet: {formatDateTime(docQuery.data.updated_at)}</p>
            <p className="text-muted-foreground">Artikel: {(catalogQuery.data ?? []).length}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Noch keine Händlerdatei für diesen Bereich.</p>
        )}

        {pending && (
          <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-4">
            <p className="text-sm font-medium">Vorschau: {pending.file.name}</p>
            <p className="text-sm">
              {pending.result.matched.length} Artikel erkannt · {pending.result.matched.length} importierbar
              {pending.result.unlinkedCodes.length > 0
                ? ` · ${pending.result.unlinkedCodes.length} ohne globale Produktverknüpfung`
                : ""}
              {pending.result.unmatched.length > 0 ? ` · ${pending.result.unmatched.length} nicht importierbar` : ""}
            </p>
            {pending.result.unlinkedCodes.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {pending.result.unlinkedCodes.length} Artikel sind nicht mit dem globalen Produktmaster verknüpft. Sie
                werden trotzdem als Händlerartikel übernommen.
                {pending.result.unlinkedCodes.length <= 20
                  ? ` (${pending.result.unlinkedCodes.join(", ")})`
                  : ` (${pending.result.unlinkedCodes.slice(0, 20).join(", ")} …)`}
              </p>
            )}
            {pending.result.unmatched.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Nicht importierbar:{" "}
                {pending.result.unmatched
                  .slice(0, 20)
                  .map((row) => `${row.code} (${row.reason === "no_price" ? "kein Preis" : "unklar"})`)
                  .join(", ")}
                {pending.result.unmatched.length > 20 ? " …" : ""}
              </p>
            )}
            {conflicts.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Bestehende manuelle Grundpreise</p>
                <p className="text-xs text-muted-foreground">
                  {conflicts.length} Artikel haben einen Override. Entfernte SKUs verlieren ihren Override immer.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={keepManuals} onCheckedChange={(checked) => setKeepManuals(checked === true)} />
                  Manuelle Grundpreise für vorhandene Artikel behalten
                </label>
                <p className="text-xs text-muted-foreground">
                  {keepManuals
                    ? "Import setzt den Händlerpreis neu. Der manuelle Grundpreis bleibt aktiv, bis er entfernt wird."
                    : "Import ersetzt den Händlerpreis und löscht manuelle Overrides der übernommenen Artikel."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {conflicts
                    .slice(0, 12)
                    .map(
                      (row) =>
                        `${row.code}: Override ${formatUsd(row.currentManualUsd)} / neu ${formatUsd(row.newImportedUsd)}`,
                    )
                    .join(" · ")}
                  {conflicts.length > 12 ? " …" : ""}
                </p>
              </div>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMPORT_ACCEPT}
          className="hidden"
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          {pending ? (
            <>
              <Button type="button" loading={busy} onClick={() => void applyPending()}>
                Katalog anwenden ({pending.result.matched.length} Artikel)
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setPending(null)}>
                Abbrechen
              </Button>
            </>
          ) : (
            <>
              <Button type="button" loading={busy} onClick={() => inputRef.current?.click()}>
                {docQuery.data ? "Neue Händlerdatei hochladen" : "Händlerdatei hochladen"}
              </Button>
              <Button type="button" variant="outline" disabled={!docQuery.data || busy} onClick={() => void openCurrent()}>
                Anzeigen
              </Button>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Unterstützt: {ACCEPTED_IMPORT_LABEL}</p>
      </CardContent>
    </Card>
  );
}

function VendorProductsPanel({
  areaKey,
  profile,
  products,
  onChanged,
}: {
  areaKey: ShopAreaKey;
  profile: ShopPricingProfile;
  products: Tables<"products">[];
  onChanged: () => Promise<void>;
}) {
  const catalogQuery = useQuery({
    queryKey: QUERY_KEYS.adminShopAreaConfig(areaKey).concat("products"),
    queryFn: () => listAdminShopAreaProducts(areaKey),
  });
  const pricesQuery = useQuery({
    queryKey: QUERY_KEYS.adminShopAreaConfig(areaKey).concat("prices"),
    queryFn: () => listAdminShopAreaProductPrices(areaKey),
  });
  const categoriesQuery = useQuery({
    queryKey: QUERY_KEYS.adminShopAreaConfig(areaKey).concat("categories"),
    queryFn: () => listAdminShopAreaCategories(areaKey),
  });

  const categories = categoriesQuery.data ?? [];
  const rows = React.useMemo(() => {
    const priceByCode = new Map(
      (pricesQuery.data ?? [])
        .filter((row) => row.vendor_code)
        .map((row) => [row.vendor_code, row] as const),
    );
    const productById = new Map(products.map((product) => [product.id, product]));
    return (catalogQuery.data ?? []).map((row) => {
      const product = row.product_id ? productById.get(row.product_id) : undefined;
      const price = priceByCode.get(row.vendor_code) ?? (row.product_id ? priceByCode.get(row.product_id) : undefined);
      const imported = price?.imported_price_usd ?? price?.price_usd ?? null;
      const manual = price?.manual_price_usd ?? null;
      const kitBasis = usesKitNoun(
        shopCategoryIdFor(product ?? { category: row.imported_category_key, name: row.vendor_name, code: row.vendor_code }),
      );
      const importedCategory = row.imported_category_key;
      const manualCategory = row.manual_category_key;
      return {
        vendorCode: row.vendor_code,
        productId: row.product_id,
        code: row.vendor_code || product?.code || "—",
        name: row.vendor_name ?? product?.name ?? "—",
        variant: row.vendor_dosage ?? product?.dosage_vial ?? "—",
        imported,
        manual,
        effective: effectiveAreaPriceUsd(imported, manual),
        source: areaPriceSource(manual),
        kitBasis,
        importedCategory,
        manualCategory,
        effectiveCategory: effectiveAreaCategoryKey(importedCategory, manualCategory),
        categorySource: areaCategorySource(importedCategory, manualCategory),
        masterLinked: Boolean(row.product_id),
      };
    });
  }, [catalogQuery.data, pricesQuery.data, products]);

  return (
    <div className="space-y-4">
      <AreaCategoriesEditor areaKey={areaKey} categories={categories} onChanged={onChanged} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Produkte {formatShopAreaLabel(areaKey)}</CardTitle>
          <CardDescription>
            Nur der Händlerkatalog dieses Bereichs. Die Kategorie gilt nur hier, nicht im globalen Produkt-Master.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {catalogQuery.isLoading || pricesQuery.isLoading || categoriesQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Dieser Bereich ist leer, solange keine Händlerdatei angewendet wurde.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Produkt</TableHead>
                    <TableHead>Variante</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead>Basis</TableHead>
                    <TableHead className="text-right">Importpreis</TableHead>
                    <TableHead>Grundpreis</TableHead>
                    <TableHead>Quelle</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <VendorPriceRow
                      key={`${row.vendorCode}|${row.effective}|${row.source}|${row.effectiveCategory}|${row.categorySource}`}
                      areaKey={areaKey}
                      profile={profile}
                      categories={categories}
                      row={row}
                      onChanged={onChanged}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AreaCategoriesEditor({
  areaKey,
  categories,
  onChanged,
}: {
  areaKey: ShopAreaKey;
  categories: AreaCategory[];
  onChanged: () => Promise<void>;
}) {
  const [newKey, setNewKey] = React.useState("");
  const [newLabel, setNewLabel] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function toggle(category: AreaCategory, isActive: boolean) {
    setBusy(true);
    try {
      await setAdminShopAreaCategoryActive(areaKey, category.category_key, isActive);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kategorie konnte nicht geändert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= categories.length) return;
    const keys = categories.map((category) => category.category_key);
    const [removed] = keys.splice(index, 1);
    keys.splice(next, 0, removed);
    setBusy(true);
    try {
      await reorderAdminShopAreaCategories(areaKey, keys);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reihenfolge konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function rename(category: AreaCategory, label: string) {
    const next = label.trim();
    if (!next || next === category.label) return;
    setBusy(true);
    try {
      await renameAdminShopAreaCategory(areaKey, category.category_key, next);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Name konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function addCategory() {
    setBusy(true);
    try {
      await createAdminShopAreaCategory(areaKey, newKey, newLabel);
      setNewKey("");
      setNewLabel("");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kategorie konnte nicht angelegt werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kategorien {formatShopAreaLabel(areaKey)}</CardTitle>
        <CardDescription>
          Aktivierung und Reihenfolge gelten nur in diesem Verkaufsbereich. Produkte bleiben im Händlerkatalog.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {categories.map((category, index) => (
          <div key={category.category_key} className="flex flex-wrap items-center gap-2">
            <Checkbox
              checked={category.is_active}
              disabled={busy}
              onCheckedChange={(checked) => void toggle(category, checked === true)}
            />
            <Input
              defaultValue={category.label}
              className="h-8 max-w-xs"
              disabled={busy}
              onBlur={(event) => void rename(category, event.target.value)}
            />
            <span className="text-xs text-muted-foreground">{category.category_key}</span>
            <Button type="button" size="sm" variant="outline" disabled={busy || index === 0} onClick={() => void move(index, -1)}>
              Nach oben
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || index === categories.length - 1}
              onClick={() => void move(index, 1)}
            >
              Nach unten
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-end gap-2 pt-2">
          <div className="space-y-1">
            <Label className="text-xs">Schlüssel</Label>
            <Input className="h-8 w-40" value={newKey} onChange={(event) => setNewKey(event.target.value)} placeholder="peptides" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input className="h-8 w-40" value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="Peptides" />
          </div>
          <Button type="button" size="sm" disabled={busy || !newKey.trim() || !newLabel.trim()} onClick={() => void addCategory()}>
            Kategorie hinzufügen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function VendorPriceRow({
  areaKey,
  profile,
  categories,
  row,
  onChanged,
}: {
  areaKey: ShopAreaKey;
  profile: ShopPricingProfile;
  categories: AreaCategory[];
  row: {
    vendorCode: string;
    productId: string | null;
    code: string;
    name: string;
    variant: string;
    imported: number | null;
    manual: number | null;
    effective: number | null;
    source: "manual" | "vendor_file";
    kitBasis: boolean;
    importedCategory: string | null;
    manualCategory: string | null;
    effectiveCategory: string | null;
    categorySource: "manual" | "vendor_file" | "none";
    masterLinked: boolean;
  };
  onChanged: () => Promise<void>;
}) {
  const [draft, setDraft] = React.useState(String(row.effective ?? ""));
  const [saving, setSaving] = React.useState(false);

  async function save(manual: number | null) {
    setSaving(true);
    try {
      await setAdminShopAreaManualPrice(areaKey, row.vendorCode, manual);
      toast.success(`${row.code} gespeichert.`);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Grundpreis konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory(categoryKey: string | null) {
    setSaving(true);
    try {
      await setAdminShopAreaProductCategory(areaKey, row.vendorCode, categoryKey);
      toast.success(`${row.code} Kategorie gespeichert.`);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kategorie konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">
        {row.code}
        {!row.masterLinked ? (
          <span className="mt-1 block text-[10px] font-sans text-muted-foreground">ohne Master</span>
        ) : null}
      </TableCell>
      <TableCell>{row.name}</TableCell>
      <TableCell>{row.variant}</TableCell>
      <TableCell>
        <div className="space-y-1">
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={row.effectiveCategory ?? ""}
            disabled={saving}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) return;
              void saveCategory(value);
            }}
          >
            {!row.effectiveCategory && <option value="">Keine Kategorie</option>}
            {categories.map((category) => (
              <option key={category.category_key} value={category.category_key}>
                {category.label}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant={row.categorySource === "manual" ? "default" : "secondary"}>
              {row.categorySource === "manual"
                ? "Manuell"
                : row.categorySource === "vendor_file"
                  ? "Händlerdatei"
                  : "Keine Kategorie"}
            </Badge>
            {row.categorySource === "manual" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void saveCategory(null)}
              >
                Zur Importkategorie zurücksetzen
              </Button>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {profile === "retail" && row.kitBasis ? "Kit-/10er-Grundpreis" : "Einzelpreis"}
      </TableCell>
      <TableCell className="text-right">{row.imported == null ? "—" : formatUsd(row.imported)}</TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={0.01}
            step="0.01"
            className="h-8 w-28"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            loading={saving}
            onClick={() => {
              const value = Number(draft.replace(",", "."));
              if (!Number.isFinite(value) || value <= 0) {
                toast.error("Grundpreis muss größer als 0 sein.");
                return;
              }
              void save(value);
            }}
          >
            Speichern
          </Button>
          {row.source === "manual" && (
            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void save(null)}>
              Override entfernen
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={row.source === "manual" ? "default" : "secondary"}>
          {row.source === "manual" ? "Manuell" : "Händlerdatei"}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">Aktiv</Badge>
      </TableCell>
    </TableRow>
  );
}
