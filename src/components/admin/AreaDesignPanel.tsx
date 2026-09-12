import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";
import { toast } from "@/components/ui/toaster";
import { AREA_ICON_OPTIONS } from "@/lib/shop/areaIcons";
import {
  AREA_THEME_PRESETS,
  EMPTY_AREA_THEME,
  areaThemeContrastWarning,
  areaThemeCssVars,
  parseAreaTheme,
  type AreaThemeConfig,
  type AreaThemeTokens,
} from "@/lib/shop/areaTheme";
import { updateAdminShopArea } from "@/services/shopAreas";
import type { Tables } from "@/types/database";

const COLOR_FIELDS: Array<{ key: keyof AreaThemeTokens; label: string }> = [
  { key: "primary", label: "Primary" },
  { key: "accent", label: "Accent" },
  { key: "background", label: "Hintergrund" },
  { key: "surface", label: "Surface" },
  { key: "text", label: "Text" },
  { key: "heading", label: "Überschrift" },
  { key: "price", label: "Preis" },
  { key: "button", label: "Button" },
  { key: "buttonText", label: "Button-Text" },
  { key: "border", label: "Rahmen" },
];

export function AreaDesignPanel({
  area,
  onChanged,
}: {
  area: Tables<"shop_areas">;
  onChanged: () => Promise<void>;
}) {
  return <AreaDesignForm key={area.key} area={area} onChanged={onChanged} />;
}

function AreaDesignForm({
  area,
  onChanged,
}: {
  area: Tables<"shop_areas">;
  onChanged: () => Promise<void>;
}) {
  const [draft, setDraft] = React.useState<AreaThemeConfig>(() => parseAreaTheme(area.theme));
  const [iconKey, setIconKey] = React.useState(area.icon_key || "store");
  const [subtitle, setSubtitle] = React.useState(area.subtitle ?? "");
  const [badge, setBadge] = React.useState(area.badge_text ?? "");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateAdminShopArea(area.key, {
        theme: draft as unknown as Record<string, unknown>,
        icon_key: iconKey,
        subtitle: subtitle.trim() || null,
        badge_text: badge.trim() || null,
      });
      toast.success("Design gespeichert.");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Design konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  function applyPreset(name: string) {
    const tokens = AREA_THEME_PRESETS[name] ?? {};
    setDraft((current) => ({ ...current, enabled: true, tokens: { ...current.tokens, ...tokens } }));
  }

  const contrastWarning = areaThemeContrastWarning(draft);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bereichsdesign {area.name}</CardTitle>
          <CardDescription>
            Gilt nur in diesem Verkaufsbereich. Leere Werte fallen auf das globale PEPTIX Design zurück.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={`theme-on-${area.key}`}>Eigenes Theme aktiv</Label>
            <Switch
              id={`theme-on-${area.key}`}
              checked={draft.enabled}
              onCheckedChange={(value) => setDraft((current) => ({ ...current, enabled: value }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Untertitel</Label>
              <Input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Badge</Label>
              <Input value={badge} onChange={(event) => setBadge(event.target.value)} placeholder="NEU" />
            </div>
            <div className="space-y-1">
              <Label>Icon</Label>
              <Select value={iconKey} onValueChange={setIconKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AREA_ICON_OPTIONS.map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Preset</Label>
              <Select onValueChange={applyPreset}>
                <SelectTrigger>
                  <SelectValue placeholder="Preset wählen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(AREA_THEME_PRESETS).map((key) => (
                    <SelectItem key={key} value={key}>
                      {key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Dichte</Label>
              <Select
                value={draft.density}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, density: value as AreaThemeConfig["density"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="spacious">Spacious</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Suche Placeholder</Label>
              <Input
                value={draft.searchPlaceholder}
                onChange={(event) => setDraft((current) => ({ ...current, searchPlaceholder: event.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {COLOR_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label>{field.label}</Label>
                <Input
                  value={draft.tokens[field.key] ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      tokens: { ...current.tokens, [field.key]: event.target.value },
                    }))
                  }
                  placeholder="#d4af37"
                />
              </div>
            ))}
          </div>
          {contrastWarning ? <p className="text-xs text-warning">{contrastWarning}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDraft(EMPTY_AREA_THEME)}>
              Design auf Standard zurücksetzen
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              Speichern
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vorschau</CardTitle>
          <CardDescription>Demo-Produkte, keine echten Daten.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3" style={areaThemeCssVars(draft)}>
          <p className="text-sm font-semibold">{area.name}</p>
          <p className="text-xs text-muted-foreground">{subtitle || "Bereichsvorschau"}</p>
          <div className="rounded-lg border border-border p-3" data-shop-area={area.key}>
            <p className="text-sm font-medium">Semaglutide</p>
            <p className="text-xs text-muted-foreground">5 mg</p>
            <DualCurrencyPrice usd={11.88} rate={0.862} />
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">BAC Water</p>
            <p className="text-xs text-muted-foreground">3 ml</p>
            <DualCurrencyPrice usd={6.25} rate={0.862} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
