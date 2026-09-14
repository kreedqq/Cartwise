import { supabase } from "@/lib/supabaseClient";
import { extractRpcErrorMessage } from "@/services/username";

export type AdminKitRequestStatus = "open" | "full" | "cancelled" | "expired" | "ordered";

export interface AdminKitRequestListItem {
  id: string;
  productId: string | null;
  productName: string;
  productCode: string | null;
  variantLabel: string;
  category: string;
  kitSizeVials: number;
  allocatedTotal: number;
  remainingVials: number;
  status: AdminKitRequestStatus;
  creatorUsername: string;
  participantCount: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  completedAt: string | null;
  note: string | null;
  shopArea: string;
  vendorCode: string | null;
  areaProductId: string | null;
  masterProductId: string | null;
}

export interface AdminKitRequestParticipant {
  userId: string;
  username: string;
  quantity: number;
  joinedAt: string;
  updatedAt: string;
  hasOrdered: boolean;
  orderedAt: string | null;
  orderId: string | null;
  isCreator: boolean;
  hasCartItem: boolean;
}

export interface AdminKitRequestDetail extends AdminKitRequestListItem {
  participants: AdminKitRequestParticipant[];
  anyParticipantOrdered: boolean;
  cartLineCount: number;
  canEditMeta: boolean;
  canEditQuantities: boolean;
  canCancel: boolean;
  canChangeProduct: boolean;
}

export interface AdminKitRequestListPage {
  items: AdminKitRequestListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export type AdminKitRequestStatusFilter =
  | "all"
  | "open"
  | "almost_full"
  | "full"
  | "cancelled"
  | "expired"
  | "ordered";

function asRecord(data: unknown): Record<string, unknown> {
  let value: unknown = data;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      throw new Error("Ungültige Serverantwort.");
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Ungültige Serverantwort.");
  }
  return value as Record<string, unknown>;
}

function mapListItem(raw: Record<string, unknown>): AdminKitRequestListItem {
  return {
    id: String(raw.id),
    productId: raw.productId == null ? null : String(raw.productId),
    productName: String(raw.productName ?? "Unbekannt"),
    productCode: raw.productCode == null ? null : String(raw.productCode),
    variantLabel: String(raw.variantLabel ?? raw.productCode ?? ""),
    category: String(raw.category ?? ""),
    kitSizeVials: Number(raw.kitSizeVials ?? 0),
    allocatedTotal: Number(raw.allocatedTotal ?? 0),
    remainingVials: Number(raw.remainingVials ?? 0),
    status: String(raw.status) as AdminKitRequestStatus,
    creatorUsername: String(raw.creatorUsername ?? "Teilnehmer"),
    participantCount: Number(raw.participantCount ?? 0),
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
    expiresAt: raw.expiresAt == null ? null : String(raw.expiresAt),
    completedAt: raw.completedAt == null ? null : String(raw.completedAt),
    note: raw.note == null ? null : String(raw.note),
    shopArea: String(raw.shopArea ?? ""),
    vendorCode: raw.vendorCode == null ? null : String(raw.vendorCode),
    areaProductId: raw.areaProductId == null ? null : String(raw.areaProductId),
    masterProductId: raw.masterProductId == null ? null : String(raw.masterProductId),
  };
}

function mapParticipant(raw: Record<string, unknown>): AdminKitRequestParticipant {
  return {
    userId: String(raw.userId),
    username: String(raw.username ?? "Teilnehmer"),
    quantity: Number(raw.quantity ?? 0),
    joinedAt: String(raw.joinedAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
    hasOrdered: Boolean(raw.hasOrdered),
    orderedAt: raw.orderedAt == null ? null : String(raw.orderedAt),
    orderId: raw.orderId == null ? null : String(raw.orderId),
    isCreator: Boolean(raw.isCreator),
    hasCartItem: Boolean(raw.hasCartItem),
  };
}

function mapDetail(raw: Record<string, unknown>): AdminKitRequestDetail {
  const base = mapListItem(raw);
  const participants = Array.isArray(raw.participants)
    ? (raw.participants as Record<string, unknown>[]).map(mapParticipant)
    : [];
  return {
    ...base,
    participants,
    anyParticipantOrdered: Boolean(raw.anyParticipantOrdered),
    cartLineCount: Number(raw.cartLineCount ?? 0),
    canEditMeta: Boolean(raw.canEditMeta),
    canEditQuantities: Boolean(raw.canEditQuantities),
    canCancel: Boolean(raw.canCancel),
    canChangeProduct: Boolean(raw.canChangeProduct),
  };
}

export async function adminListKitRequests(params: {
  status?: AdminKitRequestStatusFilter | null;
  shopArea?: string | null;
  search?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<AdminKitRequestListPage> {
  const { data, error } = await supabase.rpc("admin_list_kit_requests", {
    _status: params.status && params.status !== "all" ? params.status : null,
    _shop_area: params.shopArea ?? null,
    _search: params.search ?? null,
    _page: params.page ?? 1,
    _page_size: params.pageSize ?? 30,
  });
  if (error) throw error;
  const raw = asRecord(data);
  const items = Array.isArray(raw.items)
    ? (raw.items as Record<string, unknown>[]).map(mapListItem)
    : [];
  return {
    items,
    total: Number(raw.total ?? 0),
    page: Number(raw.page ?? 1),
    pageSize: Number(raw.pageSize ?? 30),
  };
}

export async function adminGetKitRequest(id: string): Promise<AdminKitRequestDetail> {
  const { data, error } = await supabase.rpc("admin_get_kit_request", { _kit_share_id: id });
  if (error) throw error;
  return mapDetail(asRecord(data));
}

export async function adminUpdateKitRequestMeta(input: {
  id: string;
  note?: string | null;
  expiresAt?: string | null;
  clearExpiresAt?: boolean;
  kitSizeVials?: number | null;
}): Promise<AdminKitRequestDetail> {
  const { data, error } = await supabase.rpc("admin_update_kit_request_meta", {
    _kit_share_id: input.id,
    _note: input.note === undefined ? null : input.note,
    _expires_at: input.expiresAt ?? null,
    _kit_size_vials: input.kitSizeVials ?? null,
    _clear_expires_at: input.clearExpiresAt ?? false,
  });
  if (error) throw error;
  return mapDetail(asRecord(data));
}

export async function adminUpdateKitRequestParticipantQuantity(input: {
  id: string;
  participantUserId: string;
  quantity: number;
}): Promise<AdminKitRequestDetail> {
  const { data, error } = await supabase.rpc("admin_update_kit_request_participant_quantity", {
    _kit_share_id: input.id,
    _participant_user_id: input.participantUserId,
    _quantity: input.quantity,
  });
  if (error) throw error;
  return mapDetail(asRecord(data));
}

export async function adminCancelKitRequest(id: string): Promise<AdminKitRequestDetail> {
  const { data, error } = await supabase.rpc("admin_cancel_kit_request", { _kit_share_id: id });
  if (error) throw error;
  return mapDetail(asRecord(data));
}

export function adminKitRpcErrorMessage(error: unknown, fallback: string): string {
  const extracted = extractRpcErrorMessage(error).trim();
  return extracted || fallback;
}
