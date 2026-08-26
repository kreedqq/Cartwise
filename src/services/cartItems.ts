import { supabase } from "@/lib/supabaseClient";
import { ConcurrencyError } from "@/lib/errors";
import { buildSnapshot } from "@/lib/snapshot";
import { resolveProductByCode, resolveProductsByCodes } from "@/services/products";
import type { Database, Tables } from "@/types/database";

export async function listCartItems(cartId: string): Promise<Tables<"cart_items">[]> {
  const { data, error } = await supabase
    .from("cart_items")
    .select("*")
    .eq("cart_id", cartId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Adds a new line item: resolves the product code against the catalog and,
 * if found, writes an immediate price snapshot (see docs/KONZEPT.md §5).
 */
export async function addCartItem(
  cartId: string,
  productCodeInput: string,
  quantity: number,
  nextPosition: number,
  currentRate: number | null,
): Promise<Tables<"cart_items">> {
  const resolution = await resolveProductByCode(productCodeInput);

  const base = {
    cart_id: cartId,
    position: nextPosition,
    product_code_input: productCodeInput,
    quantity,
  };

  if (resolution.status === "not_found") {
    const { data, error } = await supabase
      .from("cart_items")
      .insert({ ...base, resolution_status: "not_found" })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const product = resolution.product!;
  const snapshot = buildSnapshot(product, quantity, currentRate);

  const { data, error } = await supabase
    .from("cart_items")
    .insert({
      ...base,
      product_id: product.id,
      product_code_snapshot: snapshot.productCodeSnapshot,
      product_name_snapshot: snapshot.productNameSnapshot,
      unit_price_usd_snapshot: snapshot.unitPriceUsdSnapshot,
      exchange_rate_snapshot: snapshot.exchangeRateSnapshot,
      eur_value_snapshot: snapshot.eurValueSnapshot,
      price_snapshot_at: snapshot.priceSnapshotAt,
      resolution_status: resolution.status === "inactive" ? "inactive" : "resolved",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Re-resolves the product code for an existing row (e.g. after the user edits the code inline). */
export async function reresolveCartItemCode(
  item: Tables<"cart_items">,
  newCode: string,
  currentRate: number | null,
): Promise<Tables<"cart_items">> {
  const resolution = await resolveProductByCode(newCode);
  const patch: Partial<Tables<"cart_items">> = { product_code_input: newCode };

  if (resolution.status === "not_found") {
    patch.product_id = null;
    patch.resolution_status = "not_found";
    patch.product_code_snapshot = null;
    patch.product_name_snapshot = null;
    patch.unit_price_usd_snapshot = null;
    patch.exchange_rate_snapshot = null;
    patch.eur_value_snapshot = null;
    patch.price_snapshot_at = null;
  } else {
    const product = resolution.product!;
    const snapshot = buildSnapshot(product, item.quantity, currentRate);
    patch.product_id = product.id;
    patch.resolution_status = resolution.status === "inactive" ? "inactive" : "resolved";
    patch.product_code_snapshot = snapshot.productCodeSnapshot;
    patch.product_name_snapshot = snapshot.productNameSnapshot;
    patch.unit_price_usd_snapshot = snapshot.unitPriceUsdSnapshot;
    patch.exchange_rate_snapshot = snapshot.exchangeRateSnapshot;
    patch.eur_value_snapshot = snapshot.eurValueSnapshot;
    patch.price_snapshot_at = snapshot.priceSnapshotAt;
  }

  return updateCartItemOptimistic(item.id, item.version, patch);
}

export async function updateCartItemQuantity(
  item: Tables<"cart_items">,
  newQuantity: number,
): Promise<Tables<"cart_items">> {
  const patch: Partial<Tables<"cart_items">> = { quantity: newQuantity };

  // Recompute the snapshot total using the *existing* unit price/rate - a
  // quantity edit alone must not silently refresh the price (that requires
  // the explicit "Preise aktualisieren" action).
  if (item.unit_price_usd_snapshot != null) {
    const totalUsd = Math.round(newQuantity * item.unit_price_usd_snapshot * 100) / 100;
    patch.eur_value_snapshot =
      item.exchange_rate_snapshot != null ? Math.round(totalUsd * item.exchange_rate_snapshot * 100) / 100 : null;
  }

  return updateCartItemOptimistic(item.id, item.version, patch);
}

export async function updateCartItemNote(item: Tables<"cart_items">, note: string): Promise<Tables<"cart_items">> {
  return updateCartItemOptimistic(item.id, item.version, { note: note || null });
}

async function updateCartItemOptimistic(
  id: string,
  expectedVersion: number,
  patch: Partial<Tables<"cart_items">>,
): Promise<Tables<"cart_items">> {
  const { data, error } = await supabase
    .from("cart_items")
    .update(patch)
    .eq("id", id)
    .eq("version", expectedVersion)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ConcurrencyError();
  return data;
}

export async function deleteCartItem(id: string): Promise<void> {
  const { error } = await supabase.from("cart_items").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateCartItem(item: Tables<"cart_items">, nextPosition: number): Promise<Tables<"cart_items">> {
  const { id: _id, version: _version, created_at: _createdAt, updated_at: _updatedAt, ...rest } = item;
  const { data, error } = await supabase
    .from("cart_items")
    .insert({ ...rest, position: nextPosition })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Persist new sort order after a drag-and-drop / move-up/move-down action. */
export async function reorderCartItems(items: { id: string; position: number }[]): Promise<void> {
  await Promise.all(
    items.map(({ id, position }) => supabase.from("cart_items").update({ position }).eq("id", id)),
  );
}

/**
 * Applies the "Preise aktualisieren" action to one item: pulls the current
 * catalog price + current rate and writes a fresh snapshot. Assumes the
 * caller has already shown the preview/confirmation (see
 * src/lib/snapshot.ts buildPriceUpdateDiff).
 */
export async function refreshCartItemPrice(
  item: Tables<"cart_items">,
  currentPriceUsd: number,
  currentRate: number | null,
): Promise<Tables<"cart_items">> {
  const totalUsd = Math.round(item.quantity * currentPriceUsd * 100) / 100;
  const eurValue = currentRate != null ? Math.round(totalUsd * currentRate * 100) / 100 : null;

  return updateCartItemOptimistic(item.id, item.version, {
    unit_price_usd_snapshot: currentPriceUsd,
    exchange_rate_snapshot: currentRate,
    eur_value_snapshot: eurValue,
    price_snapshot_at: new Date().toISOString(),
  });
}

export interface BulkImportLine {
  code: string;
  quantity: number;
}

/**
 * Used by the "paste multiple lines" / Excel-style bulk import flow.
 * Resolves all codes in one batch query, then inserts all rows in one
 * request, keeping the round trips constant instead of O(n) for large
 * pastes.
 */
export async function addCartItemsBulk(
  cartId: string,
  lines: BulkImportLine[],
  startPosition: number,
  currentRate: number | null,
): Promise<Tables<"cart_items">[]> {
  if (lines.length === 0) return [];

  const productMap = await resolveProductsByCodes(lines.map((l) => l.code));

  const rows: Database["public"]["Tables"]["cart_items"]["Insert"][] = lines.map((line, index) => {
    const product = productMap.get(line.code);
    const base: Database["public"]["Tables"]["cart_items"]["Insert"] = {
      cart_id: cartId,
      position: startPosition + index,
      product_code_input: line.code,
      quantity: line.quantity,
      resolution_status: "not_found",
    };

    if (!product) return base;

    const snapshot = buildSnapshot(product, line.quantity, currentRate);
    return {
      ...base,
      product_id: product.id,
      resolution_status: product.is_active ? "resolved" : "inactive",
      product_code_snapshot: snapshot.productCodeSnapshot,
      product_name_snapshot: snapshot.productNameSnapshot,
      unit_price_usd_snapshot: snapshot.unitPriceUsdSnapshot,
      exchange_rate_snapshot: snapshot.exchangeRateSnapshot,
      eur_value_snapshot: snapshot.eurValueSnapshot,
      price_snapshot_at: snapshot.priceSnapshotAt,
    };
  });

  const { data, error } = await supabase.from("cart_items").insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

/**
 * Merges all rows sharing the same product code into the first (lowest
 * position) row by summing quantities, then deletes the rest. This is the
 * explicit, user-triggered counterpart to assumption A3 (duplicates are
 * allowed by default, never silently merged) - see docs/KONZEPT.md §1.
 */
export async function mergeDuplicateCartItems(items: Tables<"cart_items">[]): Promise<void> {
  if (items.length < 2) return;
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const [keep, ...rest] = sorted;
  const totalQuantity = sorted.reduce((sum, i) => sum + i.quantity, 0);

  const patch: Partial<Tables<"cart_items">> = { quantity: totalQuantity };
  if (keep.unit_price_usd_snapshot != null) {
    const totalUsd = Math.round(totalQuantity * keep.unit_price_usd_snapshot * 100) / 100;
    patch.eur_value_snapshot =
      keep.exchange_rate_snapshot != null ? Math.round(totalUsd * keep.exchange_rate_snapshot * 100) / 100 : null;
  }

  const { error: updateError } = await supabase
    .from("cart_items")
    .update(patch)
    .eq("id", keep.id)
    .eq("version", keep.version);
  if (updateError) throw updateError;

  const { error: deleteError } = await supabase
    .from("cart_items")
    .delete()
    .in("id", rest.map((i) => i.id));
  if (deleteError) throw deleteError;
}
