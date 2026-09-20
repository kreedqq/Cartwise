import * as React from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { KitRequestDistributionEditor } from "@/pages/admin/AdminKitRequestDetail";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import {
  useAdminCancelKitRequest,
  useAdminKitRequest,
  useAdminSetKitRequestDistribution,
} from "@/hooks/useAdminKitRequests";
import { formatKitParticipantShare, resolveProductCategoryId } from "@/lib/quantityFormat";
import { formatVendorDosageDisplay } from "@/lib/shop/variantCoverage";
import { adminKitRpcErrorMessage } from "@/services/adminKitRequests";

export function KitRequestAdminManageDialog({
  kitId,
  open,
  onOpenChange,
}: {
  kitId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detailQuery = useAdminKitRequest(open ? kitId ?? undefined : undefined);
  const distributionMutation = useAdminSetKitRequestDistribution();
  const cancelMutation = useAdminCancelKitRequest();
  const [cancelOpen, setCancelOpen] = React.useState(false);

  const detail = detailQuery.data;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(92vh,820px)] overflow-y-auto sm:max-w-2xl">
          {detailQuery.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : detailQuery.isError || !detail ? (
            <ErrorState
              message={adminKitRpcErrorMessage(detailQuery.error, "Kit konnte nicht geladen werden.")}
              onRetry={() => detailQuery.refetch()}
            />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{detail.productName}</DialogTitle>
                <DialogDescription>
                  {formatVendorDosageDisplay(detail.variantLabel, detail.productCode ?? detail.vendorCode ?? "")}
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Fortschritt: {detail.allocatedTotal}/{detail.kitSizeVials} · Status: {detail.status}
              </p>
              <ul className="space-y-1 text-sm">
                {detail.participants.map((p) => (
                  <li key={p.userId}>
                    @{p.username.replace(/^@+/, "")}:{" "}
                    {formatKitParticipantShare(
                      p.quantity,
                      detail.kitSizeVials,
                      resolveProductCategoryId({
                        name: detail.productName,
                        code: detail.productCode ?? undefined,
                        dosageVial: detail.variantLabel,
                      }),
                    )}
                  </li>
                ))}
              </ul>
              <KitRequestDistributionEditor
                detail={detail}
                saving={distributionMutation.isPending}
                onSave={async (rows) => {
                  try {
                    await distributionMutation.mutateAsync({
                      id: detail.id,
                      allocations: rows.map((r) => ({ userId: r.userId, quantity: r.quantity })),
                    });
                    toast.success("Verteilung gespeichert.");
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Verteilung konnte nicht gespeichert werden.",
                    );
                  }
                }}
              />
              {detail.status === "open" || detail.status === "full" ? (
                <Button type="button" variant="destructive" className="mt-2" onClick={() => setCancelOpen(true)}>
                  Gesuch stornieren
                </Button>
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Kit Gesuch stornieren?"
        description="Teilnehmer können danach nicht mehr mitmachen. Bestehende Bestellungen bleiben unverändert."
        confirmLabel="Stornieren"
        variant="destructive"
        onConfirm={async () => {
          if (!detail) return;
          try {
            await cancelMutation.mutateAsync(detail.id);
            toast.success("Kit Gesuch storniert.");
            setCancelOpen(false);
            onOpenChange(false);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Stornierung fehlgeschlagen.");
          }
        }}
      />
    </>
  );
}
