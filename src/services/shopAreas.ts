import { supabase } from "@/lib/supabaseClient";
import { PDF_IMPORT_BUCKET } from "@/lib/constants";
import { runVendorCatalogApply, type VendorCatalogDocumentRef } from "@/lib/shop/vendorCatalog";
import type { ShopAreaStorefront } from "@/lib/shop/areaCategories";
import {
  DEFAULT_BASE_PRICE_FACTOR_PCT,
  DEFAULT_SHOP_AREA,
  isShopAreaKey,
  SHOP_PRICING_PROFILES,
  type MyShopArea,
  type ShopAreaKey,
  type ShopPricingProfile,
} from "@/lib/shop/shopAreas";
import { contentTypeForImportFile } from "@/services/productImportSource";
import type { Tables } from "@/types/database";

function isPricingProfile(value: string): value is ShopPricingProfile {
  return (SHOP_PRICING_PROFILES as readonly string[]).includes(value);
}

export async function listMyShopAreas(): Promise<MyShopArea[]> {
  const { data, error } = await supabase.rpc("list_my_shop_areas");
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    if (!isShopAreaKey(row.key) || !isPricingProfile(row.pricing_profile)) return [];
    return [
      {
        key: row.key,
        name: row.name,
        pricing_profile: row.pricing_profile,
        sort_order: row.sort_order,
        path: row.path,
        base_price_factor_pct: row.base_price_factor_pct ?? DEFAULT_BASE_PRICE_FACTOR_PCT,
      },
    ];
  });
}

export async function listShopProductsForArea(shopArea: ShopAreaKey): Promise<Tables<"products">[]> {
  const { data, error } = await supabase.rpc("list_shop_products_for_area", { _shop_area: shopArea });
  if (error) throw error;
  return data ?? [];
}

export async function ensureShopAreaCart(shopArea: ShopAreaKey): Promise<Tables<"carts">> {
  const { data, error } = await supabase.rpc("ensure_shop_area_cart", { _shop_area: shopArea });
  if (error) throw error;
  return data;
}

