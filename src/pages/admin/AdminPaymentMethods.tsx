import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ErrorState } from "@/components/common/ErrorState";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { useAppPublicState } from "@/hooks/useAppPublicState";
import { useSetAppSetting } from "@/hooks/useAppSettings";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_SETTING_KEYS,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/shop/paymentMethod";

export default function AdminPaymentMethodsPage() {
  const siteQuery = useAppPublicState();
  const saveMutation = useSetAppSetting();
  const flags = siteQuery.data?.paymentMethodFlags ?? null;

  async function handleToggle(method: PaymentMethod, enabled: boolean) {
    try {
      await saveMutation.mutateAsync({
        key: PAYMENT_METHOD_SETTING_KEYS[method],
        value: enabled,
      });
      toast.success(`${PAYMENT_METHOD_LABELS[method]} ${enabled ? "aktiviert" : "deaktiviert"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Einstellung konnte nicht gespeichert werden.");
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Zahlungsmethoden"
        description="Lege fest, welche Zahlungsmethoden Kunden im Checkout auswählen können."
      />

      {siteQuery.isLoading ? <Skeleton className="h-40 w-full rounded-xl" /> : null}
      {siteQuery.isError ? (
        <ErrorState
          message="Zahlungsmethoden konnten nicht geladen werden."
          onRetry={() => void siteQuery.refetch()}
        />
      ) : null}

      {!siteQuery.isLoading && !siteQuery.isError && flags == null ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Zahlungsmethoden-Einstellungen sind noch nicht verfügbar.
        </p>
      ) : null}

      {flags ? (
        <div className="space-y-3">
          {PAYMENT_METHODS.map((method) => {
            const enabled = flags[method];
            return (
              <div
                key={method}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div>
                  <p className="font-medium">{PAYMENT_METHOD_LABELS[method]}</p>
                  <p className="text-sm text-muted-foreground">{enabled ? "Aktiv" : "Deaktiviert"}</p>
                </div>
                <Switch
                  checked={enabled}
                  disabled={saveMutation.isPending}
                  onCheckedChange={(next) => void handleToggle(method, next)}
                  aria-label={`${PAYMENT_METHOD_LABELS[method]} ${enabled ? "deaktivieren" : "aktivieren"}`}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
