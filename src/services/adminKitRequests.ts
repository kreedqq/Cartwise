import { parseKitReconcileReport, type KitReconcileReport } from "@/lib/kit/kitReconciliation";
import { supabase } from "@/lib/supabaseClient";
import { extractRpcErrorMessage } from "@/services/username";

export type { KitReconcileReport };

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
  orderSyncLabel: string | null;
  orderSyncSyncedCount: number;
  orderSyncParticipantCount: number;
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
  orderSyncStatus?: Record<string, unknown> | null;
}

export interface AdminKitRequestDetail extends AdminKitRequestListItem {
  participants: AdminKitRequestParticipant[];
  anyParticipantOrdered: boolean;
  cartLineCount: number;
  orderSync: Record<string, unknown> | null;
  canEditMeta: boolean;
  canEditQuantities: boolean;
  canEditDistribution: boolean;
  canCancel: boolean;
  canDelete: boolean;
  canChangeProduct: boolean;
  customerMutationLocked: boolean;
  customerLockReason: "full" | "partial_order" | "ordered" | null;
}

export interface AdminKitUserSearchHit {
  userId: string;
  username: string;
}

export interface AdminKitDistributionAllocation {
  userId: string;
  quantity: number;
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
    orderSyncLabel: raw.orderSyncLabel == null ? null : String(raw.orderSyncLabel),
    orderSyncSyncedCount: Number(raw.orderSyncSyncedCount ?? 0),
    orderSyncParticipantCount: Number(raw.orderSyncParticipantCount ?? 0),
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
    orderSyncStatus:
      raw.orderSyncStatus && typeof raw.orderSyncStatus === "object" && !Array.isArray(raw.orderSyncStatus)
        ? (raw.orderSyncStatus as Record<string, unknown>)
        : null,
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
    orderSync:
      raw.orderSync && typeof raw.orderSync === "object" && !Array.isArray(raw.orderSync)
        ? (raw.orderSync as Record<string, unknown>)
        : null,
    canEditMeta: Boolean(raw.canEditMeta),
    canEditQuantities: Boolean(raw.canEditQuantities),
    canEditDistribution: Boolean(raw.canEditDistribution ?? raw.canEditQuantities),
    canCancel: Boolean(raw.canCancel),
    canDelete: Boolean(raw.canDelete),
    canChangeProduct: Boolean(raw.canChangeProduct),
    customerMutationLocked: Boolean(raw.customerMutationLocked),
    customerLockReason:
      raw.customerLockReason === "full" ||
      raw.customerLockReason === "partial_order" ||
      raw.customerLockReason === "ordered"
        ? raw.customerLockReason
        : null,
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

export async function adminSetKitRequestDistribution(input: {
  id: string;
  allocations: AdminKitDistributionAllocation[];
}): Promise<AdminKitRequestDetail> {
  const { data, error } = await supabase.rpc("admin_set_kit_request_distribution", {
    _kit_share_id: input.id,
    _allocations: input.allocations.map((row) => ({
      userId: row.userId,
      quantity: row.quantity,
    })),
  });
  if (error) throw error;
  return mapDetail(asRecord(data));
}

export async function adminSearchKitRequestUsers(query: string): Promise<AdminKitUserSearchHit[]> {
  const { data, error } = await supabase.rpc("admin_search_kit_request_users", {
    _query: query,
    _limit: 20,
  });
  if (error) throw error;
  const raw = asRecord(data);
  const items = Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]) : [];
  return items.map((item) => ({
    userId: String(item.userId),
    username: String(item.username ?? ""),
  }));
}

export async function adminSyncKitFullOrders(id: string): Promise<AdminKitRequestDetail> {
  const { data, error } = await supabase.rpc("admin_sync_kit_full_orders", { _kit_share_id: id });
  if (error) throw error;
  void data;
  return adminGetKitRequest(id);
}

export async function adminDeleteKitRequest(id: string): Promise<{ deleted: boolean; id: string }> {
  const { data, error } = await supabase.rpc("admin_delete_kit_request", { _kit_share_id: id });
  if (error) throw error;
  const raw = asRecord(data);
  return { deleted: Boolean(raw.deleted), id: String(raw.id ?? id) };
}

export async function adminGetKitReconcileReport(kitShareId: string): Promise<KitReconcileReport> {
  const { data, error } = await supabase.rpc("kit_share_reconcile_report", { _kit_share_id: kitShareId });
  if (error) throw error;
  return parseKitReconcileReport(data);
}

export function adminKitRpcErrorMessage(error: unknown, fallback: string): string {
  const extracted = extractRpcErrorMessage(error).trim();
  return extracted || fallback;
}
