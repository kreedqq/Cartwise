import { supabase } from "@/lib/supabaseClient";
import {
  DEFAULT_SHOP_AREA,
  isShopAreaKey,
  SHOP_PRICING_PROFILES,
  type MyShopArea,
  type ShopAreaKey,
  type ShopPricingProfile,
} from "@/lib/shop/shopAreas";
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
  patch: Partial<Pick<Tables<"shop_areas">, "name" | "is_active" | "pricing_profile">>,
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

export { DEFAULT_SHOP_AREA };
