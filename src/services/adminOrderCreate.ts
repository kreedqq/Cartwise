import { supabase } from "@/lib/supabaseClient";
import type { PaymentMethod } from "@/lib/shop/paymentMethod";
import type { ShippingAddress } from "@/lib/shippingAddress";
import { extractRpcErrorMessage } from "@/services/username";
import type { ShopAreaKey } from "@/lib/shop/shopAreas";
import type { Tables } from "@/types/database";

export interface AdminCustomerCheckoutContext {
  userId: string;
  username: string | null;
  roleName: string | null;
  markupPercent: number;
}

export type AdminOrderCreateLine =
  | {
      kind: "catalog";
      shopArea: ShopAreaKey | string;
      vendorCode: string;
      productId?: string | null;
      quantity: number;
    }
  | { kind: "kit"; kitShareId: string };

export interface AdminOrderPreviewItem {
  kind: "catalog" | "kit";
  shopArea?: string;
  kitShareId?: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPriceUsd: number;
  catalogUnitUsd: number;
  lineTotalUsd: number;
}

export interface AdminOrderPreview {
  customerUserId: string;
  markupPercent: number;
  roleName: string | null;
  items: AdminOrderPreviewItem[];
  totalUsd: number;
}

export interface AdminKitCheckoutOption {
  kitShareId: string;
  shopArea: string;
  status: string;
  kitSizeVials: number;
  participantQuantity: number;
  productName: string;
  productCode: string;
  variantLabel: string;
  checkoutReady: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function adminGetCustomerCheckoutContext(userId: string): Promise<AdminCustomerCheckoutContext> {
  const { data, error } = await supabase.rpc("admin_get_customer_checkout_context", {
    _customer_user_id: userId,
  });
  if (error) throw error;
  const raw = asRecord(data);
  return {
    userId: String(raw.userId),
    username: raw.username != null ? String(raw.username) : null,
    roleName: raw.roleName != null ? String(raw.roleName) : null,
    markupPercent: Number(raw.markupPercent ?? 0),
  };
}

export async function adminListShopProductsForCustomer(
  shopArea: string,
  customerUserId: string,
): Promise<Tables<"products">[]> {
  const { data, error } = await supabase.rpc("admin_list_shop_products_for_customer", {
    _shop_area: shopArea,
    _customer_user_id: customerUserId,
  });
  if (error) throw error;
  return (data ?? []) as Tables<"products">[];
}

export async function adminListCustomerKitCheckoutOptions(
  customerUserId: string,
  shopArea?: string | null,
): Promise<AdminKitCheckoutOption[]> {
  const { data, error } = await supabase.rpc("admin_list_customer_kit_checkout_options", {
    _customer_user_id: customerUserId,
    _shop_area: shopArea ?? null,
  });
  if (error) throw error;
  const raw = asRecord(data);
  const items = Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]) : [];
  return items.map((item) => ({
    kitShareId: String(item.kitShareId),
    shopArea: String(item.shopArea),
    status: String(item.status),
    kitSizeVials: Number(item.kitSizeVials),
    participantQuantity: Number(item.participantQuantity),
    productName: String(item.productName),
    productCode: String(item.productCode),
    variantLabel: String(item.variantLabel),
    checkoutReady: Boolean(item.checkoutReady),
  }));
}

export async function adminPreviewOrderForCustomer(
  customerUserId: string,
  lines: AdminOrderCreateLine[],
): Promise<AdminOrderPreview> {
  const { data, error } = await supabase.rpc("admin_preview_order_for_customer", {
    _customer_user_id: customerUserId,
    _lines: lines,
  });
  if (error) throw error;
  const raw = asRecord(data);
  const items = Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]) : [];
  return {
    customerUserId: String(raw.customerUserId),
    markupPercent: Number(raw.markupPercent ?? 0),
    roleName: raw.roleName != null ? String(raw.roleName) : null,
    items: items.map((item) => ({
      kind: item.kind === "kit" ? "kit" : "catalog",
      shopArea: item.shopArea != null ? String(item.shopArea) : undefined,
      kitShareId: item.kitShareId != null ? String(item.kitShareId) : undefined,
      productCode: String(item.productCode),
      productName: String(item.productName),
      quantity: Number(item.quantity),
      unitPriceUsd: Number(item.unitPriceUsd),
      catalogUnitUsd: Number(item.catalogUnitUsd),
      lineTotalUsd: Number(item.lineTotalUsd),
    })),
    totalUsd: Number(raw.totalUsd ?? 0),
  };
}

export interface AdminCreateOrderForCustomerResult {
  orderId: string;
  orderNumber: string;
  totalUsd: number;
  shopArea?: string;
  customerUserId: string;
}

export async function adminCreateOrderForCustomer(
  customerUserId: string,
  lines: AdminOrderCreateLine[],
  note: string | null,
  paymentMethod: PaymentMethod,
  shipping: ShippingAddress,
): Promise<AdminCreateOrderForCustomerResult> {
  const base = {
    _customer_user_id: customerUserId,
    _lines: lines,
    _note: note,
    _payment_method: paymentMethod,
    _shipping_first_name: shipping.firstName,
    _shipping_last_name: shipping.lastName,
    _shipping_postal_code: shipping.postalCode,
    _shipping_city: shipping.city,
    _shipping_country: shipping.country,
    _shipping_delivery_method: shipping.deliveryMethod,
  };

  const payload =
    shipping.deliveryMethod === "home"
      ? {
          ...base,
          _shipping_street: shipping.street,
          _shipping_house_number: shipping.houseNumber,
          _shipping_address_extra: shipping.addressExtra ?? null,
          _shipping_packstation_number: null,
          _shipping_post_number: null,
        }
      : {
          ...base,
          _shipping_street: null,
          _shipping_house_number: null,
          _shipping_address_extra: null,
          _shipping_packstation_number: shipping.packstationNumber,
          _shipping_post_number: shipping.postNumber,
        };

  const { data, error } = await supabase.rpc("admin_create_order_for_customer", payload);
  if (error) {
    const message = extractRpcErrorMessage(error).trim() || "Bestellung konnte nicht erstellt werden.";
    throw new Error(message);
  }
  const raw = asRecord(data);
  return {
    orderId: String(raw.orderId),
    orderNumber: String(raw.orderNumber),
    totalUsd: Number(raw.totalUsd ?? 0),
    shopArea: raw.shopArea != null ? String(raw.shopArea) : undefined,
    customerUserId: String(raw.customerUserId ?? customerUserId),
  };
}

export function adminOrderCreateRpcErrorMessage(error: unknown, fallback: string): string {
  const extracted = extractRpcErrorMessage(error).trim();
  return extracted || fallback;
}
