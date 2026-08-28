import { Trash2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOrderTemplates, useOrderTemplateMutations } from "@/hooks/useOrderTemplates";
import { useShopCart } from "@/hooks/useShopCart";
import { toast } from "@/components/ui/toaster";

interface OrderTemplatesCardProps {
  currentRate: number | null;
}

export function OrderTemplatesCard({ currentRate }: OrderTemplatesCardProps) {
  const templatesQuery = useOrderTemplates();
  const mutations = useOrderTemplateMutations();
  const { addManyToActiveCart } = useShopCart();

  if (!templatesQuery.data || templatesQuery.data.length === 0) return null;

  async function handleLoad(id: string) {
    const template = templatesQuery.data?.find((t) => t.id === id);
    if (!template) return;
    try {
      const items = await addManyToActiveCart(
        template.items.map((item) => ({ code: item.product_code, quantity: item.quantity })),
        currentRate,
      );
      const unavailable = items.filter((i) => i.resolution_status !== "resolved");
      const added = items.length - unavailable.length;
      if (added > 0) toast.success(`Vorlage „${template.name}" geladen (${added} Artikel, aktuelle Preise).`);
      if (unavailable.length > 0) {
        toast.error("Einige Artikel der Vorlage sind nicht mehr verfügbar.", {
          description: unavailable.map((i) => i.product_code_input).join(", "),
        });
      }
    } catch (error) {
      console.error("Vorlage laden fehlgeschlagen:", error);
      toast.error("Vorlage konnte nicht geladen werden.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Bestellvorlagen</CardTitle>
        <CardDescription>Gespeicherte Listen werden mit den heute gültigen Preisen in den Warenkorb geladen.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {templatesQuery.data.map((template) => (
          <div key={template.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{template.name}</p>
              <p className="text-xs text-muted-foreground">{template.items.length} Position(en)</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="outline" onClick={() => handleLoad(template.id)}>
                Laden
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => mutations.remove.mutate(template.id)}
                aria-label="Vorlage löschen"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
