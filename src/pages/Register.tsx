import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { registerSchema } from "@/lib/validation";
import { mapAuthError, POST_LOGIN_PATH, signUp } from "@/services/auth";
import { claimUsername, mapUsernameError } from "@/services/username";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = React.useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    password: "",
    passwordConfirm: "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = registerSchema.safeParse({
      email: form.email,
      password: form.password,
      passwordConfirm: form.passwordConfirm,
      displayName: `${form.firstName} ${form.lastName}`.trim(),
      username: form.username,
    });
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { session } = await signUp(
        result.data.email,
        result.data.password,
        result.data.displayName,
        result.data.username,
      );
      if (session) {
        // Best effort: claim the chosen username right away when a session
        // is available immediately (email confirmation disabled). If this
        // fails (e.g. a race on a rare duplicate), the user is prompted to
        // choose a username on next login via <RequireUsernameDialog>.
        try {
          await claimUsername(result.data.username);
        } catch (usernameError) {
          toast.error(mapUsernameError(usernameError));
        }
        navigate(POST_LOGIN_PATH, { replace: true });
      } else {
        setDone(true);
      }
    } catch (error) {
      toast.error(mapAuthError(error));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthLayout>
        <p className="text-sm leading-relaxed text-foreground">
          Wir haben dir eine Bestätigungs-E-Mail an <strong>{form.email}</strong> gesendet. Bitte bestätige deine
          Adresse, um dich anzumelden.
        </p>
        <Button asChild className="mt-5 w-full" variant="outline">
          <Link to="/login">Zur Anmeldung</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form className="space-y-3" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">Vorname</Label>
            <Input
              id="firstName"
              autoComplete="given-name"
              value={form.firstName}
              invalid={!!errors.displayName}
              onChange={(e) => update("firstName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Nachname</Label>
            <Input
              id="lastName"
              autoComplete="family-name"
              value={form.lastName}
              invalid={!!errors.displayName}
              onChange={(e) => update("lastName", e.target.value)}
            />
          </div>
        </div>
        {errors.displayName && <p className="text-xs text-destructive">{errors.displayName}</p>}
        <div className="space-y-1.5">
          <Label htmlFor="username">Telegram Benutzername</Label>
          <Input
            id="username"
            autoComplete="username"
            placeholder="ExampleUser"
            value={form.username}
            invalid={!!errors.username}
            onChange={(e) => update("username", e.target.value)}
          />
          {errors.username ? (
            <p className="text-xs text-destructive">{errors.username}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              3–24 Zeichen. Das ist deine öffentliche Identität beim Kit Sharing (nie deine E-Mail).
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-Mail-Adresse</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            invalid={!!errors.email}
            onChange={(e) => update("email", e.target.value)}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Passwort</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            invalid={!!errors.password}
            onChange={(e) => update("password", e.target.value)}
          />
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Mindestens 8 Zeichen, mit Buchstabe und Zahl.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="passwordConfirm">Passwort bestätigen</Label>
          <Input
            id="passwordConfirm"
            type="password"
            autoComplete="new-password"
            value={form.passwordConfirm}
            invalid={!!errors.passwordConfirm}
            onChange={(e) => update("passwordConfirm", e.target.value)}
          />
          {errors.passwordConfirm && <p className="text-xs text-destructive">{errors.passwordConfirm}</p>}
        </div>
        <Button type="submit" size="lg" className="h-10 w-full rounded-[10px]" loading={loading}>
          <UserPlus /> Konto erstellen
        </Button>
      </form>

      <div className="mt-4">
        <OAuthButtons />
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Bereits ein Konto?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Jetzt anmelden
        </Link>
      </p>
    </AuthLayout>
  );
}
