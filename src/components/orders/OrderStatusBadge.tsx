import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS } from "@/services/orders";
import type { OrderStatus } from "@/types/database";

const VARIANTS: Record<OrderStatus, "warning" | "default" | "success" | "secondary" | "destructive"> = {
  pending: "warning",
  processing: "default",
  dispatched: "default",
  received: "default",
  shipped: "success",
  completed: "secondary",
  confirmed: "success",
  cancelled: "destructive",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={VARIANTS[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}
