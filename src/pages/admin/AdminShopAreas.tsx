import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
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
import { applyRoleMarkup, formatDateTime, formatUsd } from "@/lib/money";
import { shopAreaCatalogUnit } from "@/lib/shop/shopAreaPricing";
import {
  DEFAULT_BASE_PRICE_FACTOR_PCT,
  RETAIL_KIT_UNIT_DIVISOR,
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
  applyAreaVendorCatalog,
  deleteAdminShopAreaDocument,
  getAdminShopAreaDocument,
  listAdminShopAreaProducts,
  listAdminShopAreaRoleAccess,
  listAdminShopAreas,
  setAdminShopAreaProductActive,
  setAdminShopAreaRoles,
  signedAdminShopAreaDocumentUrl,
  updateAdminShopArea,
  uploadAdminShopAreaDocument,
} from "@/services/shopAreas";
import { matchVendorCatalogRows, type VendorCatalogMatchResult } from "@/lib/shop/vendorCatalog";
import { parseProductXlsx } from "@/services/xlsxProducts";
import { parseProductCsv } from "@/services/csvProducts";
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
            <AreaDocumentPanel areaKey={areaKey} products={products} onCatalogChanged={invalidate} />
          </TabsContent>

          <TabsContent value="preise">
            <AreaPricesPanel
              areaKey={areaKey}
              area={selected}
              profile={lockedProfile}
              onChanged={invalidate}
            />
          </TabsContent>
        </Tabs>
      )}
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

  // Only show products that are explicitly in the vendor catalog for this area.
  // The new semantics (migration 0056) require an explicit shop_area_products row;
  // global products not in the vendor catalog are invisible here.
  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    // Build the set of product_ids present in the vendor catalog
    const catalogProductIds = new Set(overlayQuery.data?.map((row) => row.product_id) ?? []);
    return products.filter((product) => {
      if (!catalogProductIds.has(product.id)) return false;
      if (!term) return true;
      return `${product.code} ${product.name} ${product.dosage_vial ?? ""}`.toLowerCase().includes(term);
    });
  }, [products, overlayQuery.data, search]);

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
        <CardTitle className="text-base">Händlerkatalog – {SHOP_AREA_LABELS[areaKey]}</CardTitle>
        <CardDescription>
          Zeigt nur Produkte, die über das Händlerdokument importiert wurden. Um den Katalog zu ändern, lade ein neues
          Dokument im Tab &quot;Produktdokument&quot; hoch. Der Toggle deaktiviert ein Produkt vorübergehend innerhalb
          des Katalogs, macht aber keine neuen Produkte sichtbar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Produkt suchen …" />
        {overlayQuery.isLoading && <Skeleton className="h-48 w-full" />}
        {!overlayQuery.isLoading && filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Kein Händlerkatalog vorhanden. Lade ein Händlerdokument im Tab &quot;Produktdokument&quot; hoch.
          </p>
        )}
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

/**
 * AreaDocumentPanel (migration 0056 version)
 *
 * The uploaded document is now the single source of truth for the vendor
 * catalog of this area. Upload flow:
 *   1. Admin selects a file → parsed client-side → preview shown.
 *   2. Admin clicks "Dokument speichern & Katalog anwenden" → file stored in
 *      Supabase Storage, apply_area_vendor_catalog RPC called atomically.
 *
 * Supports XLSX and CSV only for catalog parsing (PDF has no structured data).
 */
