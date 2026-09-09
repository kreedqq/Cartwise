const ARTWORK_SRC = "/maintenance-pause.jpg";

interface MaintenanceScreenProps {
  allowAdminLogin?: boolean;
  onAdminLogin?: () => void;
}

export function MaintenanceScreen({ allowAdminLogin = false, onAdminLogin }: MaintenanceScreenProps) {
  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-x-hidden bg-background">
      <img
        src={ARTWORK_SRC}
        alt="KURZE PAUSE! Wir schrauben gerade an etwas Besserem für euch!"
        width={1024}
        height={576}
        decoding="async"
        draggable={false}
        className="h-auto w-full max-w-[1200px] object-contain"
      />
      {allowAdminLogin && onAdminLogin ? (
        <button type="button" onClick={onAdminLogin} className="sr-only">
          Admin
        </button>
      ) : null}
    </div>
  );
}
