import * as React from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useResolvedSiteAccess } from "@/hooks/useAppPublicState";
import { useSetAppSetting } from "@/hooks/useAppSettings";
import { toast } from "@/components/ui/toaster";

export function EmergencyMaintenanceButton() {
  const access = useResolvedSiteAccess();
  const mutation = useSetAppSetting();
  const [confirmEnable, setConfirmEnable] = React.useState(false);
  const [confirmDisable, setConfirmDisable] = React.useState(false);

  async function setMaintenance(value: boolean) {
    try {
      await mutation.mutateAsync({ key: "maintenance_mode", value });
      toast.success(value ? "Notfallmodus ist aktiv." : "Wartung wurde beendet.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Status konnte nicht geändert werden.");
    } finally {
      setConfirmEnable(false);
      setConfirmDisable(false);
    }
  }

  return (
    <>
      {access.maintenanceMode ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-destructive px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-destructive-foreground">
            🔴 Notfallmodus aktiv
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDisable(true)}>
            Maintenance deaktivieren
          </Button>
        </div>
      ) : (
        <Button type="button" variant="destructive" size="sm" className="font-semibold tracking-wide" onClick={() => setConfirmEnable(true)}>
          NOTFALL
        </Button>
      )}

      <ConfirmDialog
        open={confirmEnable}
        onOpenChange={setConfirmEnable}
        title="Notfallmodus aktivieren?"
        description="Die Website wird für alle normalen Nutzer vorübergehend deaktiviert. Nur Administratoren behalten Zugriff."
        confirmLabel="Maintenance aktivieren"
        cancelLabel="Abbrechen"
        variant="destructive"
        loading={mutation.isPending}
        onConfirm={() => setMaintenance(true)}
      />
      <ConfirmDialog
        open={confirmDisable}
        onOpenChange={setConfirmDisable}
        title="Maintenance deaktivieren?"
        description="Normale Nutzer können die Website danach wieder verwenden."
        confirmLabel="Maintenance deaktivieren"
        cancelLabel="Abbrechen"
        loading={mutation.isPending}
        onConfirm={() => setMaintenance(false)}
      />
    </>
  );
}
