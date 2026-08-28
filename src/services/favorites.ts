import { supabase } from "@/lib/supabaseClient";
import { getProductsByIds } from "@/services/products";
import type { Tables } from "@/types/database";

export interface FavoriteWithProduct {
  id: string;
  productId: string;
  createdAt: string;
  product: Tables<"products"> | null;
}

/**
 * The favorites table has no foreign-key embed typed in src/types/database.ts
 * (see its "Relationships: never[]" - matches the hand-written-schema
 * convention used everywhere else in this file, e.g. services/profiles.ts),
 * so products are joined client-side via getProductsByIds, same pattern as
 * listUsersWithRoles/cart_summaries.
 */
export async function listFavorites(): Promise<FavoriteWithProduct[]> {
  const { data, error } = await supabase
    .from("product_favorites")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const favorites = data ?? [];
  const products = await getProductsByIds(favorites.map((f) => f.product_id));

  return favorites.map((f) => ({
    id: f.id,
    productId: f.product_id,
    createdAt: f.created_at,
    product: products.get(f.product_id) ?? null,
  }));
}

export async function listFavoriteProductIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("product_favorites").select("product_id").eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.product_id));
}

export async function addFavorite(userId: string, productId: string): Promise<void> {
  const { error } = await supabase.from("product_favorites").insert({ user_id: userId, product_id: productId });
  if (error) throw error;
}

export async function removeFavoriteByProductId(userId: string, productId: string): Promise<void> {
  const { error } = await supabase
    .from("product_favorites")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);
  if (error) throw error;
}
