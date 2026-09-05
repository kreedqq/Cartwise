import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { useUpsertOrderProgress } from "@/hooks/useOrderProgress";
import {
  SHIPPING_PROGRESS_STATUSES,
  isShippingProgressStatusKey,
  shippingProgressWritePayload,
} from "@/lib/orderProgress";
import { cn } from "@/lib/utils";

export function ShippingProgressSelect({
  orderId,
  storedStatusKey,
  disabled = false,
  className,
}: {
  orderId: string;
  storedStatusKey: string | null | undefined;
  disabled?: boolean;
  className?: string;
}) {
  const saveProgress = useUpsertOrderProgress(orderId);
  const selected = isShippingProgressStatusKey(storedStatusKey) ? storedStatusKey : undefined;
  const busy = saveProgress.isPending;

  async function handleChange(value: string) {
    if (!isShippingProgressStatusKey(value) || busy || value === selected) return;
    try {
      await saveProgress.mutateAsync(shippingProgressWritePayload(value));
    } catch (error) {
      console.error("Versandstatus speichern fehlgeschlagen:", error);
      toast.error(error instanceof Error ? error.message : "Versandstatus konnte nicht gespeichert werden.");
    }
  }

  return (
    <Select
      value={selected ?? ""}
      onValueChange={(value) => void handleChange(value)}
      disabled={disabled || busy}
    >
      <SelectTrigger
        className={cn("h-9 min-w-0 text-left text-xs", className)}
        aria-label="Versandstatus"
        aria-busy={busy}
      >
        <SelectValue placeholder={busy ? "Wird gespeichert …" : "Status wählen"} />
      </SelectTrigger>
      <SelectContent>
        {SHIPPING_PROGRESS_STATUSES.map((status) => (
          <SelectItem key={status.key} value={status.key}>
            {status.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
