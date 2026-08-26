import * as React from "react";
import { Link } from "react-router-dom";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { resetPasswordRequestSchema } from "@/lib/validation";
import { requestPasswordReset } from "@/services/auth";
import { AuthLayout, mapAuthError } from "@/pages/Login";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = resetPasswordRequestSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Ungültige Eingabe.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(result.data.email);
      setSent(true);
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
          <CardTitle className="text-xl">Passwort zurücksetzen</CardTitle>
          <CardDescription>
            Gib deine E-Mail-Adresse ein. Wir senden dir einen Link zum Zurücksetzen deines Passworts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="rounded-md bg-success/10 p-4 text-center text-sm text-success">
              Falls ein Konto mit dieser Adresse existiert, wurde eine E-Mail versendet.
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-Mail-Adresse</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  invalid={!!error}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
              <Button type="submit" className="w-full" loading={loading}>
                <KeyRound /> Link senden
              </Button>
            </form>
          )}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-primary hover:underline">
              Zurück zur Anmeldung
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
