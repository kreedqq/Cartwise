import { supabase } from "@/lib/supabaseClient";
import type { PaymentMethod } from "@/lib/shop/paymentMethod";

export interface KitShareParticipantView {
  isSelf: boolean;
  displayName: string;
  quantity: number;
  /** Present only when the viewer is the kit creator (for distribution editing). */
  userId?: string;
}

export interface KitShareView {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  kitSizeVials: number;
  status: "open" | "full" | "cancelled" | "ordered";
  allocatedTotal: number;
  remainingVials: number;
  myQuantity: number;
  myPriceUsd: number;
  canAddToCart: boolean;
  participants: KitShareParticipantView[];
}

function mapKitShareView(raw: Record<string, unknown>): KitShareView {
  const participants = Array.isArray(raw.participants)
    ? (raw.participants as Record<string, unknown>[]).map((p) => ({
        isSelf: Boolean(p.isSelf),
        displayName: String(p.displayName ?? "Teilnehmer"),
        quantity: Number(p.quantity ?? 0),
        userId: p.userId != null ? String(p.userId) : undefined,
      }))
    : [];

  return {
    id: String(raw.id),
    productId: String(raw.productId),
    productName: String(raw.productName),
    productCode: String(raw.productCode),
    kitSizeVials: Number(raw.kitSizeVials),
    status: String(raw.status) as KitShareView["status"],
    allocatedTotal: Number(raw.allocatedTotal),
    remainingVials: Number(raw.remainingVials),
    myQuantity: Number(raw.myQuantity),
    myPriceUsd: Number(raw.myPriceUsd),
    canAddToCart: Boolean(raw.canAddToCart),
    participants,
  };
}

export async function createKitShare(
  productId: string,
  kitSizeVials: number,
  myQuantity: number,
): Promise<KitShareView> {
  const { data, error } = await supabase.rpc("create_kit_share", {
    _product_id: productId,
    _kit_size_vials: kitSizeVials,
    _my_quantity: myQuantity,
  });
  if (error) throw error;
  return mapKitShareView(data as Record<string, unknown>);
}

export async function inviteKitShareParticipant(
  kitShareId: string,
  participantUserId: string,
  quantity: number,
): Promise<KitShareView> {
  const { data, error } = await supabase.rpc("invite_kit_share_participant", {
    _kit_share_id: kitShareId,
    _participant_user_id: participantUserId,
    _quantity: quantity,
  });
  if (error) throw error;
  return mapKitShareView(data as Record<string, unknown>);
}

export async function updateKitShareQuantity(kitShareId: string, quantity: number): Promise<KitShareView> {
  const { data, error } = await supabase.rpc("update_kit_share_quantity", {
    _kit_share_id: kitShareId,
    _quantity: quantity,
  });
  if (error) throw error;
  return mapKitShareView(data as Record<string, unknown>);
}

export async function updateKitShareDistribution(
  kitShareId: string,
  distribution: { userId: string; quantity: number }[],
): Promise<KitShareView> {
  const { data, error } = await supabase.rpc("update_kit_share_distribution", {
    _kit_share_id: kitShareId,
    _distribution: distribution,
  });
  if (error) throw error;
  return mapKitShareView(data as Record<string, unknown>);
}

export async function getMyKitShare(kitShareId: string): Promise<KitShareView> {
  const { data, error } = await supabase.rpc("get_my_kit_share", { _kit_share_id: kitShareId });
  if (error) throw error;
  return mapKitShareView(data as Record<string, unknown>);
}

export async function addKitShareToCart(kitShareId: string): Promise<string> {
  const { data, error } = await supabase.rpc("add_kit_share_to_cart", { _kit_share_id: kitShareId });
  if (error) throw error;
  return String(data);
}

export async function cancelKitShare(kitShareId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_kit_share", { _kit_share_id: kitShareId });
  if (error) throw error;
}

/** Ensures participant payloads never expose foreign prices (defense in depth). */
export function assertKitSharePricePrivacy(view: KitShareView): void {
  const payload = JSON.stringify(view);
  if (payload.includes("participant") && /participant.*[Pp]rice/i.test(payload)) {
    throw new Error("Kit-Share-Antwort enthält unzulässige Preisfelder.");
  }
  for (const key of Object.keys(view as unknown as Record<string, unknown>)) {
    if (/price/i.test(key) && key !== "myPriceUsd") {
      throw new Error(`Unzulässiges Preisfeld in Kit-Share-Antwort: ${key}`);
    }
  }
  for (const participant of view.participants) {
    for (const key of Object.keys(participant)) {
      if (/price/i.test(key)) {
        throw new Error("Teilnehmerdaten dürfen keine Preise enthalten.");
      }
    }
  }
}

export type { PaymentMethod };
