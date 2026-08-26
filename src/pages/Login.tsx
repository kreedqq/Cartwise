import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogIn, ShoppingCart, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import { loginSchema, magicLinkSchema } from "@/lib/validation";
import { signIn, signInWithMagicLink } from "@/services/auth";
import { APP_NAME } from "@/lib/constants";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname ?? "/dashboard";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [magicSent, setMagicSent] = React.useState(false);

  async function handlePasswordLogin(e: React.FormEvent) {
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
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(mapAuthError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    const result = magicLinkSchema.safeParse({ email });
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message])));
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

  return (
    <AuthLayout>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl">Willkommen zurück</CardTitle>
          <CardDescription>Melde dich an, um deine Warenkörbe zu verwalten.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="password">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password">Passwort</TabsTrigger>
              <TabsTrigger value="magic">Magic Link</TabsTrigger>
            </TabsList>

            <TabsContent value="password">
              <form className="space-y-4" onSubmit={handlePasswordLogin} noValidate>
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Passwort</Label>
                    <Link to="/forgot-password" className="text-xs text-primary hover:underline">
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
                <Button type="submit" className="w-full" loading={loading}>
                  <LogIn /> Anmelden
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="magic">
              {magicSent ? (
                <div className="rounded-md bg-success/10 p-4 text-sm text-success">
                  Wir haben dir einen Anmeldelink an <strong>{email}</strong> gesendet. Bitte prüfe dein Postfach.
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleMagicLink} noValidate>
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
                  <Button type="submit" variant="outline" className="w-full" loading={loading}>
                    <Sparkles /> Anmeldelink senden
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Noch kein Konto?{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Jetzt registrieren
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-secondary/40 to-background px-4 py-10">
      <div className="flex w-full flex-col items-center gap-6">
        <p className="text-sm font-medium text-muted-foreground">{APP_NAME}</p>
        {children}
      </div>
    </div>
  );
}

export function mapAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes("invalid login credentials")) {
    return "E-Mail-Adresse oder Passwort ist falsch.";
  }
  if (message.toLowerCase().includes("email not confirmed")) {
    return "Bitte bestätige zuerst deine E-Mail-Adresse (siehe Posteingang).";
  }
  if (message.toLowerCase().includes("user already registered")) {
    return "Für diese E-Mail-Adresse existiert bereits ein Konto.";
  }
  if (message.toLowerCase().includes("failed to fetch")) {
    return "Verbindung zum Server fehlgeschlagen. Bitte prüfe deine Internetverbindung.";
  }
  return "Etwas ist schiefgelaufen. Bitte versuche es erneut.";
}
