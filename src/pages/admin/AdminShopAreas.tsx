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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { MAX_PDF_SIZE_BYTES, QUERY_KEYS } from "@/lib/constants";
import { formatDateTime, formatUsd } from "@/lib/money";
import { shopAreaCatalogUnit } from "@/lib/shop/shopAreaPricing";
import { shopCategoryIdFor } from "@/lib/shopCategories";
import {
  RETAIL_KIT_UNIT_DIVISOR,
  RETAIL_PRICE_FACTOR,
  SHOP_AREA_KEYS,
  SHOP_AREA_LABELS,
  isShopAreaKey,
  pricingProfileForArea,
  type ShopAreaKey,
  type ShopPricingProfile,
} from "@/lib/shop/shopAreas";
import { ACCEPTED_IMPORT_ACCEPT, ACCEPTED_IMPORT_LABEL, detectImportSourceKind } from "@/services/productImportSource";
import { listCustomerRoles } from "@/services/customerRoles";
import { listAllProducts } from "@/services/products";
import {
  deleteAdminShopAreaDocument,
  deleteAdminShopAreaProductPrice,
  getAdminShopAreaDocument,
  listAdminShopAreaProductPrices,
  listAdminShopAreaProducts,
  listAdminShopAreaRoleAccess,
  listAdminShopAreas,
  setAdminShopAreaProductActive,
  setAdminShopAreaRoles,
  signedAdminShopAreaDocumentUrl,
  updateAdminShopArea,
  uploadAdminShopAreaDocument,
  upsertAdminShopAreaProductPrice,
} from "@/services/shopAreas";
import type { Tables } from "@/types/database";

const PROFILE_LABELS: Record<ShopPricingProfile, string> = {
  retail: "Einzelverkauf",
  group_buy: "Group Buy",
};

type AreaTab = "allgemein" | "produkte" | "dokument" | "preise";

export default function AdminShopAreasPage() {
  const queryClient = useQueryClient();
  const areasQuery = useQuery({ queryKey: QUERY_KEYS.adminShopAreas, queryFn: listAdminShopAreas });
  const accessQuery = useQuery({ queryKey: [...QUERY_KEYS.adminShopAreas, "access"], queryFn: listAdminShopAreaRoleAccess });
  const rolesQuery = useQuery({ queryKey: ["customer-roles"], queryFn: listCustomerRoles });
  const productsQuery = useQuery({ queryKey: ["admin-products"], queryFn: () => listAllProducts() });
  const [areaKey, setAreaKey] = React.useState<ShopAreaKey>("shop");
  const [tab, setTab] = React.useState<AreaTab>("allgemein");
  const [savingKey, setSavingKey] = React.useState<string | null>(null);

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminShopAreas });
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myShopAreas });
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminShopAreaConfig(areaKey) });
  }

  const roles = rolesQuery.data ?? [];
  const access = accessQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const selected = (areasQuery.data ?? []).find((area) => area.key === areaKey);
  const assigned = access.filter((row) => row.shop_area_key === areaKey).map((row) => row.role_id);
  const lockedProfile = pricingProfileForArea(areaKey);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Verkaufsbereiche"
        description="Ein Produktkatalog, drei Bereiche: Shop als Einzelverkauf, Group Buy 1 und Group Buy 2 als getrennte Kit-Instanzen."
      />

      {areasQuery.isLoading && <Skeleton className="h-64 w-full" />}
      {areasQuery.isError && (
        <ErrorState message="Verkaufsbereiche konnten nicht geladen werden." onRetry={() => areasQuery.refetch()} />
      )}

      <div className="flex flex-wrap gap-2">
        {SHOP_AREA_KEYS.map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={areaKey === key ? "default" : "outline"}
            onClick={() => {
              setAreaKey(key);
              setTab("allgemein");
            }}
          >
            {SHOP_AREA_LABELS[key]}
          </Button>
        ))}
      </div>

      {selected && isShopAreaKey(selected.key) && (
        <Tabs value={tab} onValueChange={(value) => setTab(value as AreaTab)}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="allgemein">Allgemein</TabsTrigger>
            <TabsTrigger value="produkte">Produkte</TabsTrigger>
            <TabsTrigger value="dokument">Produktdokument</TabsTrigger>
            <TabsTrigger value="preise">Preise</TabsTrigger>
          </TabsList>

          <TabsContent value="allgemein">
            <ShopAreaGeneralCard
              key={`${areaKey}|${selected.name}|${String(selected.is_active)}|${assigned.slice().sort().join(",")}`}
              areaKey={areaKey}
              name={selected.name}
              isActive={selected.is_active}
              profile={lockedProfile}
              assignedRoleIds={assigned}
              roles={roles}
              saving={savingKey === areaKey}
              onSave={async (next) => {
                setSavingKey(areaKey);
                try {
                  await updateAdminShopArea(areaKey, {
                    name: next.name,
                    is_active: next.isActive,
                    pricing_profile: lockedProfile,
                  });
                  await setAdminShopAreaRoles(areaKey, next.roleIds);
                  toast.success(`${SHOP_AREA_LABELS[areaKey]} gespeichert.`);
                  await invalidate();
                } catch (error) {
                  console.error("Verkaufsbereich speichern fehlgeschlagen:", error);
                  toast.error(error instanceof Error ? error.message : "Verkaufsbereich konnte nicht gespeichert werden.");
                } finally {
                  setSavingKey(null);
                }
              }}
            />
          </TabsContent>

          <TabsContent value="produkte">
            {productsQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <AreaProductsPanel areaKey={areaKey} products={products} onChanged={invalidate} />
            )}
          </TabsContent>

          <TabsContent value="dokument">
            <AreaDocumentPanel areaKey={areaKey} />
          </TabsContent>

          <TabsContent value="preise">
            {productsQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <AreaPricesPanel areaKey={areaKey} products={products} profile={lockedProfile} onChanged={invalidate} />
            )}
          </TabsContent>
        </Tabs>
      )}

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

