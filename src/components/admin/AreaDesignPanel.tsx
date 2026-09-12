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
  AREA_THEME_PRESET_LABELS,
  AREA_THEME_PRESETS,
  COLOR_FIELD_USAGE,
  EMPTY_AREA_THEME,
  areaThemeContrastWarning,
  areaThemeCssVars,
  improveThemeContrast,
  normalizeHexColor,
  paletteFromPrimary,
  parseAreaTheme,
  type AreaThemeConfig,
  type AreaThemeTokens,
} from "@/lib/shop/areaTheme";
import { updateAdminShopArea } from "@/services/shopAreas";
import type { Tables } from "@/types/database";

const VIEWPORTS = [
  { id: "desktop", label: "Desktop", width: 1440 },
  { id: "tablet", label: "Tablet", width: 768 },
  { id: "mobile", label: "Mobile", width: 390 },
] as const;

const SECTIONS = [
  { id: "identity", title: "Identität" },
  { id: "colors", title: "Farben" },
  { id: "layout", title: "Layout" },
  { id: "search", title: "Suche & Leerstand" },
  { id: "price", title: "Preis" },
] as const;

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
  const savedTheme = React.useMemo(() => parseAreaTheme(area.theme), [area.theme]);
  const [draft, setDraft] = React.useState<AreaThemeConfig>(savedTheme);
  const [iconKey, setIconKey] = React.useState(area.icon_key || "store");
  const [subtitle, setSubtitle] = React.useState(area.subtitle ?? "");
  const [badge, setBadge] = React.useState(area.badge_text ?? "");
  const [openSection, setOpenSection] = React.useState<string>("colors");
  const [viewport, setViewport] = React.useState<(typeof VIEWPORTS)[number]["id"]>("desktop");
  const [seed, setSeed] = React.useState("#d4af37");
  const [saving, setSaving] = React.useState(false);

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(savedTheme) ||
    iconKey !== (area.icon_key || "store") ||
    subtitle !== (area.subtitle ?? "") ||
    badge !== (area.badge_text ?? "");

  React.useEffect(() => {
    if (!dirty) return;
    function onLeave(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

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

  function discard() {
    setDraft(savedTheme);
    setIconKey(area.icon_key || "store");
    setSubtitle(area.subtitle ?? "");
    setBadge(area.badge_text ?? "");
  }

  function applyPreset(name: string) {
    const tokens = AREA_THEME_PRESETS[name] ?? {};
    setDraft((current) => ({ ...current, enabled: true, tokens: { ...current.tokens, ...tokens } }));
  }

  const contrastWarning = areaThemeContrastWarning(draft);
  const previewWidth = VIEWPORTS.find((item) => item.id === viewport)?.width ?? 1440;
  const tokenCount = Object.values(draft.tokens).filter(Boolean).length;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">PEPTIX Sales Area Designer</CardTitle>
          <CardDescription>
            Nur Darstellung dieses Verkaufsbereichs. Preise, Katalog und Rollen bleiben unverändert.
          </CardDescription>
          <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
            <StatusChip ok={draft.enabled} on="Theme aktiv" off="PEPTIX Standard" />
            <StatusChip ok={tokenCount > 0} on={`${tokenCount} Farben`} off="Keine Farben" />
            <StatusChip ok={Boolean(draft.searchPlaceholder)} on="Suche gesetzt" off="Suche Standard" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {SECTIONS.map((section) => (
            <details
              key={section.id}
              open={openSection === section.id}
              onToggle={(event) => {
                if ((event.target as HTMLDetailsElement).open) setOpenSection(section.id);
              }}
              className="rounded-lg border border-border/70 px-3 py-2"
            >
              <summary className="cursor-pointer text-sm font-medium">{section.title}</summary>
              <div className="mt-3 space-y-3">
                {section.id === "identity" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Untertitel">
                      <Input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} />
                    </Field>
                    <Field label="Badge" hint="Kurzer Hinweis auf der Hub-Karte">
                      <Input value={badge} onChange={(event) => setBadge(event.target.value)} placeholder="NEU" />
                    </Field>
                    <Field label="Icon">
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
                    </Field>
                  </div>
                ) : null}
                {section.id === "colors" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor={`theme-on-${area.key}`}>Eigenes Theme aktiv</Label>
                      <Switch
                        id={`theme-on-${area.key}`}
                        checked={draft.enabled}
                        onCheckedChange={(value) => setDraft((current) => ({ ...current, enabled: value }))}
                      />
                    </div>
                    <Field label="Preset" hint="Setzt Ausgangswerte. Danach einzeln anpassbar.">
                      <Select onValueChange={applyPreset}>
                        <SelectTrigger>
                          <SelectValue placeholder="Preset wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(AREA_THEME_PRESETS).map((key) => (
                            <SelectItem key={key} value={key}>
                              {AREA_THEME_PRESET_LABELS[key] ?? key}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <div className="flex flex-wrap items-end gap-2">
                      <ColorField
                        label="Hauptfarbe"
                        hint="Erzeugt eine dunkle Premium-Palette"
                        usage="Ausgangspunkt für alle übrigen Farben"
                        value={seed}
                        onChange={setSeed}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            enabled: true,
                            tokens: { ...current.tokens, ...paletteFromPrimary(seed) },
                          }))
                        }
                      >
                        Palette erzeugen
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(Object.keys(COLOR_FIELD_USAGE) as Array<keyof AreaThemeTokens>).map((key) => (
                        <ColorField
                          key={key}
                          label={key}
                          usage={COLOR_FIELD_USAGE[key]}
                          value={draft.tokens[key] ?? ""}
                          onChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              tokens: { ...current.tokens, [key]: value },
                            }))
                          }
                        />
                      ))}
                    </div>
                    {contrastWarning ? (
                      <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
                        <p className="text-xs text-warning">Diese Farbkombination ist schlecht lesbar. {contrastWarning}</p>
                        <Button type="button" size="sm" variant="outline" onClick={() => setDraft(improveThemeContrast)}>
                          Kontrast verbessern
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {section.id === "layout" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Dichte">
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
                    </Field>
                    <Field label="Content Width">
                      <Select
                        value={draft.contentWidth}
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            contentWidth: value as AreaThemeConfig["contentWidth"],
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="narrow">Narrow</SelectItem>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="wide">Wide</SelectItem>
                          <SelectItem value="full">Full Width</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                ) : null}
                {section.id === "search" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Suche Placeholder" hint='Beispiel: „Zubehör suchen …"'>
                      <Input
                        value={draft.searchPlaceholder}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, searchPlaceholder: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Leerstand Titel">
                      <Input
                        value={draft.emptyTitle}
                        onChange={(event) => setDraft((current) => ({ ...current, emptyTitle: event.target.value }))}
                      />
                    </Field>
                    <Field label="Leerstand Text" className="sm:col-span-2">
                      <Input
                        value={draft.emptyDescription}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, emptyDescription: event.target.value }))
                        }
                      />
                    </Field>
                  </div>
                ) : null}
                {section.id === "price" ? (
                  <Field label="Preisdarstellung" hint="Berechnung bleibt die PEPTIX Money SSoT. EUR bleibt groß.">
                    <Select
                      value={draft.priceEmphasis}
                      onValueChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          priceEmphasis: value as AreaThemeConfig["priceEmphasis"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="prominent">Prominent</SelectItem>
                        <SelectItem value="luxury">Luxury</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
              </div>
            </details>
          ))}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDraft(EMPTY_AREA_THEME)}>
              Design auf Standard zurücksetzen
            </Button>
            <Button type="button" variant="ghost" onClick={discard} disabled={!dirty}>
              Änderungen verwerfen
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving || !dirty}>
              Speichern
            </Button>
          </div>
          {dirty ? <p className="text-xs text-warning">Du hast ungespeicherte Designänderungen.</p> : null}
        </CardContent>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Live Vorschau</CardTitle>
          <CardDescription>Demo-Produkte, keine echten Warenkorb- oder Bestelldaten.</CardDescription>
          <div className="flex flex-wrap gap-2">
            {VIEWPORTS.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={viewport === item.id ? "default" : "outline"}
                onClick={() => setViewport(item.id)}
              >
                {item.label} {item.width}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="mx-auto origin-top" style={{ width: Math.min(previewWidth, 440), maxWidth: "100%" }}>
            <div
              data-shop-area={area.key}
              className="overflow-hidden rounded-xl border border-border"
              style={{
                ...areaThemeCssVars(draft),
                background: draft.tokens.background || undefined,
                color: draft.tokens.text || undefined,
              }}
            >
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold" style={{ color: draft.tokens.heading || undefined }}>
                  {area.name}
                </p>
                <p className="text-xs text-muted-foreground">{subtitle || "Bereichsvorschau"}</p>
                {badge ? (
                  <span className="mt-1 inline-flex rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                    {badge}
                  </span>
                ) : null}
              </div>
              <div className="space-y-3 p-4">
                <Input readOnly value={draft.searchPlaceholder || "Artikel suchen …"} />
                {[
                  { name: "Semaglutide", variant: "5 mg", usd: 11.88 },
                  { name: "Retatrutide", variant: "10 mg", usd: 18.5 },
                  { name: "BAC Water", variant: "3 ml", usd: 6.25 },
                ].map((product) => (
                  <div
                    key={product.name}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                    style={{ background: draft.tokens.surface || undefined }}
                  >
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.variant}</p>
                    </div>
                    <div className="text-right">
                      <DualCurrencyPrice usd={product.usd} rate={0.862} size="compact" align="right" />
                      <Button type="button" size="sm" className="mt-2" style={{ background: draft.tokens.button || undefined, color: draft.tokens.buttonText || undefined }}>
                        In den Warenkorb
                      </Button>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  {draft.emptyTitle || "Dieser Bereich wird gerade vorbereitet."}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className ? `space-y-1 ${className}` : "space-y-1"}>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ColorField({
  label,
  hint,
  usage,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  usage: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const picker = normalizeHexColor(value) ?? "#d4af37";
  return (
    <div className="space-y-1">
      <Label className="capitalize">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} wählen`}
          value={picker}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-10 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0"
        />
        <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="#d4af37" />
      </div>
      <p className="text-[11px] text-muted-foreground">Verwendet für: {usage}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function StatusChip({ ok, on, off }: { ok: boolean; on: string; off: string }) {
  return (
    <span className={ok ? "rounded-full bg-primary/15 px-2 py-0.5 text-primary" : "rounded-full bg-muted px-2 py-0.5 text-muted-foreground"}>
      {ok ? on : off}
    </span>
  );
}
