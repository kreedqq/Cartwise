import { supabase } from "@/lib/supabaseClient";
import { assertKitRequestPricePrivacy } from "@/lib/kitRequests";

export interface KitRequestParticipantView {
  isSelf: boolean;
  username: string;
  quantity: number;
}

export interface KitRequestCard {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  variantLabel: string;
  category: string;
  creatorUsername: string;
  kitSizeVials: number;
  allocatedTotal: number;
  remainingVials: number;
  creatorQuantity: number;
  myQuantity: number;
  myUnitPriceUsd: number | null;
  myPriceUsd: number | null;
  isCreator: boolean;
  isParticipant: boolean;
  status: "open" | "full" | "cancelled" | "expired" | "ordered";
  createdAt: string;
  expiresAt: string | null;
  completedAt: string | null;
  note: string | null;
  participants?: KitRequestParticipantView[];
  cartSynced?: boolean;
}

export interface KitRequestListPage {
  items: KitRequestCard[];
  total: number;
  page: number;
  pageSize: number;
}

export interface KitRequestJoinResult {
  success: boolean;
  kitRequestId: string;
  myQuantity: number;
  remainingQuantity: number;
  status: KitRequestCard["status"];
  myPriceUsd: number | null;
  myUnitPriceUsd: number | null;
  cartSynced: boolean;
}

export interface KitRequestJoinPreview {
  kitRequestId: string;
  myQuantity: number;
  remainingQuantity: number;
  remainingAfterJoin: number;
  status: KitRequestCard["status"];
  myPriceUsd: number;
  myUnitPriceUsd: number | null;
}

export interface ListOpenKitRequestsParams {
  search?: string | null;
  category?: string | null;
  productId?: string | null;
  productName?: string | null;
  variant?: string | null;
  minRemaining?: number | null;
  sort?: "newest" | "fewest_remaining" | "most_remaining";
  page?: number;
  pageSize?: number;
}

function mapParticipant(raw: Record<string, unknown>): KitRequestParticipantView {
  return {
    isSelf: Boolean(raw.isSelf),
    username: String(raw.username ?? "Teilnehmer"),
    quantity: Number(raw.quantity ?? 0),
  };
}

export function mapKitRequestCard(raw: Record<string, unknown>): KitRequestCard {
  assertKitRequestPricePrivacy(raw);

  const participants = Array.isArray(raw.participants)
    ? (raw.participants as Record<string, unknown>[]).map(mapParticipant)
    : undefined;

  return {
    id: String(raw.id),
    productId: String(raw.productId),
    productName: String(raw.productName),
    productCode: String(raw.productCode),
    variantLabel: String(raw.variantLabel ?? raw.productCode ?? ""),
    category: String(raw.category ?? ""),
    creatorUsername: String(raw.creatorUsername ?? "Teilnehmer"),
    kitSizeVials: Number(raw.kitSizeVials ?? 0),
    allocatedTotal: Number(raw.allocatedTotal ?? 0),
    remainingVials: Number(raw.remainingVials ?? 0),
    creatorQuantity: Number(raw.creatorQuantity ?? 0),
    myQuantity: Number(raw.myQuantity ?? 0),
    myUnitPriceUsd: raw.myUnitPriceUsd == null ? null : Number(raw.myUnitPriceUsd),
    myPriceUsd: raw.myPriceUsd == null ? null : Number(raw.myPriceUsd),
    isCreator: Boolean(raw.isCreator),
    isParticipant: Boolean(raw.isParticipant),
    status: String(raw.status) as KitRequestCard["status"],
    createdAt: String(raw.createdAt ?? ""),
    expiresAt: raw.expiresAt == null ? null : String(raw.expiresAt),
    completedAt: raw.completedAt == null ? null : String(raw.completedAt),
    note: raw.note == null ? null : String(raw.note),
    participants,
    cartSynced: raw.cartSynced == null ? undefined : Boolean(raw.cartSynced),
  };
}

function asRecord(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Ungültige Serverantwort.");
  }
  return data as Record<string, unknown>;
}

export async function listOpenKitRequests(params: ListOpenKitRequestsParams = {}): Promise<KitRequestListPage> {
  const { data, error } = await supabase.rpc("list_open_kit_requests", {
    _search: params.search ?? null,
    _category: params.category ?? null,
    _product_id: params.productId ?? null,
    _product_name: params.productName ?? null,
    _variant: params.variant ?? null,
    _min_remaining: params.minRemaining ?? null,
    _sort: params.sort ?? "newest",
    _page: params.page ?? 1,
    _page_size: params.pageSize ?? 20,
  });
  if (error) throw error;
  const raw = asRecord(data);
  const items = Array.isArray(raw.items)
    ? (raw.items as Record<string, unknown>[]).map(mapKitRequestCard)
    : [];
  return {
    items,
    total: Number(raw.total ?? 0),
    page: Number(raw.page ?? 1),
    pageSize: Number(raw.pageSize ?? 20),
  };
}