export async function listAdminShopAreas(): Promise<Tables<"shop_areas">[]> {
  const { data, error } = await supabase.from("shop_areas").select("*").order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function listAdminShopAreaRoleAccess(): Promise<Tables<"shop_area_role_access">[]> {
  const { data, error } = await supabase.from("shop_area_role_access").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function updateAdminShopArea(
  key: ShopAreaKey,
  patch: Partial<Pick<Tables<"shop_areas">, "name" | "is_active" | "pricing_profile" | "base_price_factor_pct">>,
): Promise<void> {
  const { error } = await supabase.from("shop_areas").update(patch).eq("key", key);
  if (error) throw error;
}

export async function setAdminShopAreaRoles(shopAreaKey: ShopAreaKey, roleIds: string[]): Promise<void> {
  const { error: delError } = await supabase.from("shop_area_role_access").delete().eq("shop_area_key", shopAreaKey);
  if (delError) throw delError;
  if (roleIds.length === 0) return;
  const { error } = await supabase.from("shop_area_role_access").insert(
    roleIds.map((role_id) => ({ shop_area_key: shopAreaKey, role_id })),
  );
  if (error) throw error;
}

export async function setAdminRoleShopAreas(roleId: string, areaKeys: ShopAreaKey[]): Promise<void> {
  const { error: delError } = await supabase.from("shop_area_role_access").delete().eq("role_id", roleId);
  if (delError) throw delError;
  if (areaKeys.length === 0) return;
  const { error } = await supabase.from("shop_area_role_access").insert(
    areaKeys.map((shop_area_key) => ({ shop_area_key, role_id: roleId })),
  );
  if (error) throw error;
}

export async function listAdminShopAreaProducts(shopAreaKey: ShopAreaKey) {
  const { data, error } = await supabase.from("shop_area_products").select("*").eq("shop_area_key", shopAreaKey);
  if (error) throw error;
  return data ?? [];
}

export async function setAdminShopAreaProductActive(
  shopAreaKey: ShopAreaKey,
  productId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase.from("shop_area_products").upsert({
    shop_area_key: shopAreaKey,
    product_id: productId,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteAdminShopAreaProduct(shopAreaKey: ShopAreaKey, productId: string): Promise<void> {
  const { error } = await supabase
    .from("shop_area_products")
    .delete()
    .eq("shop_area_key", shopAreaKey)
    .eq("product_id", productId);
  if (error) throw error;
}

export async function listAdminShopAreaProductPrices(shopAreaKey: ShopAreaKey) {
  const { data, error } = await supabase.from("shop_area_product_prices").select("*").eq("shop_area_key", shopAreaKey);
  if (error) throw error;
  return data ?? [];
}

export async function upsertAdminShopAreaProductPrice(
  shopAreaKey: ShopAreaKey,
  productId: string,
  patch: {
    price_usd: number | null;
    bulk_price_usd: number | null;
    bulk_price_min_quantity: number | null;
  },
): Promise<void> {
  const { error } = await supabase.from("shop_area_product_prices").upsert({
    shop_area_key: shopAreaKey,
    product_id: productId,
    price_usd: patch.price_usd,
    bulk_price_usd: patch.bulk_price_usd,
    bulk_price_min_quantity: patch.bulk_price_min_quantity,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteAdminShopAreaProductPrice(shopAreaKey: ShopAreaKey, productId: string): Promise<void> {
  const { error } = await supabase
    .from("shop_area_product_prices")
    .delete()
    .eq("shop_area_key", shopAreaKey)
    .eq("product_id", productId);
  if (error) throw error;
}

export async function listAdminShopAreaRoleMarkups(shopAreaKey: ShopAreaKey) {
  const { data, error } = await supabase
    .from("shop_area_product_role_markups")
    .select("*")
    .eq("shop_area_key", shopAreaKey);
  if (error) throw error;
  return data ?? [];
}

export async function upsertAdminShopAreaRoleMarkup(
  shopAreaKey: ShopAreaKey,
  productId: string,
  roleId: string,
  markupPercent: number,
): Promise<void> {
  const { error } = await supabase.from("shop_area_product_role_markups").upsert({
    shop_area_key: shopAreaKey,
    product_id: productId,
    role_id: roleId,
    markup_percent: markupPercent,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteAdminShopAreaRoleMarkup(
  shopAreaKey: ShopAreaKey,
  productId: string,
  roleId: string,
): Promise<void> {
  const { error } = await supabase
    .from("shop_area_product_role_markups")
    .delete()
    .eq("shop_area_key", shopAreaKey)
    .eq("product_id", productId)
    .eq("role_id", roleId);
  if (error) throw error;
}

export async function getAdminShopAreaDocument(shopAreaKey: ShopAreaKey) {
  const { data, error } = await supabase.from("shop_area_documents").select("*").eq("shop_area_key", shopAreaKey).maybeSingle();
  if (error) throw error;
  return data;
}

async function storeVendorCatalogFile(
  shopAreaKey: ShopAreaKey,
  file: File,
): Promise<VendorCatalogDocumentRef> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storage_path = `shop-area-docs/${shopAreaKey}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(PDF_IMPORT_BUCKET).upload(storage_path, file, {
    contentType: contentTypeForImportFile(file.name),
    upsert: false,
  });
  if (error) throw error;
  return { storage_path, file_name: file.name };
}

async function removeVendorCatalogFile(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(PDF_IMPORT_BUCKET).remove([storagePath]);
  if (error) throw error;
}

export async function deleteAdminShopAreaDocument(shopAreaKey: ShopAreaKey): Promise<void> {
  const existing = await getAdminShopAreaDocument(shopAreaKey);
  if (existing?.storage_path) {
    await supabase.storage.from(PDF_IMPORT_BUCKET).remove([existing.storage_path]);
  }
  const { error } = await supabase.from("shop_area_documents").delete().eq("shop_area_key", shopAreaKey);
  if (error) throw error;
}

export async function signedAdminShopAreaDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(PDF_IMPORT_BUCKET).createSignedUrl(storagePath, 120);
  if (error) throw error;
  return data.signedUrl;
}

/** Payload for one product entry in the area vendor catalog. */
export interface VendorCatalogRow {
  product_id: string;
  price_usd: number;
  bulk_price_usd: number | null;
  bulk_price_min_quantity: number | null;
  vendor_name?: string | null;
  vendor_dosage?: string | null;
  vendor_raw?: Record<string, unknown> | null;
  imported_category_key?: string | null;
}

export interface VendorCatalogApplyResult {
  added: number;
  removed: number;
  skipped: number;
  kept_manuals?: number;
  kept_category_manuals?: number;
  storage_path: string;
  file_name: string;
}

/**
 * Replaces the vendor catalog for one shop area and points shop_area_documents
 * at the already-uploaded file. Storage upload is a separate step.
 */
export async function applyAreaVendorCatalog(
  shopAreaKey: ShopAreaKey,
  rows: VendorCatalogRow[],
  document: VendorCatalogDocumentRef,
  keepManualOverrides = true,
): Promise<VendorCatalogApplyResult> {
  const { data, error } = await supabase.rpc("apply_area_vendor_catalog", {
    _area_key: shopAreaKey,
    _rows: rows,
    _storage_path: document.storage_path,
    _file_name: document.file_name,
    _keep_manual_overrides: keepManualOverrides,
  });
  if (error) throw error;
  return data as VendorCatalogApplyResult;
}

/**
 * Upload the dealer file first, then apply the catalog. If upload fails the
 * previous catalog stays. If the RPC fails the previous catalog stays and the
 * new storage object may remain unapplied.
 */
export async function applyVendorCatalogFromFile(
  shopAreaKey: ShopAreaKey,
  file: File,
  rows: VendorCatalogRow[],
  keepManualOverrides = true,
): Promise<{ applied: VendorCatalogApplyResult; document: VendorCatalogDocumentRef }> {
  const existing = await getAdminShopAreaDocument(shopAreaKey);
  return runVendorCatalogApply({
    previousStoragePath: existing?.storage_path ?? null,
    uploadNewFile: () => storeVendorCatalogFile(shopAreaKey, file),
    applyCatalog: (document) => applyAreaVendorCatalog(shopAreaKey, rows, document, keepManualOverrides),
    removePreviousFile: removeVendorCatalogFile,
  });
}

export async function setAdminShopAreaManualPrice(
  shopAreaKey: ShopAreaKey,
  productId: string,
  manualPriceUsd: number | null,
): Promise<Tables<"shop_area_product_prices">> {
  const { data, error } = await supabase.rpc("set_area_product_manual_price", {
    _area_key: shopAreaKey,
    _product_id: productId,
    _manual_price_usd: manualPriceUsd,
  });
  if (error) throw error;
  return data as Tables<"shop_area_product_prices">;
}

export async function listAdminShopAreaCategories(shopAreaKey: ShopAreaKey) {
  const { data, error } = await supabase
    .from("shop_area_categories")
    .select("*")
    .eq("shop_area_key", shopAreaKey)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function listShopAreaStorefront(shopArea: ShopAreaKey): Promise<ShopAreaStorefront> {
  const { data, error } = await supabase.rpc("list_shop_area_storefront", { _shop_area: shopArea });
  if (error) throw error;
  const payload = (data ?? { categories: [], assignments: [] }) as ShopAreaStorefront;
  return {
    categories: payload.categories ?? [],
    assignments: payload.assignments ?? [],
  };
}

export async function setAdminShopAreaProductCategory(
  shopAreaKey: ShopAreaKey,
  productId: string,
  categoryKey: string | null,
): Promise<Tables<"shop_area_products">> {
  const { data, error } = await supabase.rpc("set_area_product_category", {
    _area_key: shopAreaKey,
    _product_id: productId,
    _category_key: categoryKey,
  });
  if (error) throw error;
  return data as Tables<"shop_area_products">;
}

export async function setAdminShopAreaCategoryActive(
  shopAreaKey: ShopAreaKey,
  categoryKey: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("set_shop_area_category_active", {
    _area_key: shopAreaKey,
    _category_key: categoryKey,
    _is_active: isActive,
  });
  if (error) throw error;
}

export async function renameAdminShopAreaCategory(
  shopAreaKey: ShopAreaKey,
  categoryKey: string,
  label: string,
): Promise<void> {
  const { error } = await supabase.rpc("rename_shop_area_category", {
    _area_key: shopAreaKey,
    _category_key: categoryKey,
    _label: label,
  });
  if (error) throw error;
}

export async function reorderAdminShopAreaCategories(
  shopAreaKey: ShopAreaKey,
  keys: string[],
): Promise<void> {
  const { error } = await supabase.rpc("reorder_shop_area_categories", {
    _area_key: shopAreaKey,
    _keys: keys,
  });
  if (error) throw error;
}

export async function createAdminShopAreaCategory(
  shopAreaKey: ShopAreaKey,
  categoryKey: string,
  label: string,
): Promise<void> {
  const { error } = await supabase.rpc("create_shop_area_category", {
    _area_key: shopAreaKey,
    _category_key: categoryKey,
    _label: label,
  });
  if (error) throw error;
}

export { DEFAULT_SHOP_AREA };
