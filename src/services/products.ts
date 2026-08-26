import { supabase } from "@/lib/supabaseClient";
import { normalizeProductCode } from "@/lib/money";
import type { Tables } from "@/types/database";

export interface ProductResolution {
  status: "resolved" | "not_found" | "inactive";
  product: Tables<"products"> | null;
}

/**
 * Resolves a user-entered article code against the product catalog. Never
 * throws for a "not found" - that is a normal, expected outcome the caller
 * renders inline, not an error.
 */
export async function resolveProductByCode(rawCode: string): Promise<ProductResolution> {
  const code = normalizeProductCode(rawCode);
  const { data, error } = await supabase.from("products").select("*").eq("code", code).maybeSingle();
  if (error) throw error;
  if (!data) return { status: "not_found", product: null };
  if (!data.is_active) return { status: "inactive", product: data };
  return { status: "resolved", product: data };
}

/** Batch-resolve many codes at once (used by the paste-import flow). */
export async function resolveProductsByCodes(rawCodes: string[]): Promise<Map<string, Tables<"products">>> {
  const codes = Array.from(new Set(rawCodes.map(normalizeProductCode))).filter(Boolean);
  if (codes.length === 0) return new Map();

  const { data, error } = await supabase.from("products").select("*").in("code", codes);
  if (error) throw error;

  const map = new Map<string, Tables<"products">>();
  for (const product of data ?? []) {
    map.set(product.code, product);
  }
  return map;
}

/** Fetches products by id (used by the "Preise aktualisieren" preview). */
export async function getProductsByIds(ids: string[]): Promise<Map<string, Tables<"products">>> {
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase.from("products").select("*").in("id", uniqueIds);
  if (error) throw error;

  const map = new Map<string, Tables<"products">>();
  for (const product of data ?? []) map.set(product.id, product);
  return map;
}

/** Admin: list all products (active + inactive), optionally filtered. */
export async function listAllProducts(params?: { search?: string; category?: string; activeOnly?: boolean }) {
  let query = supabase.from("products").select("*").order("code", { ascending: true });

  if (params?.search) {
    query = query.or(
      `code.ilike.%${params.search}%,name.ilike.%${params.search}%,dosage_vial.ilike.%${params.search}%`,
    );
  }
  if (params?.category) {
    query = query.eq("category", params.category);
  }
  if (params?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export interface ProductWriteInput {
  code: string;
  name: string;
  dosageVial?: string | null;
  description?: string | null;
  category?: string | null;
  priceUsd: number;
  /** null means "no bulk tier"; always null or set together with the threshold. */
  bulkPriceUsd?: number | null;
  bulkPriceMinQuantity?: number | null;
  isActive: boolean;
}

/**
 * Maps the form input onto database columns. Kept in one place so create and
 * update can never disagree about which fields are written - the bulk pair in
 * particular must always be written together.
 */
function toProductColumns(input: ProductWriteInput) {
  const hasBulk = input.bulkPriceUsd != null && input.bulkPriceMinQuantity != null;
  return {
    code: input.code,
    name: input.name,
    dosage_vial: input.dosageVial || null,
    description: input.description || null,
    category: input.category || null,
    price_usd: input.priceUsd,
    bulk_price_usd: hasBulk ? input.bulkPriceUsd : null,
    bulk_price_min_quantity: hasBulk ? input.bulkPriceMinQuantity : null,
    is_active: input.isActive,
  };
}

export async function createProduct(input: ProductWriteInput): Promise<Tables<"products">> {
  const { data, error } = await supabase.from("products").insert(toProductColumns(input)).select().single();
  if (error) throw error;
  return data;
}

export async function updateProduct(id: string, input: ProductWriteInput): Promise<Tables<"products">> {
  const { data, error } = await supabase
    .from("products")
    .update(toProductColumns(input))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setProductActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function isProductReferenced(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("product_is_referenced", { _product_id: id });
  if (error) throw error;
  return Boolean(data);
}

export async function hardDeleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function getPriceHistory(productId: string): Promise<Tables<"product_price_history">[]> {
  const { data, error } = await supabase
    .from("product_price_history")
    .select("*")
    .eq("product_id", productId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
