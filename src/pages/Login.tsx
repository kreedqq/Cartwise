import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import { useAuth } from "@/context/AuthProvider";
import { loginSchema, magicLinkSchema } from "@/lib/validation";
import { mapAuthError, safePostLoginPath, signIn, signInWithMagicLink } from "@/services/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading } = useAuth();
  const destination = safePostLoginPath(
    location.state && typeof location.state === "object" && "from" in location.state
      ? (location.state as { from: unknown }).from
      : null,
  );
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [awaitingSession, setAwaitingSession] = React.useState(false);
  const [magicSent, setMagicSent] = React.useState(false);

  React.useEffect(() => {
    if (authLoading || !session) return;
    navigate(destination, { replace: true });
  }, [authLoading, session, navigate, destination]);

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await signIn(result.data.email, result.data.password);
      setAwaitingSession(true);
    } catch (error) {
      setAwaitingSession(false);
      toast.error(mapAuthError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleMagic(e: React.FormEvent) {
    e.preventDefault();
    const result = magicLinkSchema.safeParse({ email });
    if (!result.success) {
      setErrors({ email: result.error.issues[0]?.message ?? "Ungültige E-Mail." });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await signInWithMagicLink(result.data.email);
      setMagicSent(true);
    } catch (error) {
      toast.error(mapAuthError(error));
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || session || awaitingSession) {
    return <FullScreenSpinner label="Anmeldung wird abgeschlossen …" />;
  }

  return (
    <AuthLayout>
      <Tabs defaultValue="password">
        <TabsList className="mb-3 grid h-9 w-full grid-cols-2 rounded-[10px] p-1">
          <TabsTrigger value="password" className="rounded-md">
            Passwort
          </TabsTrigger>
          <TabsTrigger value="magic" className="rounded-md">
            Magic Link
          </TabsTrigger>
        </TabsList>

        <TabsContent value="password" className="mt-0">
          <form className="space-y-3" onSubmit={handlePassword} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                invalid={!!errors.email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Passwort</Label>
                <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                  Passwort vergessen?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                invalid={!!errors.password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>
            <Button type="submit" size="lg" className="h-10 w-full rounded-[10px] text-sm" loading={loading}>
              Anmelden
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="magic" className="mt-0">
          {magicSent ? (
            <p className="rounded-xl bg-success/10 px-3 py-3 text-sm text-success">
              Magic Link gesendet. Prüfe dein Postfach.
            </p>
          ) : (
            <form className="space-y-3" onSubmit={handleMagic} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="magic-email">E-Mail-Adresse</Label>
                <Input
                  id="magic-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  invalid={!!errors.email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <Button type="submit" size="lg" className="h-10 w-full rounded-[10px]" loading={loading}>
                Magic Link senden
              </Button>
            </form>
          )}
        </TabsContent>
      </Tabs>

      <div className="mt-4">
        <OAuthButtons />
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Noch kein Konto?{" "}
        <Link to="/register" className="font-semibold text-primary hover:underline">
          Konto erstellen
        </Link>
      </p>
    </AuthLayout>
  );
}
