import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { maintenanceArtLayout } from "@/lib/maintenanceArt";

import "./maintenanceScreen.css";

interface MaintenanceScreenProps {
  allowAdminLogin?: boolean;
  onAdminLogin?: () => void;
}

function readViewport() {
  const viewport = window.visualViewport;
  return {
    width: Math.round(viewport?.width ?? window.innerWidth),
    height: Math.round(viewport?.height ?? window.innerHeight),
  };
}

export function MaintenanceScreen({
  allowAdminLogin = false,
  onAdminLogin,
}: MaintenanceScreenProps) {
  const [viewport, setViewport] = useState(readViewport);
  const layout = maintenanceArtLayout(viewport.width, viewport.height);

  useEffect(() => {
    const sync = () => setViewport(readViewport());
    sync();
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
    };
  }, []);

  return (
    <div className="cw-maint">
      <div className="cw-maint__stage">
        <div
          className="cw-maint__ambience"
          aria-hidden="true"
          data-active={layout.useAmbience ? "true" : "false"}
          style={{ backgroundImage: `url(${layout.ambienceSrc})` }}
        />
        <div
          className="cw-maint__art"
          role="img"
          aria-label="Peptix"
          data-mode={layout.mode}
          style={{
            backgroundImage: `url(${layout.src})`,
            backgroundSize: layout.backgroundSize,
            backgroundPosition: layout.backgroundPosition,
          }}
        />
      </div>
      {allowAdminLogin && onAdminLogin ? (
        <Button type="button" variant="ghost" className="sr-only" onClick={onAdminLogin}>
          Admin
        </Button>
      ) : null}
    </div>
  );
}
