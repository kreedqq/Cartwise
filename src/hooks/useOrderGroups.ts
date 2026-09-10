import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants";
import {
  assignOrdersToGroup,
  createOrderGroup,
  deleteOrderGroup,
  listOrderGroupMemberships,
  listOrderGroups,
  removeOrdersFromGroup,
  updateOrderGroup,
} from "@/services/orderGroups";

export function useOrderGroups() {
  return useQuery({ queryKey: QUERY_KEYS.adminOrderGroups, queryFn: listOrderGroups });
}

export function useOrderGroupMemberships() {
  return useQuery({ queryKey: QUERY_KEYS.adminOrderGroupOrders, queryFn: listOrderGroupMemberships });
}

function useInvalidateOrderGroups() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrderGroups });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrderGroupOrders });
  };
}

export function useCreateOrderGroup() {
  const invalidate = useInvalidateOrderGroups();
  return useMutation({
    mutationFn: createOrderGroup,
    onSuccess: invalidate,
  });
}

export function useUpdateOrderGroup() {
  const invalidate = useInvalidateOrderGroups();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name?: string; note?: string | null; archived?: boolean } }) =>
      updateOrderGroup(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteOrderGroup() {
  const invalidate = useInvalidateOrderGroups();
  return useMutation({
    mutationFn: deleteOrderGroup,
    onSuccess: invalidate,
  });
}

export function useAssignOrdersToGroup() {
  const invalidate = useInvalidateOrderGroups();
  return useMutation({
    mutationFn: ({ groupId, orderIds }: { groupId: string; orderIds: string[] }) =>
      assignOrdersToGroup(groupId, orderIds),
    onSuccess: invalidate,
  });
}

export function useRemoveOrdersFromGroup() {
  const invalidate = useInvalidateOrderGroups();
  return useMutation({
    mutationFn: removeOrdersFromGroup,
    onSuccess: invalidate,
  });
}
