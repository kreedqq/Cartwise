import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { useAuth } from "@/context/AuthProvider";
import {
  createOrder,
  deleteOrder,
  getAdminOrderWithItems,
  getMyOrderWithItems,
  getOrderAdminNote,
  listMyOrders,
  listMyOrderStatusHistory,
  listOrderStatusHistory,
  setOrderStatus,
} from "@/services/orders";
import type { PaymentMethod } from "@/lib/shop/paymentMethod";
import type { ShippingAddress } from "@/lib/shippingAddress";
import type { OrderStatus } from "@/types/database";

const MY_ORDERS_ROOT = ["my-orders"] as const;

export function useMyOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: QUERY_KEYS.myOrders(user?.id ?? ""),
    queryFn: listMyOrders,
    enabled: Boolean(user?.id),
  });
}

/** Customer order detail. Never shares the admin inbox query. */
export function useMyOrder(orderId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: QUERY_KEYS.myOrder(user?.id ?? "", orderId ?? ""),
    queryFn: () => getMyOrderWithItems(orderId as string),
    enabled: Boolean(orderId) && Boolean(user?.id),
  });
}

/** Admin inbox detail. Caller must sit behind AdminRoute. */
export function useAdminOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.order(orderId ?? ""),
    queryFn: () => getAdminOrderWithItems(orderId as string),
    enabled: Boolean(orderId),
  });
}

export function useMyOrderStatusHistory(orderId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_KEYS.myOrder(user?.id ?? "", orderId ?? ""), "history"],
    queryFn: () => listMyOrderStatusHistory(orderId as string),
    enabled: Boolean(orderId) && Boolean(user?.id),
  });
}

export function useOrderStatusHistory(orderId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.orderStatusHistory(orderId ?? ""),
    queryFn: () => listOrderStatusHistory(orderId as string),
    enabled: !!orderId,
  });
}

export function useOrderAdminNote(orderId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.orderAdminNote(orderId ?? ""),
    queryFn: () => getOrderAdminNote(orderId as string),
    enabled: !!orderId,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({
      cartId,
      note,
      paymentMethod,
      shipping,
    }: {
      cartId: string;
      note: string | null;
      paymentMethod: PaymentMethod;
      shipping: ShippingAddress;
    }) => createOrder(cartId, note, paymentMethod, shipping),
    onSuccess: (_result, { cartId }) => {
      queryClient.invalidateQueries({ queryKey: MY_ORDERS_ROOT });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrders });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminKitOrderContext });
      if (user) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.carts(user.id) });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cartSummaries(user.id) });
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cartItems(cartId) });
    },
  });
}

export function useSetOrderStatus(orderId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      status,
      adminNote,
      orderId: id,
    }: {
      status: OrderStatus;
      adminNote?: string | null;
      orderId?: string;
    }) => {
      const target = id ?? orderId;
      if (!target) throw new Error("Bestellung wurde nicht gefunden.");
      return setOrderStatus(target, status, adminNote);
    },
    onSuccess: (_data, vars) => {
      const target = vars.orderId ?? orderId ?? "";
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.order(target) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orderStatusHistory(target) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrders });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrderItems });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminKitOrderContext });
      queryClient.invalidateQueries({ queryKey: MY_ORDERS_ROOT });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orderAdminNote(target) });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => deleteOrder(orderId),
    onSuccess: (_void, orderId) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.order(orderId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrders });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrderItems });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminKitOrderContext });
      queryClient.invalidateQueries({ queryKey: MY_ORDERS_ROOT });
    },
  });
}
