import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { registerSchema } from "@/lib/validation";
import { signUp } from "@/services/auth";
import { AuthLayout, mapAuthError } from "@/pages/Login";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = React.useState({ email: "", password: "", passwordConfirm: "", displayName: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = registerSchema.safeParse(form);
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { session } = await signUp(result.data.email, result.data.password, result.data.displayName);
      if (session) {
        // Email confirmation is disabled on this project - the user is signed in immediately.
        navigate("/dashboard", { replace: true });
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
        <Card className="w-full max-w-sm">
          <CardHeader className="items-center text-center">
            <CardTitle>Fast geschafft</CardTitle>
            <CardDescription>
              Wir haben dir eine Bestätigungs-E-Mail an <strong>{form.email}</strong> gesendet. Bitte bestätige
              deine Adresse, um dich anzumelden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" variant="outline">
              <Link to="/login">Zur Anmeldung</Link>
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <CardTitle className="text-xl">Konto erstellen</CardTitle>
          <CardDescription>Lege ein neues Konto an, um Warenkörbe zu verwalten.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Anzeigename</Label>
              <Input
                id="displayName"
                autoComplete="name"
                value={form.displayName}
                invalid={!!errors.displayName}
                onChange={(e) => update("displayName", e.target.value)}
              />
              {errors.displayName && <p className="text-xs text-destructive">{errors.displayName}</p>}
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
            <Button type="submit" className="w-full" loading={loading}>
              <UserPlus /> Registrieren
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Bereits ein Konto?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Jetzt anmelden
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