function AreaDocumentPanel({
  areaKey,
  products,
  onCatalogChanged,
}: {
  areaKey: ShopAreaKey;
  products: Tables<"products">[];
  onCatalogChanged: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const docQuery = useQuery({
    queryKey: QUERY_KEYS.adminShopAreaConfig(areaKey).concat("document"),
    queryFn: () => getAdminShopAreaDocument(areaKey),
  });
  const [busy, setBusy] = React.useState(false);
  const [pendingMatch, setPendingMatch] = React.useState<{
    file: File;
    result: VendorCatalogMatchResult;
  } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function parseFile(file: File): Promise<void> {
    const kind = detectImportSourceKind(file.name);
    if (!kind || kind === "pdf") {
      toast.error("Händlerkatalog-Import erfordert eine XLSX- oder CSV-Datei.");
      return;
    }
    try {
      let rows;
      if (kind === "xlsx") {
        const result = await parseProductXlsx(file);
        rows = result.rows;
      } else {
        const text = await file.text();
        const result = parseProductCsv(text);
        rows = result.rows;
      }
      const result = matchVendorCatalogRows(rows, products);
      setPendingMatch({ file, result });
    } catch (error) {
      console.error("Datei konnte nicht geparst werden:", error);
      toast.error(error instanceof Error ? error.message : "Datei konnte nicht geparst werden.");
    }
  }

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
    await parseFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function applyPending() {
    if (!pendingMatch) return;
    setBusy(true);
    try {
      // 1. Upload document to storage
      await uploadAdminShopAreaDocument(areaKey, pendingMatch.file);
      // 2. Apply vendor catalog atomically
      const rows = pendingMatch.result.matched.map((e) => ({
        product_id: e.product_id,
        price_usd: e.price_usd,
        bulk_price_usd: e.bulk_price_usd,
        bulk_price_min_quantity: e.bulk_price_min_quantity,
      }));
      const result = await applyAreaVendorCatalog(areaKey, rows);
      toast.success(
        `Händlerkatalog angewendet: ${result.added} Produkte hinzugefügt, ${result.removed} entfernt.`,
      );
      setPendingMatch(null);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminShopAreaConfig(areaKey) });
      await onCatalogChanged();
    } catch (error) {
      console.error("Händlerkatalog-Import fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Händlerkatalog konnte nicht importiert werden.");
    } finally {
      setBusy(false);
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
        <CardTitle className="text-base">Händlerdokument – {SHOP_AREA_LABELS[areaKey]}</CardTitle>
        <CardDescription>
          Das hochgeladene Dokument definiert das Sortiment dieses Bereichs. Nur Produkte, deren Artikelcode im
          Dokument steht, werden in {SHOP_AREA_LABELS[areaKey]} angezeigt. Ein Dokument für diesen Bereich ändert die
          anderen Bereiche nicht.
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

        {/* Import preview */}
        {pendingMatch && (
          <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-4">
            <p className="text-sm font-medium">Vorschau: {pendingMatch.file.name}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded border border-green-200 bg-green-50 p-2 dark:border-green-900 dark:bg-green-950">
                <p className="font-medium text-green-800 dark:text-green-200">
                  {pendingMatch.result.matched.length} Produkte gefunden
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">Werden in den Katalog übernommen</p>
              </div>
              <div
                className={`rounded border p-2 ${pendingMatch.result.unmatchedCodes.length > 0 ? "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950" : "border-border bg-secondary/10"}`}
              >
                <p
                  className={`font-medium ${pendingMatch.result.unmatchedCodes.length > 0 ? "text-yellow-800 dark:text-yellow-200" : "text-muted-foreground"}`}
                >
                  {pendingMatch.result.unmatchedCodes.length} unbekannte Artikelcodes
                </p>
                <p
                  className={`text-xs ${pendingMatch.result.unmatchedCodes.length > 0 ? "text-yellow-700 dark:text-yellow-300" : "text-muted-foreground"}`}
                >
                  Nicht im globalen Katalog – werden übersprungen
                </p>
              </div>
            </div>
            {pendingMatch.result.unmatchedCodes.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Unbekannte Codes:{" "}
                {pendingMatch.result.unmatchedCodes.slice(0, 20).join(", ")}
                {pendingMatch.result.unmatchedCodes.length > 20
                  ? ` … (+${pendingMatch.result.unmatchedCodes.length - 20} weitere)`
                  : ""}
              </p>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMPORT_ACCEPT}
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          {pendingMatch ? (
            <>
              <Button type="button" loading={busy} onClick={() => void applyPending()}>
                Dokument speichern &amp; Katalog anwenden ({pendingMatch.result.matched.length} Produkte)
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setPendingMatch(null)}>
                Abbrechen
              </Button>
            </>
          ) : (
            <>
              <Button type="button" loading={busy} onClick={() => inputRef.current?.click()}>
                {docQuery.data ? "Neues Dokument importieren" : "Händlerdokument hochladen"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!docQuery.data || busy}
                onClick={() => void openCurrent()}
              >
                Anzeigen
              </Button>
              <Button type="button" variant="outline" disabled={!docQuery.data || busy} onClick={() => void remove()}>
                Entfernen
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Preise tab: area-level base price factor (replaces per-product price table).
 * The factor applies uniformly to all products in this area.
 * Per-product catalog price overrides (shop_area_product_prices) are still supported
 * via import workflows; they are not surfaced in this UI.
 */
function AreaPricesPanel({
  areaKey,
  area,
  profile,
  onChanged,
}: {
  areaKey: ShopAreaKey;
  area: Tables<"shop_areas">;
  profile: ShopPricingProfile;
  onChanged: () => Promise<void>;
}) {
  const [localFactor, setLocalFactor] = React.useState<number>(
    area.base_price_factor_pct ?? DEFAULT_BASE_PRICE_FACTOR_PCT,
  );
  const [saving, setSaving] = React.useState(false);

  async function saveFactor() {
    const value = Number(localFactor);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Faktor muss eine positive Zahl sein.");
      return;
    }
    setSaving(true);
    try {
      await updateAdminShopArea(areaKey, { base_price_factor_pct: value });
      toast.success(`Grundpreisfaktor für ${SHOP_AREA_LABELS[areaKey]} gespeichert.`);
      await onChanged();
    } catch (error) {
      console.error("Faktor speichern fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Faktor konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  const isRetail = profile === "retail";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preiseinstellungen {SHOP_AREA_LABELS[areaKey]}</CardTitle>
        <CardDescription>
          {isRetail
            ? "Retail-Formel: (Importpreis ÷ Kit-Teiler) × (Faktor ÷ 100). Der Rollenaufschlag wird danach genau einmal angewendet."
            : "Group-Buy-Formel: Importpreis × (Faktor ÷ 100). Der Rollenaufschlag wird danach genau einmal angewendet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Factor input */}
        <div className="space-y-3">
          <Label htmlFor={`factor-${areaKey}`}>Grundpreisfaktor (%)</Label>
          <p className="text-xs text-muted-foreground">
            100 % = 1× (kein Aufschlag) · 300 % = 3× · 150 % = 1,5× · Formel: Faktor (%) ÷ 100 = Multiplikator
          </p>
          <div className="flex items-center gap-2">
            <Input
              id={`factor-${areaKey}`}
              type="number"
              min={1}
              max={10000}
              step={1}
              value={localFactor}
              onChange={(e) => setLocalFactor(Number(e.target.value))}
              className="w-36"
            />
            <span className="text-sm text-muted-foreground">%</span>
            <Button type="button" loading={saving} onClick={() => void saveFactor()}>
              Speichern
            </Button>
          </div>
        </div>

        {/* Price preview using SSoT functions */}
        <PriceFactorPreview factorPct={localFactor} isRetail={isRetail} />
      </CardContent>
    </Card>
  );
}

/**
 * Live preview of catalog and selling prices based on an example import price.
 * Uses shopAreaCatalogUnit and applyRoleMarkup (SSoTs) – no inline pricing logic.
 */
function PriceFactorPreview({ factorPct, isRetail }: { factorPct: number; isRetail: boolean }) {
  const EXAMPLE_IMPORT = 100;
  const EXAMPLE_ROLE_MARKUPS = [0, 25] as const;

  const safeFactorPct = Number.isFinite(factorPct) && factorPct > 0 ? factorPct : DEFAULT_BASE_PRICE_FACTOR_PCT;
  const multiplier = safeFactorPct / 100;

  // Retail: peptide example (usesKitUnitPricing = true), kitDivisor = 10
  // Group Buy: vial unit example (usesKitUnitPricing = false, factor applies directly)
  const catalogBase = shopAreaCatalogUnit(
    { price_usd: EXAMPLE_IMPORT },
    1,
    isRetail ? "retail" : "group_buy",
    isRetail, // usesKitUnitPricing: true for retail (peptide), irrelevant for GB
    safeFactorPct,
    RETAIL_KIT_UNIT_DIVISOR,
  );

  return (
    <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-4">
      <p className="text-sm font-medium">Preisvorschau (Beispiel: Importpreis {formatUsd(EXAMPLE_IMPORT)})</p>

      {isRetail ? (
        <p className="text-xs text-muted-foreground">
          Schritt 1: {EXAMPLE_IMPORT} ÷ {RETAIL_KIT_UNIT_DIVISOR} = {EXAMPLE_IMPORT / RETAIL_KIT_UNIT_DIVISOR} USD/Vial
          <br />
          Schritt 2: {EXAMPLE_IMPORT / RETAIL_KIT_UNIT_DIVISOR} × {multiplier.toFixed(2)} ={" "}
          <strong>{formatUsd(catalogBase)}</strong> (Katalogpreis ohne Aufschlag)
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {EXAMPLE_IMPORT} × {multiplier.toFixed(2)} = <strong>{formatUsd(catalogBase)}</strong> (Katalogpreis ohne
          Aufschlag)
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rollenaufschlag</TableHead>
            <TableHead className="text-right">Verkaufspreis</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {EXAMPLE_ROLE_MARKUPS.map((markupPct) => (
            <TableRow key={markupPct}>
              <TableCell className="text-sm">{markupPct} %</TableCell>
              <TableCell className="text-right text-sm font-medium">
                {formatUsd(applyRoleMarkup(catalogBase, markupPct))} / {isRetail ? "Vial" : "Einheit"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// AreaRolePricesPanel and AreaRoleMarkupEditor removed in migration 0053.
// Role markup is now global-only via markup_percent_for().
// Per-product area price overrides (shop_area_product_prices) are retained for import workflows.
// The shop_area_product_role_markups table is retained for future use.
