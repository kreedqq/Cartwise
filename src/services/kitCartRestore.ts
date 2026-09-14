import { supabase } from "@/lib/supabaseClient";

export async function restoreKitShareCartLine(
  kitShareId: string,
  participantUserId: string,
): Promise<{ restored?: boolean; alreadyInCart?: boolean; cartItemId?: string }> {
  const { data, error } = await supabase.rpc("restore_kit_share_cart_line", {
    _kit_share_id: kitShareId,
    _participant_user_id: participantUserId,
  });
  if (error) throw error;
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return {
    restored: record.restored === true,
    alreadyInCart: record.alreadyInCart === true,
    cartItemId: typeof record.cartItemId === "string" ? record.cartItemId : undefined,
  };
}