export async function listMyKitRequests(): Promise<KitRequestCard[]> {
  const { data, error } = await supabase.rpc("list_my_kit_requests");
  if (error) throw error;
  const raw = asRecord(data);
  return Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]).map(mapKitRequestCard) : [];
}

export async function listMyKitRequestParticipations(): Promise<KitRequestCard[]> {
  const { data, error } = await supabase.rpc("list_my_kit_request_participations");
  if (error) throw error;
  const raw = asRecord(data);
  return Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]).map(mapKitRequestCard) : [];
}

export async function getKitRequest(id: string): Promise<KitRequestCard> {
  const { data, error } = await supabase.rpc("get_kit_request", { _kit_share_id: id });
  if (error) throw error;
  return mapKitRequestCard(asRecord(data));
}

export async function createKitRequest(input: {
  productId: string;
  kitSizeVials: number;
  myQuantity: number;
  note?: string | null;
  expiresAt?: string | null;
}): Promise<KitRequestCard> {
  const { data, error } = await supabase.rpc("create_kit_request", {
    _product_id: input.productId,
    _kit_size_vials: input.kitSizeVials,
    _my_quantity: input.myQuantity,
    _note: input.note ?? null,
    _expires_at: input.expiresAt ?? null,
  });
  if (error) throw error;
  return mapKitRequestCard(asRecord(data));
}

export async function previewKitRequestJoin(id: string, quantity: number): Promise<KitRequestJoinPreview> {
  const { data, error } = await supabase.rpc("preview_kit_request_join", {
    _kit_share_id: id,
    _quantity: quantity,
  });
  if (error) throw error;
  const raw = asRecord(data);
  assertKitRequestPricePrivacy(raw);
  return {
    kitRequestId: String(raw.kitRequestId),
    myQuantity: Number(raw.myQuantity),
    remainingQuantity: Number(raw.remainingQuantity),
    remainingAfterJoin: Number(raw.remainingAfterJoin),
    status: String(raw.status) as KitRequestCard["status"],
    myPriceUsd: Number(raw.myPriceUsd),
    myUnitPriceUsd: raw.myUnitPriceUsd == null ? null : Number(raw.myUnitPriceUsd),
  };
}

export async function joinKitRequest(id: string, quantity: number): Promise<KitRequestJoinResult> {
  const { data, error } = await supabase.rpc("join_kit_request", {
    _kit_share_id: id,
    _quantity: quantity,
  });
  if (error) throw error;
  const raw = asRecord(data);
  assertKitRequestPricePrivacy(raw);
  return {
    success: Boolean(raw.success),
    kitRequestId: String(raw.kitRequestId),
    myQuantity: Number(raw.myQuantity),
    remainingQuantity: Number(raw.remainingQuantity),
    status: String(raw.status) as KitRequestCard["status"],
    myPriceUsd: raw.myPriceUsd == null ? null : Number(raw.myPriceUsd),
    myUnitPriceUsd: raw.myUnitPriceUsd == null ? null : Number(raw.myUnitPriceUsd),
    cartSynced: Boolean(raw.cartSynced),
  };
}

export async function leaveKitRequest(id: string): Promise<KitRequestCard> {
  const { data, error } = await supabase.rpc("leave_kit_request", { _kit_share_id: id });
  if (error) throw error;
  return mapKitRequestCard(asRecord(data));
}

export async function cancelKitRequest(id: string): Promise<KitRequestCard> {
  const { data, error } = await supabase.rpc("cancel_kit_request", { _kit_share_id: id });
  if (error) throw error;
  return mapKitRequestCard(asRecord(data));
}

export async function syncCompletedKitRequestCarts(id: string): Promise<KitRequestJoinResult> {
  const { data, error } = await supabase.rpc("sync_completed_kit_request_carts", { _kit_share_id: id });
  if (error) throw error;
  const raw = asRecord(data);
  assertKitRequestPricePrivacy(raw);
  return {
    success: Boolean(raw.success),
    kitRequestId: String(raw.kitRequestId),
    myQuantity: 0,
    remainingQuantity: 0,
    status: String(raw.status) as KitRequestCard["status"],
    myPriceUsd: raw.myPriceUsd == null ? null : Number(raw.myPriceUsd),
    myUnitPriceUsd: null,
    cartSynced: Boolean(raw.cartSynced),
  };
}
