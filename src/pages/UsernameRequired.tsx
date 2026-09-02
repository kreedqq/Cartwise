import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { RequireUsernameForm } from "@/components/auth/RequireUsernameDialog";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthProvider";
import { safePostLoginPath, signOut } from "@/services/auth";
import { shouldPromptForUsername } from "@/services/username";

function returnPathFromState(state: unknown): string {
  if (state && typeof state === "object" && "from" in state) {
    return safePostLoginPath((state as { from: unknown }).from);
  }
  return safePostLoginPath(null);
}

export default function UsernameRequiredPage() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const needsUsername = shouldPromptForUsername({ loading, user, profile });
  const destination = returnPathFromState(location.state);

  React.useEffect(() => {
    if (loading) return;
    if (!needsUsername) {
      navigate(destination, { replace: true });
    }
  }, [loading, needsUsername, destination, navigate]);

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  if (loading || !needsUsername) return <FullScreenSpinner />;

  return (
    <AuthLayout>
      <div className="flex flex-1 flex-col gap-5">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">PEPTIX</p>
          <h1 className="text-lg font-semibold">Telegram Benutzername erforderlich</h1>
          <p className="text-sm text-muted-foreground">
            Bitte trag deinen Telegram Benutzernamen ein bzw. bestätige ihn, bevor du PEPTIX weiter nutzen kannst.
          </p>
        </div>
        <RequireUsernameForm onSaved={() => navigate(destination, { replace: true })} />
        <Button type="button" variant="ghost" className="w-full" onClick={() => void handleSignOut()}>
          Abmelden
        </Button>
      </div>
    </AuthLayout>
  );
}
