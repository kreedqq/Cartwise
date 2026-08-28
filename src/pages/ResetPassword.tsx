import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { resetPasswordSchema } from "@/lib/validation";
import { mapAuthError, updatePassword } from "@/services/auth";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [form, setForm] = React.useState({ password: "", passwordConfirm: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [hasRecoverySession, setHasRecoverySession] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasRecoverySession(!!data.session));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = resetPasswordSchema.safeParse(form);
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await updatePassword(result.data.password);
      toast.success("Passwort wurde erfolgreich geändert.");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(mapAuthError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      {hasRecoverySession === false && (
        <p className="mb-4 rounded-md bg-warning/10 p-3 text-xs text-warning">
          Dieser Link ist möglicherweise abgelaufen. Falls das Setzen fehlschlägt, fordere bitte einen neuen Link
          unter „Passwort vergessen" an.
        </p>
      )}
      <form className="space-y-3.5" onSubmit={handleSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="password">Neues Passwort</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            invalid={!!errors.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="passwordConfirm">Passwort bestätigen</Label>
          <Input
            id="passwordConfirm"
            type="password"
            autoComplete="new-password"
            value={form.passwordConfirm}
            invalid={!!errors.passwordConfirm}
            onChange={(e) => setForm((f) => ({ ...f, passwordConfirm: e.target.value }))}
          />
          {errors.passwordConfirm && <p className="text-xs text-destructive">{errors.passwordConfirm}</p>}
        </div>
        <Button type="submit" className="w-full" loading={loading}>
          <ShieldCheck /> Passwort speichern
        </Button>
      </form>
    </AuthLayout>
  );
}
