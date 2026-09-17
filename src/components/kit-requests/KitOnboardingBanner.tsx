import * as React from "react";
import { TrendingDown, Users, X, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "peptix-kit-onboarding-v1";

/** Returns true if the user has already dismissed the banner in this browser. */
function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // ignore storage errors
  }
}

/**
 * First-time explainer banner for the Kit Marketplace.
 *
 * Shown only when:
 * - The current user can use Kit Requests (role gate already passed).
 * - The user has no existing kit participations (they are genuinely new to Kits).
 * - The user has not already dismissed this banner.
 *
 * Dismissed permanently via localStorage (survives page reload, not cross-device).
 */
export function KitOnboardingBanner({
  hasExistingKitActivity,
}: {
  /** True if the user already owns or participates in at least one kit. */
  hasExistingKitActivity: boolean;
}) {
  const [dismissed, setDismissed] = React.useState<boolean>(wasDismissed);

  if (dismissed || hasExistingKitActivity) return null;

  function handleDismiss() {
    markDismissed();
    setDismissed(true);
  }

  return (
    <div className="relative rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 sm:p-5">
      {/* Dismiss button */}
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Erklärung schließen"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Heading */}
      <div className="mb-3 pr-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/70">
          Was ist ein Kit?
        </p>
        <p className="mt-0.5 text-sm font-medium leading-snug text-foreground">
          Mehrere Kunden teilen sich ein Gebinde — du zahlst nur deinen Anteil.
        </p>
      </div>

      {/* Three key points */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <KitFeature
          icon={Users}
          title="Gemeinsam bestellen"
          description="Schließe dich offenen Kits an oder erstelle ein eigenes Gesuch."
        />
        <KitFeature
          icon={TrendingDown}
          title="Günstiger einkaufen"
          description="Mengenpreise durch geteilte Bestellungen — ohne alleine alles kaufen zu müssen."
        />
        <KitFeature
          icon={Zap}
          title="Automatische Freigabe"
          description="Ist das Kit voll, wird deine Bestellung automatisch synchronisiert."
        />
      </div>

      {/* Dismiss CTA */}
      <div className="mt-4 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="h-8 gap-1.5 text-xs text-primary hover:bg-primary/10 hover:text-primary"
        >
          Verstanden
        </Button>
      </div>
    </div>
  );
}

function KitFeature({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div>
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
