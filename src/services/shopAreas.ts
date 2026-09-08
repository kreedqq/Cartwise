import { supabase } from "@/lib/supabaseClient";
import { PDF_IMPORT_BUCKET } from "@/lib/constants";
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

export async function uploadAdminShopAreaDocument(shopAreaKey: ShopAreaKey, file: File): Promise<void> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `shop-area-docs/${shopAreaKey}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from(PDF_IMPORT_BUCKET).upload(path, file, {
    contentType: contentTypeForImportFile(file.name),
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const existing = await getAdminShopAreaDocument(shopAreaKey);
  if (existing?.storage_path) {
    await supabase.storage.from(PDF_IMPORT_BUCKET).remove([existing.storage_path]);
  }

  const { error } = await supabase.from("shop_area_documents").upsert({
    shop_area_key: shopAreaKey,
    storage_path: path,
    file_name: file.name,
    updated_at: new Date().toISOString(),
  });
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

export { DEFAULT_SHOP_AREA };
