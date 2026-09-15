import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import {
  adminCreateOrderForCustomer,
  adminGetCustomerCheckoutContext,
  adminListCustomerKitCheckoutOptions,
  adminListShopProductsForCustomer,
  adminPreviewOrderForCustomer,
  type AdminOrderCreateLine,
} from "@/services/adminOrderCreate";
import type { PaymentMethod } from "@/lib/shop/paymentMethod";
import type { ShippingAddress } from "@/lib/shippingAddress";

export function useAdminCustomerCheckoutContext(customerUserId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCustomerCheckoutContext(customerUserId ?? ""),
    queryFn: () => adminGetCustomerCheckoutContext(customerUserId!),
    enabled: Boolean(customerUserId),
  });
}

export function useAdminShopProductsForCustomer(shopArea: string | null, customerUserId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.adminShopProductsForCustomer(shopArea ?? "", customerUserId ?? ""),
    queryFn: () => adminListShopProductsForCustomer(shopArea!, customerUserId!),
    enabled: Boolean(shopArea && customerUserId),
  });
}

export function useAdminCustomerKitCheckoutOptions(customerUserId: string | null, shopArea?: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.adminCustomerKitCheckoutOptions(customerUserId ?? "", shopArea ?? "all"),
    queryFn: () => adminListCustomerKitCheckoutOptions(customerUserId!, shopArea),
    enabled: Boolean(customerUserId),
  });
}

export function useAdminOrderPreview(customerUserId: string | null, lines: AdminOrderCreateLine[]) {
  return useQuery({
    queryKey: QUERY_KEYS.adminOrderCreatePreview(customerUserId ?? "", lines),
    queryFn: () => adminPreviewOrderForCustomer(customerUserId!, lines),
    enabled: Boolean(customerUserId && lines.length > 0),
  });
}

export function useAdminCreateOrderForCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      customerUserId: string;
      lines: AdminOrderCreateLine[];
      note: string | null;
      paymentMethod: PaymentMethod;
      shipping: ShippingAddress;
    }) =>
      adminCreateOrderForCustomer(
        input.customerUserId,
        input.lines,
        input.note,
        input.paymentMethod,
        input.shipping,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrders });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrderItems });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.auditLogs });
    },
  });
}
