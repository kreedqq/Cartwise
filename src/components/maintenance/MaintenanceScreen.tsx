const ARTWORK_SRC = "/maintenance-pause.jpg";

interface MaintenanceScreenProps {
  allowAdminLogin?: boolean;
  onAdminLogin?: () => void;
}

export function MaintenanceScreen({ allowAdminLogin = false, onAdminLogin }: MaintenanceScreenProps) {
  return (
    <div className="relative flex min-h-[100dvh] w-full overflow-x-hidden bg-background text-foreground">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1400px] flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            PEPTIX
          </p>
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:tracking-[0.16em]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-pulse" aria-hidden="true" />
            <span>Wartungsarbeiten laufen...</span>
          </p>
        </header>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-4 py-4 sm:gap-6 lg:gap-8">
          <img
            src={ARTWORK_SRC}
            alt="KURZE PAUSE! Wir schrauben gerade an etwas Besserem für euch!"
            width={1600}
            height={900}
            decoding="async"
            draggable={false}
            className="h-auto w-full max-h-[min(58dvh,720px)] min-w-0 max-w-6xl rounded-lg object-contain sm:max-h-[min(68dvh,820px)] lg:max-h-[min(74dvh,880px)]"
          />

          <div className="max-w-xl animate-[fade-in_0.5s_ease-out] space-y-2 px-1 text-center sm:space-y-3">
            <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">
              PEPTIX macht gerade kurz Pause.
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Wir arbeiten gerade an technischen Verbesserungen und sind in Kürze wieder für euch da.
            </p>
            <p className="text-sm text-muted-foreground/80">Vielen Dank für eure Geduld.</p>
          </div>
        </main>

        {allowAdminLogin && onAdminLogin ? (
          <footer className="flex shrink-0 justify-end">
            <button
              type="button"
              onClick={onAdminLogin}
              className="text-[11px] text-muted-foreground/50 underline-offset-4 transition-colors hover:text-muted-foreground hover:underline"
            >
              Admin
            </button>
          </footer>
        ) : (
          <div className="h-5 shrink-0" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