function ShopAreaGeneralCard({
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
  onSave: (next: { name: string; isActive: boolean; roleIds: string[] }) => Promise<void>;
}) {
  const [localName, setLocalName] = React.useState(name);
  const [localActive, setLocalActive] = React.useState(isActive);
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
        <CardDescription>Preismodell: {PROFILE_LABELS[profile]} (fest für diesen Bereich)</CardDescription>
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
          onClick={() => void onSave({ name: localName.trim() || name, isActive: localActive, roleIds })}
        >
          Speichern
        </Button>
      </CardContent>
    </Card>
  );
}

function AreaProductsPanel({
  areaKey,
  products,
  onChanged,
}: {
  areaKey: ShopAreaKey;
  products: Tables<"products">[];
  onChanged: () => Promise<void>;
}) {
  const overlayQuery = useQuery({
    queryKey: QUERY_KEYS.adminShopAreaConfig(areaKey).concat("products"),
    queryFn: () => listAdminShopAreaProducts(areaKey),
  });
  const [search, setSearch] = React.useState("");
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const overlay = React.useMemo(() => {
    const map = new Map<string, boolean>();
    for (const row of overlayQuery.data ?? []) map.set(row.product_id, row.is_active);
    return map;
  }, [overlayQuery.data]);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      if (!term) return true;
      return `${product.code} ${product.name} ${product.dosage_vial ?? ""}`.toLowerCase().includes(term);
    });
  }, [products, search]);

  async function toggle(product: Tables<"products">, next: boolean) {
    setSavingId(product.id);
    try {
      await setAdminShopAreaProductActive(areaKey, product.id, next);
      toast.success(`${product.name} in ${SHOP_AREA_LABELS[areaKey]} ${next ? "aktiviert" : "deaktiviert"}.`);
      await overlayQuery.refetch();
      await onChanged();
    } catch (error) {
      console.error("Produktzuordnung speichern fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Produktzuordnung konnte nicht gespeichert werden.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Produkte in {SHOP_AREA_LABELS[areaKey]}</CardTitle>
        <CardDescription>
          Zentrale Produktbasis bleibt erhalten. Aus ist eine Bereichsausblendung; ohne Eintrag gilt der Katalogstatus.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Produkt suchen …" />
        {overlayQuery.isLoading && <Skeleton className="h-48 w-full" />}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artikel</TableHead>
                <TableHead>Katalog</TableHead>
                <TableHead className="text-right">In diesem Bereich</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((product) => {
                const areaActive = overlay.get(product.id) ?? product.is_active;
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.code}
                        {product.dosage_vial ? ` · ${product.dosage_vial}` : ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.is_active ? "secondary" : "outline"}>
                        {product.is_active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={areaActive}
                        disabled={savingId === product.id || !product.is_active}
                        onCheckedChange={(checked) => void toggle(product, checked)}
                        aria-label={`${product.name} in ${SHOP_AREA_LABELS[areaKey]}`}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function AreaDocumentPanel({ areaKey }: { areaKey: ShopAreaKey }) {
  const queryClient = useQueryClient();
  const docQuery = useQuery({
    queryKey: QUERY_KEYS.adminShopAreaConfig(areaKey).concat("document"),
    queryFn: () => getAdminShopAreaDocument(areaKey),
  });
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

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
      await uploadAdminShopAreaDocument(areaKey, file);
      toast.success("Dokument gespeichert.");
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminShopAreaConfig(areaKey) });
    } catch (error) {
      console.error("Dokument-Upload fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Dokument konnte nicht hochgeladen werden.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function openCurrent() {
    const path = docQuery.data?.storage_path;
    if (!path) return;
    try {
      const url = await signedAdminShopAreaDocumentUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dokument konnte nicht geöffnet werden.");
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteAdminShopAreaDocument(areaKey);
      toast.success("Dokument entfernt.");
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminShopAreaConfig(areaKey) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dokument konnte nicht entfernt werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Produktdokument {SHOP_AREA_LABELS[areaKey]}</CardTitle>
        <CardDescription>
          Nur für diesen Bereich. Ein Dokument für Group Buy 1 ändert Group Buy 2 und den Shop nicht.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {docQuery.isLoading && <Skeleton className="h-16 w-full" />}
        {docQuery.data ? (
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">{docQuery.data.file_name}</p>
            <p className="text-muted-foreground">Aktualisiert {formatDateTime(docQuery.data.updated_at)}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Kein Dokument hinterlegt.</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMPORT_ACCEPT}
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" loading={busy} onClick={() => inputRef.current?.click()}>
            {docQuery.data ? "Ersetzen" : "Hochladen"}
          </Button>
          <Button type="button" variant="outline" disabled={!docQuery.data || busy} onClick={() => void openCurrent()}>
            Anzeigen
          </Button>
          <Button type="button" variant="outline" disabled={!docQuery.data || busy} onClick={() => void remove()}>
            Entfernen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function AreaPricesPanel({
  areaKey,
  products,
  profile,
  onChanged,
}: {
  areaKey: ShopAreaKey;
  products: Tables<"products">[];
  profile: ShopPricingProfile;
  onChanged: () => Promise<void>;
}) {
  const pricesQuery = useQuery({
    queryKey: QUERY_KEYS.adminShopAreaConfig(areaKey).concat("prices"),
    queryFn: () => listAdminShopAreaProductPrices(areaKey),
  });
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string>(products[0]?.id ?? "");

  const priceMap = React.useMemo(() => {
    const map = new Map<string, Tables<"shop_area_product_prices">>();
    for (const row of pricesQuery.data ?? []) map.set(row.product_id, row);
    return map;
  }, [pricesQuery.data]);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      if (!term) return true;
      return `${product.code} ${product.name}`.toLowerCase().includes(term);
    });
  }, [products, search]);

  const selected = products.find((product) => product.id === selectedId) ?? filtered[0] ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preise in {SHOP_AREA_LABELS[areaKey]}</CardTitle>
        <CardDescription>
          Leere Felder übernehmen den zentralen Katalogpreis. Shop zeigt den resultierenden Einzelpreis, Group Buy die
          Kit-/Staffellogik.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Produkt suchen …" />
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
            {filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                className={`flex w-full flex-col items-start border-b border-border px-3 py-2 text-left text-sm last:border-b-0 ${
                  selected?.id === product.id ? "bg-secondary" : "hover:bg-secondary/50"
                }`}
                onClick={() => setSelectedId(product.id)}
              >
                <span className="font-medium">{product.name}</span>
                <span className="text-xs text-muted-foreground">
                  {product.code} · Katalog {formatUsd(product.price_usd)}
                </span>
              </button>
            ))}
          </div>
        </div>
        {selected && (
          <AreaPriceEditor
            key={`${areaKey}-${selected.id}-${priceMap.get(selected.id)?.updated_at ?? "catalog"}`}
            areaKey={areaKey}
            product={selected}
            profile={profile}
            override={priceMap.get(selected.id) ?? null}
            onSaved={async () => {
              await pricesQuery.refetch();
              await onChanged();
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function AreaPriceEditor({
  areaKey,
  product,
  profile,
  override,
  onSaved,
}: {
  areaKey: ShopAreaKey;
  product: Tables<"products">;
  profile: ShopPricingProfile;
  override: Tables<"shop_area_product_prices"> | null;
  onSaved: () => Promise<void>;
}) {
  const [priceUsd, setPriceUsd] = React.useState(override?.price_usd != null ? String(override.price_usd) : "");
  const [bulkUsd, setBulkUsd] = React.useState(override?.bulk_price_usd != null ? String(override.bulk_price_usd) : "");
  const [bulkMin, setBulkMin] = React.useState(
    override?.bulk_price_min_quantity != null ? String(override.bulk_price_min_quantity) : "",
  );
  const [saving, setSaving] = React.useState(false);
  const categoryId = shopCategoryIdFor(product);
  const usesKit = categoryId === "peptides" || categoryId === "reconstitution-water";
  const kitUnit = shopAreaCatalogUnit(
    {
      price_usd: parseOptionalNumber(priceUsd) ?? product.price_usd,
      bulk_price_usd: parseOptionalNumber(bulkUsd) ?? product.bulk_price_usd,
      bulk_price_min_quantity: parseOptionalNumber(bulkMin) ?? product.bulk_price_min_quantity,
    },
    1,
    profile,
    usesKit,
  );

  async function save() {
    const nextPrice = parseOptionalNumber(priceUsd);
    const nextBulk = parseOptionalNumber(bulkUsd);
    const nextMin = parseOptionalNumber(bulkMin);
    if ((nextBulk == null) !== (nextMin == null)) {
      toast.error("Mengenstaffel braucht Preis und Mindestmenge gemeinsam.");
      return;
    }
    setSaving(true);
    try {
      if (nextPrice == null && nextBulk == null) {
        await deleteAdminShopAreaProductPrice(areaKey, product.id);
      } else {
        await upsertAdminShopAreaProductPrice(areaKey, product.id, {
          price_usd: nextPrice,
          bulk_price_usd: nextBulk,
          bulk_price_min_quantity: nextMin,
        });
      }
      toast.success("Bereichspreis gespeichert.");
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preis konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function resetToCatalog() {
    setSaving(true);
    try {
      await deleteAdminShopAreaProductPrice(areaKey, product.id);
      setPriceUsd("");
      setBulkUsd("");
      setBulkMin("");
      toast.success("Katalogpreis übernommen.");
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preis konnte nicht zurückgesetzt werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{product.name}</p>
      <p className="text-xs text-muted-foreground">
        Katalog {formatUsd(product.price_usd)} · Bereichseinheit {formatUsd(kitUnit)}
      </p>
      <div className="space-y-1">
        <Label htmlFor="area-price">Basispreis USD</Label>
        <Input
          id="area-price"
          inputMode="decimal"
          value={priceUsd}
          onChange={(e) => setPriceUsd(e.target.value)}
          placeholder={String(product.price_usd)}
        />
      </div>
      {profile === "group_buy" && (
        <>
          <div className="space-y-1">
            <Label htmlFor="area-bulk">Staffelpreis USD</Label>
            <Input id="area-bulk" inputMode="decimal" value={bulkUsd} onChange={(e) => setBulkUsd(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="area-bulk-min">Ab Menge</Label>
            <Input id="area-bulk-min" inputMode="decimal" value={bulkMin} onChange={(e) => setBulkMin(e.target.value)} />
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" loading={saving} onClick={() => void save()}>
          Speichern
        </Button>
        <Button type="button" variant="outline" disabled={saving} onClick={() => void resetToCatalog()}>
          Katalog übernehmen
        </Button>
      </div>
    </div>
  );
}
// AreaRolePricesPanel and AreaRoleMarkupEditor removed in migration 0053.
// Role markup is now global-only via markup_percent_for().
// The shop_area_product_role_markups table is retained for future use.
