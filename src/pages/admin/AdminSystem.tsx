import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { EmergencyMaintenanceButton } from "@/components/admin/EmergencyMaintenanceButton";
import { QuantityDiscountsSwitch } from "@/components/admin/QuantityDiscountsSwitch";
import { useResolvedSiteAccess } from "@/hooks/useAppPublicState";

export default function AdminSystemPage() {
  const access = useResolvedSiteAccess();

  return (
    <div className="space-y-4">
      <AdminPageHeader
        section="System & Sicherheit"
        subsection="Wartung"
        title="Wartung steuern"
        description="Wartungsmodus und globale Shop-Schalter. Secrets und API-Keys werden hier nicht angezeigt."
      />

      <AdminSection title="Wartungsmodus" padded>
        <p className="mb-3 text-sm text-muted-foreground">
          Im Wartungsmodus sehen Nicht-Admins die Wartungsseite. Admins bleiben im Backoffice.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <EmergencyMaintenanceButton />
          <span className="text-sm text-muted-foreground">
            Status: {access.maintenanceMode ? "Aktiv" : "Aus"}
          </span>
        </div>
      </AdminSection>

      <AdminSection title="Shop-Schalter" padded>
        <QuantityDiscountsSwitch />
      </AdminSection>
    </div>
  );
}
