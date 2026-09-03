import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { adminStatusSelectOptions, ORDER_STATUS_LABELS } from "@/services/orders";
import type { OrderStatus } from "@/types/database";

export function OrderStatusSelect({
  value,
  onValueChange,
  disabled,
  className,
}: {
  value: OrderStatus;
  onValueChange: (status: OrderStatus) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next !== value) onValueChange(next as OrderStatus);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label="Bestellstatus"
        className={cn("h-8 min-w-[11rem] text-xs sm:w-52", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {adminStatusSelectOptions(value).map((status) => (
          <SelectItem key={status} value={status}>
            {ORDER_STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
