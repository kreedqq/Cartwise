import { Button } from "@/components/ui/button";

const MAINTENANCE_ART = "/maintenance-pause.jpg";

interface MaintenanceScreenProps {
  allowAdminLogin?: boolean;
  onAdminLogin?: () => void;
}

export function MaintenanceScreen({
  allowAdminLogin = false,
  onAdminLogin,
}: MaintenanceScreenProps) {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-black">
      <div
        className="pointer-events-none fixed inset-0 h-[100dvh] w-screen bg-black bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${MAINTENANCE_ART})` }}
        role="img"
        aria-label="Peptix"
      />
      {allowAdminLogin && onAdminLogin ? (
        <Button type="button" variant="ghost" className="sr-only" onClick={onAdminLogin}>
          Admin
        </Button>
      ) : null}
    </div>
  );
}
