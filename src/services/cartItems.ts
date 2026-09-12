import { supabase } from "@/lib/supabaseClient";
import { ConcurrencyError } from "@/lib/errors";
import {
  buildSnapshot,
  repriceForQuantity,
  snapshotToColumns,
  CLEARED_PRICE_COLUMNS,
  type SnapshotSourceProduct,
} from "@/lib/snapshot";
import { DEFAULT_SHOP_AREA, isShopAreaKey, type ShopAreaKey } from "@/lib/shop/shopAreas";
import { resolveProductByCode, resolveProductsByCodes } from "@/services/products";
import { getCart } from "@/services/carts";
import type { Database, Tables } from "@/types/database";

export async function listCartItems(cartId: string): Promise<Tables<"cart_items">[]> {
  const { error: syncError } = await supabase.rpc("sync_cart_selling_prices", { _cart_id: cartId });
  if (syncError) throw syncError;

  const { data, error } = await supabase
    .from("cart_items")
    .select("*")
    .eq("cart_id", cartId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function shopAreaForCart(cartId: string, preferred?: ShopAreaKey | null): Promise<ShopAreaKey> {
  if (preferred && isShopAreaKey(preferred)) return preferred;
  const cart = await getCart(cartId);
  return isShopAreaKey(cart?.shop_area) ? cart.shop_area : DEFAULT_SHOP_AREA;
}

async function syncCartPrices(cartId: string) {
  const { error } = await supabase.rpc("sync_cart_selling_prices", { _cart_id: cartId });
  if (error) throw error;
}

/**
 * Adds a new line item: resolves the product code against the catalog and,
 * if found, writes an immediate price snapshot (see docs/KONZEPT.md §5).
 * The unit price is picked by quantity via getEffectiveUnitPrice, so a line
 * added with 10 units already carries the bulk price.
 */
export async function addCartItem(
  cartId: string,
  productCodeInput: string,
  quantity: number,
  nextPosition: number,
  currentRate: number | null,
  shopAreaKey?: ShopAreaKey | null,
): Promise<Tables<"cart_items">> {
  const shopArea = await shopAreaForCart(cartId, shopAreaKey);
  const resolution = await resolveProductByCode(productCodeInput, shopArea);

  const base = {
    cart_id: cartId,
    position: nextPosition,
    product_code_input: productCodeInput,
    quantity,
    shop_area: shopArea,
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
  const { data: master } = await supabase.from("products").select("id").eq("id", product.id).maybeSingle();

  const { data, error } = await supabase
    .from("cart_items")
    .insert({
      ...base,
      product_id: master?.id ?? null,
      vendor_code: product.code,
      product_code_snapshot: snapshot.productCodeSnapshot,
      product_name_snapshot: snapshot.productNameSnapshot,
      ...snapshotToColumns(snapshot),
      resolution_status: resolution.status === "inactive" ? "inactive" : "resolved",
    })
    .select()
    .single();
  if (error) throw error;
  await syncCartPrices(cartId);
  const { data: synced, error: reloadError } = await supabase.from("cart_items").select("*").eq("id", data.id).single();
  if (reloadError) throw reloadError;
  return synced;
}

/** Re-resolves the product code for an existing row (e.g. after the user edits the code inline). */
export async function reresolveCartItemCode(
  item: Tables<"cart_items">,
  newCode: string,
  currentRate: number | null,
): Promise<Tables<"cart_items">> {
  const shopArea = await shopAreaForCart(item.cart_id, isShopAreaKey(item.shop_area) ? item.shop_area : null);
  const resolution = await resolveProductByCode(newCode, shopArea);
  const patch: Partial<Tables<"cart_items">> = { product_code_input: newCode };

  if (resolution.status === "not_found") {
    patch.product_id = null;
    patch.resolution_status = "not_found";
    patch.product_code_snapshot = null;
    patch.product_name_snapshot = null;
    Object.assign(patch, CLEARED_PRICE_COLUMNS);
  } else {
    const product = resolution.product!;
    // A new code means a new price structure, so the tier is re-selected for
    // the quantity this line already has.
    const snapshot = buildSnapshot(product, item.quantity, currentRate);
    const { data: master } = await supabase.from("products").select("id").eq("id", product.id).maybeSingle();
    patch.product_id = master?.id ?? null;
    patch.vendor_code = product.code;
    patch.resolution_status = resolution.status === "inactive" ? "inactive" : "resolved";
    patch.product_code_snapshot = snapshot.productCodeSnapshot;
    patch.product_name_snapshot = snapshot.productNameSnapshot;
    Object.assign(patch, snapshotToColumns(snapshot));
  }

  return updateCartItemOptimistic(item.id, item.version, patch);
}

/**
 * Changes the quantity of a line and re-selects the price tier from the price
 * structure frozen on that line.
 *
 * This is what makes 7 x 60 = 420 turn into 12 x 55 = 660 when the quantity is
 * raised past the bulk threshold - and back to 60 when it drops below it. The
 * tier is re-read from the *snapshot*, never from today's catalog, so a
 * quantity edit still cannot silently import a newer catalog price (that
 * remains the job of the explicit "Preise aktualisieren" action).
 */
export async function updateCartItemQuantity(
  item: Tables<"cart_items">,
  newQuantity: number,
): Promise<Tables<"cart_items">> {
  const patch: Partial<Tables<"cart_items">> = { quantity: newQuantity };
  Object.assign(patch, repriceForQuantity(item, newQuantity) ?? {});

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
 * catalog price structure + current rate and writes a fresh snapshot, with
 * the tier resolved for this line's quantity. Assumes the caller has already
 * shown the preview/confirmation (see src/lib/snapshot.ts buildPriceUpdateDiff).
 */
export async function refreshCartItemPrice(
  item: Tables<"cart_items">,
  product: SnapshotSourceProduct,
  currentRate: number | null,
): Promise<Tables<"cart_items">> {
  const snapshot = buildSnapshot(product, item.quantity, currentRate);
  return updateCartItemOptimistic(item.id, item.version, snapshotToColumns(snapshot));
}

export interface BulkImportLine {
  code: string;
  quantity: number;
}

/**
 * Used by the "paste multiple lines" / Excel-style bulk import flow.
 * Resolves all codes in one batch query, then inserts all rows in one
 * request, keeping the round trips constant instead of O(n) for large
 * pastes. Each line gets its own tier decision based on its own quantity.
 */
export async function addCartItemsBulk(
  cartId: string,
  lines: BulkImportLine[],
  startPosition: number,
  currentRate: number | null,
  shopAreaKey?: ShopAreaKey | null,
): Promise<Tables<"cart_items">[]> {
  if (lines.length === 0) return [];

  const shopArea = await shopAreaForCart(cartId, shopAreaKey);
  const productMap = await resolveProductsByCodes(
    lines.map((l) => l.code),
    shopArea,
  );
  const catalogIds = Array.from(new Set([...productMap.values()].map((product) => product.id).filter(Boolean)));
  const masterIds = new Set<string>();
  if (catalogIds.length > 0) {
    const { data: masters } = await supabase.from("products").select("id").in("id", catalogIds);
    for (const row of masters ?? []) masterIds.add(row.id);
  }

  const rows: Database["public"]["Tables"]["cart_items"]["Insert"][] = lines.map((line, index) => {
    const product = productMap.get(line.code);
    const base: Database["public"]["Tables"]["cart_items"]["Insert"] = {
      cart_id: cartId,
      position: startPosition + index,
      product_code_input: line.code,
      quantity: line.quantity,
      resolution_status: "not_found",
      shop_area: shopArea,
    };

    if (!product) return base;

    const snapshot = buildSnapshot(product, line.quantity, currentRate);
    return {
      ...base,
      product_id: masterIds.has(product.id) ? product.id : null,
      vendor_code: product.code,
      resolution_status: product.is_active ? "resolved" : "inactive",
      product_code_snapshot: snapshot.productCodeSnapshot,
      product_name_snapshot: snapshot.productNameSnapshot,
      ...snapshotToColumns(snapshot),
    };
  });

  const { data, error } = await supabase.from("cart_items").insert(rows).select();
  if (error) throw error;
  await syncCartPrices(cartId);
  const { data: synced, error: reloadError } = await supabase
    .from("cart_items")
    .select("*")
    .eq("cart_id", cartId)
    .order("position", { ascending: true });
  if (reloadError) throw reloadError;
  const insertedIds = new Set((data ?? []).map((row) => row.id));
  return (synced ?? []).filter((row) => insertedIds.has(row.id));
}

/**
 * Merges all rows sharing the same product code into the first (lowest
 * position) row by summing quantities, then deletes the rest. This is the
 * explicit, user-triggered counterpart to assumption A3 (duplicates are
 * allowed by default, never silently merged) - see docs/KONZEPT.md §1.
 *
 * The merged quantity can cross a bulk threshold that none of the individual
 * lines reached (5 + 7 = 12), so the surviving line is repriced just like a
 * manual quantity edit.
 */
export async function mergeDuplicateCartItems(items: Tables<"cart_items">[]): Promise<void> {
  if (items.length < 2) return;
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const [keep, ...rest] = sorted;
  const totalQuantity = sorted.reduce((sum, i) => sum + i.quantity, 0);

  const patch: Partial<Tables<"cart_items">> = { quantity: totalQuantity };
  Object.assign(patch, repriceForQuantity(keep, totalQuantity) ?? {});

  // Must go through the same optimistic-locking check as every other write:
  // without .select().maybeSingle() here, a concurrent edit to `keep` between
  // load and merge would silently match zero rows (no error!), and the
  // duplicate rows below would still be deleted - losing their quantity
  // entirely instead of folding it into `keep`.
  await updateCartItemOptimistic(keep.id, keep.version, patch);

  const { error: deleteError } = await supabase
    .from("cart_items")
    .delete()
    .in("id", rest.map((i) => i.id));
  if (deleteError) throw deleteError;
}
