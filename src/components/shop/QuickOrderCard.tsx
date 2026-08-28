import * as React from "react";
import { AlertTriangle, Zap } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useShopCart } from "@/hooks/useShopCart";
import { parsePasteLine } from "@/lib/validation";
import { toast } from "@/components/ui/toaster";

interface QuickOrderCardProps {
  currentRate: number | null;
}

/**
 * "Schnellbestellung" (section 13): one or many "CODE  MENGE" lines, added
 * directly to the active cart in one click - no dialog, matching the shop's
 * "see it, quantify it, add it" flow.
 */
export function QuickOrderCard({ currentRate }: QuickOrderCardProps) {
  const [text, setText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const { addManyToActiveCart } = useShopCart();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const lines = text
      .split("\n")
      .map((l) => parsePasteLine(l))
      .filter((l): l is NonNullable<typeof l> => l !== null);

    if (lines.length === 0) {
      toast.error('Bitte gib mindestens eine Zeile im Format "CODE  MENGE" ein.');
      return;
    }

    const invalid = lines.filter((l) => l.error || !l.code || !l.quantity);
    const valid = lines.filter((l): l is typeof l & { code: string; quantity: number } => !l.error && !!l.code && !!l.quantity);

    if (valid.length === 0) {
      toast.error("Keine der Zeilen enthält einen gültigen Artikelcode mit Menge.");
      return;
    }

    setSubmitting(true);
    try {
      const items = await addManyToActiveCart(
        valid.map((l) => ({ code: l.code, quantity: l.quantity })),
        currentRate,
      );
      const notFound = items.filter((i) => i.resolution_status !== "resolved");
      const added = items.length - notFound.length;

      if (added > 0) {
        toast.success(`${added} Artikel zum Warenkorb hinzugefügt.`);
      }
      if (notFound.length > 0) {
        toast.error(`${notFound.length} Artikelcode(s) nicht gefunden oder deaktiviert.`, {
          description: notFound.map((i) => i.product_code_input).join(", "),
        });
      }
      if (invalid.length > 0) {
        toast.error(`${invalid.length} Zeile(n) konnten nicht gelesen werden.`);
      }
      setText("");
    } catch (error) {
      console.error("Schnellbestellung fehlgeschlagen:", error);
      toast.error("Schnellbestellung konnte nicht hinzugefügt werden.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Zap className="h-4 w-4 text-primary" /> Schnellbestellung
        </CardTitle>
        <CardDescription>
          Ein Artikelcode und eine Menge pro Zeile (z. B. „ART-5001&nbsp;&nbsp;12"), direkt aus Excel kopierbar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={"ART-5001\t12\nART-5002\t5\nART-5018\t20"}
            className="font-mono text-xs"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" /> Ungültige Codes werden nach dem Hinzufügen angezeigt.
            </p>
            <Button type="submit" size="sm" loading={submitting}>
              Alle hinzufügen
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
