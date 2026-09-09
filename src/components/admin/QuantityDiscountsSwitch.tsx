import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useResolvedSiteAccess } from "@/hooks/useAppPublicState";
import { useSetAppSetting } from "@/hooks/useAppSettings";
import { toast } from "@/components/ui/toaster";

export function QuantityDiscountsSwitch() {
  const access = useResolvedSiteAccess();
  const mutation = useSetAppSetting();
  const enabled = access.quantityDiscountsEnabled;

  async function handleChange(next: boolean) {
    try {
      await mutation.mutateAsync({ key: "quantity_discounts_enabled", value: next });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Einstellung konnte nicht gespeichert werden.");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <Label htmlFor="quantity-discounts" className="text-base">
          Mengenrabatte
        </Label>
        <p className="text-sm text-muted-foreground">
          Steuert, ob Mengenstaffeln und Mengenrabatte für Kundenpreise verwendet werden.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{enabled ? "Aktiv" : "Aus"}</span>
        <Switch
          id="quantity-discounts"
          checked={enabled}
          disabled={mutation.isPending || access.isLoading}
          onCheckedChange={(value) => void handleChange(value)}
        />
      </div>
    </div>
  );
}
