import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import { useAuth } from "@/context/AuthProvider";
import {
  createOrder,
  deleteOrder,
  getOrderAdminNote,
  getOrderWithItems,
  listMyOrders,
  listOrderStatusHistory,
  setOrderStatus,
} from "@/services/orders";
import type { PaymentMethod } from "@/lib/shop/paymentMethod";
import type { OrderStatus } from "@/types/database";

export function useMyOrders() {
  return useQuery({ queryKey: QUERY_KEYS.myOrders, queryFn: listMyOrders });
}

export function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.order(orderId ?? ""),
    queryFn: () => getOrderWithItems(orderId as string),
    enabled: !!orderId,
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
    }: {
      cartId: string;
      note: string | null;
      paymentMethod: PaymentMethod;
    }) => createOrder(cartId, note, paymentMethod),
    onSuccess: (_result, { cartId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myOrders });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrders });
      if (user) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.carts(user.id) });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cartSummaries(user.id) });
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cartItems(cartId) });
    },
  });
}

export function useSetOrderStatus(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ status, adminNote }: { status: OrderStatus; adminNote?: string | null }) =>
      setOrderStatus(orderId, status, adminNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.order(orderId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orderStatusHistory(orderId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrders });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myOrders });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orderAdminNote(orderId) });
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
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myOrders });
      queryClient.invalidateQueries({ queryKey: ["admin-order-items"] });
    },
  });
}
