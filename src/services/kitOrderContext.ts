import type { KitShareCartLink, KitShareContextKit, KitShareContextParticipant, KitShareOrderContext } from "@/lib/kitOrderSummary";
import { supabase } from "@/lib/supabaseClient";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : String(value ?? "");
}

function readNullableString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function readNumber(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : 0;
}

/** Admin-only: kit identity, participants, and cart links already readable via existing admin SELECT policies. */
export async function listAdminKitOrderContext(): Promise<KitShareOrderContext> {
  const [kitsResult, participantsResult, cartResult, profilesResult] = await Promise.all([
    supabase.from("kit_shares").select("id, product_id, kit_size_vials"),
    supabase.from("kit_share_participants").select("kit_share_id, user_id, quantity, order_id"),
    supabase.from("cart_items").select("cart_id, kit_share_id, product_id, quantity").not("kit_share_id", "is", null),
    supabase.from("profiles").select("id, username"),
  ]);

  if (kitsResult.error) throw kitsResult.error;
  if (participantsResult.error) throw participantsResult.error;
  if (cartResult.error) throw cartResult.error;
  if (profilesResult.error) throw profilesResult.error;

  const kits: KitShareContextKit[] = (kitsResult.data ?? []).flatMap((row) => {
    const record = asRecord(row);
    if (!record) return [];
    const id = readString(record, "id");
    const product_id = readString(record, "product_id");
    if (!id || !product_id) return [];
    return [{ id, product_id, kit_size_vials: readNumber(record, "kit_size_vials") }];
  });

  const participants: KitShareContextParticipant[] = (participantsResult.data ?? []).flatMap((row) => {
    const record = asRecord(row);
    if (!record) return [];
    const kit_share_id = readString(record, "kit_share_id");
    const user_id = readString(record, "user_id");
    if (!kit_share_id || !user_id) return [];
    return [
      {
        kit_share_id,
        user_id,
        quantity: readNumber(record, "quantity"),
        order_id: readNullableString(record, "order_id"),
      },
    ];
  });

  const cartLinks: KitShareCartLink[] = (cartResult.data ?? []).flatMap((row) => {
    const record = asRecord(row);
    if (!record) return [];
    const cart_id = readString(record, "cart_id");
    const kit_share_id = readString(record, "kit_share_id");
    if (!cart_id || !kit_share_id) return [];
    return [
      {
        cart_id,
        kit_share_id,
        product_id: readNullableString(record, "product_id"),
        quantity: readNumber(record, "quantity"),
      },
    ];
  });

  const usernamesByUserId: Record<string, string | null> = {};
  for (const row of profilesResult.data ?? []) {
    const record = asRecord(row);
    if (!record) continue;
    const id = readString(record, "id");
    if (!id) continue;
    usernamesByUserId[id] = readNullableString(record, "username");
  }

  return { kits, participants, cartLinks, usernamesByUserId };
}

/**
 * Kit sizes for items on one order. Uses participant rows with this order_id only.
 * Does not return other customers' names or shares.
 */
export async function listKitSizesForOrder(orderId: string): Promise<Map<string, number>> {
  const { data: parts, error: partsError } = await supabase
    .from("kit_share_participants")
    .select("kit_share_id")
    .eq("order_id", orderId);
  if (partsError) throw partsError;

  const kitIds = [...new Set((parts ?? []).map((row) => row.kit_share_id).filter(Boolean))];
  if (kitIds.length === 0) return new Map();

  const { data: kits, error: kitsError } = await supabase
    .from("kit_shares")
    .select("id, product_id, kit_size_vials")
    .in("id", kitIds);
  if (kitsError) throw kitsError;

  const sizes = new Map<string, number>();
  for (const kit of kits ?? []) {
    const size = readNumber(asRecord(kit) ?? {}, "kit_size_vials");
    if (kit.product_id && size > 0) sizes.set(kit.product_id, size);
  }
  return sizes;
}
