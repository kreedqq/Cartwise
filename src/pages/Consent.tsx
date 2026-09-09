import * as React from "react";
import { useNavigate } from "react-router-dom";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { useAuth } from "@/context/AuthProvider";
import { useAcceptResearchConsent, useResearchConsent } from "@/hooks/useConsents";
import { RESEARCH_CONSENT_TEXT } from "@/lib/consent";
import { POST_LOGIN_PATH, signOut } from "@/services/auth";

export default function ConsentPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const consentQuery = useResearchConsent();
  const acceptMutation = useAcceptResearchConsent();
  const [checked, setChecked] = React.useState(false);

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (consentQuery.data === true) {
      navigate(POST_LOGIN_PATH, { replace: true });
    }
  }, [loading, user, consentQuery.data, navigate]);

  async function handleConfirm() {
    if (!checked) return;
    try {
      await acceptMutation.mutateAsync();
      navigate(POST_LOGIN_PATH, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Zustimmung konnte nicht gespeichert werden.");
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  if (loading || consentQuery.isLoading || !user || consentQuery.data === true) {
    return <FullScreenSpinner />;
  }

  return (
    <AuthLayout>
      <div className="flex flex-1 flex-col gap-5">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">PEPTIX</p>
          <h1 className="text-lg font-semibold">Bevor du weitermachst</h1>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{RESEARCH_CONSENT_TEXT}</p>
        <div className="flex items-start gap-3 rounded-lg border border-border p-3">
          <Checkbox
            id="research-consent"
            checked={checked}
            onCheckedChange={(value) => setChecked(value === true)}
            className="mt-0.5 h-5 w-5"
          />
          <Label htmlFor="research-consent" className="text-sm leading-relaxed">
            Ich bestätige diese Erklärung.
          </Label>
        </div>
        <Button type="button" size="lg" className="h-11 w-full" disabled={!checked} loading={acceptMutation.isPending} onClick={() => void handleConfirm()}>
          Bestätigen und fortfahren
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => void handleSignOut()}>
          Abmelden
        </Button>
      </div>
    </AuthLayout>
  );
}
