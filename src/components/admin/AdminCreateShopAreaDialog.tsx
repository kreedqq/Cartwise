import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { slugifyShopAreaName } from "@/lib/shop/shopAreas";
import { createAdminShopArea } from "@/services/shopAreas";
import type { Tables } from "@/types/database";

export function AdminCreateShopAreaDialog({
  open,
  onOpenChange,
  areas,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areas: Tables<"shop_areas">[];
  onCreated: (key: string) => void;
}) {
  const [name, setName] = React.useState("");
  const [template, setTemplate] = React.useState("empty");
  const [sourceKey, setSourceKey] = React.useState(areas[0]?.key ?? "shop");
  const [copyCategories, setCopyCategories] = React.useState(true);
  const [copyRoles, setCopyRoles] = React.useState(true);
  const [copyDesign, setCopyDesign] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const slug = slugifyShopAreaName(name);

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Bitte einen Namen eingeben.");
      return;
    }
    setSaving(true);
    try {
      const created = await createAdminShopArea({
        name: name.trim(),
        template,
        sourceKey: template === "duplicate" ? sourceKey : null,
        copyCategories,
        copyRoles,
        copyDesign,
      });
      toast.success(`${created.name} wurde angelegt.`);
      onCreated(created.key);
      onOpenChange(false);
      setName("");
    } catch (error) {
      console.error(error);
      toast.error("Bereich konnte nicht angelegt werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Neuen Verkaufsbereich anlegen</DialogTitle>
          <DialogDescription>
            Der technische Key wird aus dem Namen erzeugt. Händlerkatalog und Bestellungen werden nicht kopiert.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="area-name">Name</Label>
            <Input id="area-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Zubehör" />
            <p className="text-xs text-muted-foreground">Technischer Key / Pfad: {slug || "—"}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Vorlage</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="empty">Leerer Bereich</SelectItem>
                <SelectItem value="peptix">PEPTIX Standard</SelectItem>
                <SelectItem value="retail">Retail Vorlage</SelectItem>
                <SelectItem value="group_buy">Group Buy Vorlage</SelectItem>
                <SelectItem value="duplicate">Bestehenden Bereich duplizieren</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {template === "duplicate" ? (
            <div className="space-y-1.5">
              <Label>Quelle</Label>
              <Select value={sourceKey} onValueChange={setSourceKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((area) => (
                    <SelectItem key={area.key} value={area.key}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={copyCategories} onCheckedChange={(value) => setCopyCategories(value === true)} />
            Kategorien übernehmen
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={copyRoles} onCheckedChange={(value) => setCopyRoles(value === true)} />
            Rollen übernehmen
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={copyDesign} onCheckedChange={(value) => setCopyDesign(value === true)} />
            Design übernehmen
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="button" onClick={() => void handleCreate()} disabled={saving}>
            Bereich anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
