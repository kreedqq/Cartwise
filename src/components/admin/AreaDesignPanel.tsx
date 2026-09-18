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
  ADVANCED_COLOR_KEYS,
  AREA_BUTTON_RADIUS_OPTIONS,
  AREA_THEME_BUTTON_CLASS,
  AREA_THEME_PRESET_LABELS,
  AREA_THEME_PRESETS,
  BASIC_COLOR_KEYS,
  COLOR_FIELD_LABELS,
  COLOR_FIELD_USAGE,
  EMPTY_AREA_THEME,
  areaButtonRadiusCss,
  areaThemeContrastWarning,
  areaThemeCssVars,
  improveThemeContrast,
  normalizeHexColor,
  paletteFromPrimary,
  parseAreaTheme,
  type AreaThemeConfig,
} from "@/lib/shop/areaTheme";
import { PortalAssetPicker } from "@/components/admin/PortalAssetPicker";
import { ShopAreaPortal } from "@/components/shop/ShopAreaPortal";
import { portalConfigFromAreaTheme } from "@/lib/shop/areaPortal";
import {
  type BuiltinPortalAssetId,
  isBuiltinPortalAssetId,
  parseCategoryPortalOverrides,
  parseVialMedia,
  portalAssetById,
  resolvePortalAssetPublicUrl,
  type CategoryPortalOverride,
  type VialMediaConfig,
} from "@/lib/shop/portalAssets";
import {
  type AreaPortalConfig,
  type PortalAtmosphere,
  portalThemeCssVars,
  resolvePortalAccent,
  resolvePortalImageUrl,
} from "@/lib/shop/portalTheme";
import { QUERY_KEYS } from "@/lib/constants";
import { updateAdminShopArea, listAdminShopAreaCategories } from "@/services/shopAreas";
import { useQuery } from "@tanstack/react-query";
import { deleteSiteDesignImage, siteDesignImageUrl, uploadAreaDesignImage } from "@/services/siteDesign";
import type { Tables } from "@/types/database";

const VIEWPORTS = [
  { id: "desktop", label: "Desktop", width: 1440 },
  { id: "tablet", label: "Tablet", width: 768 },
  { id: "mobile", label: "Mobile", width: 390 },
  { id: "iphone-se", label: "375", width: 375 },
  { id: "pixel", label: "412", width: 412 },
] as const;

const PREVIEW_SCENES = [
  { id: "shop", title: "Shop" },
  { id: "portal", title: "Portal" },
  { id: "product", title: "Produkt" },
  { id: "kit", title: "Kit Gesuch" },
  { id: "join", title: "Join Dialog" },
] as const;

const DESIGNER_GROUPS = [
  {
    id: "portal",
    title: "Portal",
    description: "Portal-Aussehen auf der Shop-Übersicht und beim Betreten des Bereichs.",
    sections: ["portal"],
  },
  {
    id: "grunddesign",
    title: "Grunddesign",
    description: "Passe Farben, Hintergrund und den allgemeinen Look dieses Verkaufsbereichs an.",
    sections: ["identity", "colors", "background", "typography"],
  },
  {
    id: "shop",
    title: "Shop & Produkte",
    description: "Bestimme, wie Produkte, Preise und Warenkorb dargestellt werden.",
    sections: ["products", "cards", "price", "categories", "search"],
  },
  {
    id: "kits",
    title: "Kit Gesuche",
    description: "Passe Kit Karten, Preise und Aktionen an.",
    sections: [],
  },
  {
    id: "nav",
    title: "Navigation & Layout",
    description: "Bestimme Aufbau, Abstände und Verhalten auf Desktop und Mobile.",
    sections: ["header", "layout", "mobile"],
  },
  {
    id: "images",
    title: "Bilder",
    description: "Verwalte Hintergrund, Hero und weitere Bilder.",
    sections: ["hero", "banner", "assets"],
  },
  {
    id: "buttons",
    title: "Buttons",
    description: "Passe Form, Größe und Stil der Aktionen an.",
    sections: ["buttons"],
  },
  {
    id: "advanced",
    title: "Erweitert",
    description: "Selten benötigte Einstellungen für diesen Verkaufsbereich.",
    sections: [],
  },
] as const;

const SECTION_TITLES: Record<string, string> = {
  portal: "Portal-Stil",
  identity: "Name",
  colors: "Farben",
  background: "Hintergrund",
  typography: "Schrift",
  products: "Produktdarstellung",
  cards: "Produktkarten",
  price: "Preise",
  categories: "Kategorien",
  search: "Suche & Leerstand",
  header: "Header",
  layout: "Desktop Layout",
  mobile: "Mobile Layout",
  hero: "Hero",
  banner: "Banner",
  assets: "Weitere Bilder",
  buttons: "Button Form",
};

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
  const savedPortal = React.useMemo(() => portalConfigFromAreaTheme(area.theme), [area.theme]);
  const savedCategoryPortals = React.useMemo(() => parseCategoryPortalOverrides(area.theme), [area.theme]);
  const savedVialMedia = React.useMemo(() => parseVialMedia(area.theme), [area.theme]);
  const [draft, setDraft] = React.useState<AreaThemeConfig>(savedTheme);
  const [portalDraft, setPortalDraft] = React.useState<AreaPortalConfig>(savedPortal);
  const [categoryPortalsDraft, setCategoryPortalsDraft] =
    React.useState<Record<string, CategoryPortalOverride>>(savedCategoryPortals);
  const [vialMediaDraft, setVialMediaDraft] = React.useState<VialMediaConfig>(savedVialMedia);
  const categoriesQuery = useQuery({
    queryKey: QUERY_KEYS.adminShopAreaConfig(area.key).concat("design-categories"),
    queryFn: () => listAdminShopAreaCategories(area.key),
  });
  const [iconKey, setIconKey] = React.useState(area.icon_key || "store");
  const [subtitle, setSubtitle] = React.useState(area.subtitle ?? "");
  const [badge, setBadge] = React.useState(area.badge_text ?? "");
  const [openSection, setOpenSection] = React.useState<string>("grunddesign");
  const [viewport, setViewport] = React.useState<(typeof VIEWPORTS)[number]["id"]>("desktop");
  const [previewScene, setPreviewScene] = React.useState<(typeof PREVIEW_SCENES)[number]["id"]>("shop");
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [seed, setSeed] = React.useState("#d4af37");
  const [saving, setSaving] = React.useState(false);

  const previewPortalAccent = resolvePortalAccent(
    portalDraft,
    draft.tokens.accent,
    draft.tokens.primary,
    area.key,
  );

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(savedTheme) ||
    JSON.stringify(portalDraft) !== JSON.stringify(savedPortal) ||
    JSON.stringify(categoryPortalsDraft) !== JSON.stringify(savedCategoryPortals) ||
    JSON.stringify(vialMediaDraft) !== JSON.stringify(savedVialMedia) ||
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
      const themeBase =
        area.theme && typeof area.theme === "object" ? { ...(area.theme as Record<string, unknown>) } : {};
      await updateAdminShopArea(area.key, {
        theme: {
          ...themeBase,
          ...(draft as unknown as Record<string, unknown>),
          portal: portalDraft,
          categoryPortals: categoryPortalsDraft,
          vialMedia: vialMediaDraft,
        },
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
    setPortalDraft(savedPortal);
    setCategoryPortalsDraft(savedCategoryPortals);
    setVialMediaDraft(savedVialMedia);
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
          <CardTitle className="text-base">Bereichsdesign</CardTitle>
          <CardDescription>
            Nur Darstellung dieses Verkaufsbereichs. Preise, Katalog und Rollen bleiben unverändert.
          </CardDescription>
          <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
            <StatusChip ok={draft.enabled} on="Theme aktiv" off="PEPTIX Standard" />
            <StatusChip ok={tokenCount > 0} on={`${tokenCount} Farben`} off="Keine Farben" />
            <StatusChip ok={draft.background.mode !== "global"} on="Background gesetzt" off="Background Standard" />
            <StatusChip ok={draft.hero.enabled} on="Hero aktiv" off="Kein Hero" />
            <StatusChip ok={Boolean(draft.searchPlaceholder)} on="Suche gesetzt" off="Suche Standard" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(showAdvanced ? DESIGNER_GROUPS : DESIGNER_GROUPS.filter((group) => group.id !== "advanced")).map((group) => (
            <details
              key={group.id}
              open={openSection === group.id}
              onToggle={(event) => {
                if ((event.target as HTMLDetailsElement).open) setOpenSection(group.id);
              }}
              className="rounded-lg border border-border/70 px-3 py-2"
            >
              <summary className="cursor-pointer text-sm font-medium">{group.title}</summary>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{group.description}</p>
              {group.id === "kits" ? (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Diese Gruppe betrifft nur Kit Gesuche: Karten, Fortschritt, Anteilpreis und die Aktionen
                    Gesuch erstellen und Mitmachen. Produktkatalog und Warenkorb bleiben unverändert.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setPreviewScene("kit")}>
                      Kit Gesuch Vorschau
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setPreviewScene("join")}>
                      Mitmachen Vorschau
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Button Form kommt aus der Gruppe Buttons. Der Kit Preis bleibt EUR zuerst, Einheit über die
                    bestehende Quantity-Logik.
                  </p>
                </div>
              ) : null}
              {group.sections.map((sectionId) => (
              <div key={sectionId} className="mt-3 space-y-3">
                {group.sections.length > 1 ? (
                  <p className="text-sm font-medium">{SECTION_TITLES[sectionId]}</p>
                ) : null}
                {sectionId === "portal" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <PortalAssetPicker
                        value={
                          isBuiltinPortalAssetId(portalDraft.assetId) ? portalDraft.assetId : ""
                        }
                        onChange={(assetId: BuiltinPortalAssetId | "") => {
                          const accent = assetId ? portalAssetById(assetId)?.accentHex : "";
                          setPortalDraft((c) => ({
                            ...c,
                            assetId,
                            accent: accent || c.accent,
                          }));
                        }}
                      />
                    </div>
                    <Field label="Portal aktiv" className="sm:col-span-2">
                      <Switch
                        checked={portalDraft.enabled}
                        onCheckedChange={(value) => setPortalDraft((c) => ({ ...c, enabled: value }))}
                      />
                    </Field>
                    <ColorField
                      label="Portal-Akzent"
                      hint="Glow, Rand und Kategorie-Portale"
                      usage="Welt-Identität neben PEPTIX Gold"
                      value={portalDraft.accent || "#c9a227"}
                      onChange={(value) => setPortalDraft((c) => ({ ...c, accent: value }))}
                    />
                    <Field label="Glow-Intensität">
                      <Input
                        type="range"
                        min={0}
                        max={100}
                        value={portalDraft.glow}
                        onChange={(e) =>
                          setPortalDraft((c) => ({ ...c, glow: Number(e.target.value) || 0 }))
                        }
                      />
                      <p className="text-[11px] text-muted-foreground">{portalDraft.glow}%</p>
                    </Field>
                    <Field label="Atmosphäre">
                      <Select
                        value={portalDraft.atmosphere}
                        onValueChange={(value: PortalAtmosphere) =>
                          setPortalDraft((c) => ({ ...c, atmosphere: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="energy">Energy</SelectItem>
                          <SelectItem value="molecule">Molecule</SelectItem>
                          <SelectItem value="void">Void</SelectItem>
                          <SelectItem value="calm">Calm</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Custom Portal" hint="Optional — ersetzt Built-in Asset">
                      <Input
                        value={portalDraft.customAsset}
                        onChange={(e) => setPortalDraft((c) => ({ ...c, customAsset: e.target.value }))}
                        placeholder="site-design Pfad oder URL"
                      />
                    </Field>
                    <Field label="Legacy Orb" hint="Nur Fallback wenn kein Asset gewählt">
                      <Input
                        value={portalDraft.image}
                        onChange={(e) => setPortalDraft((c) => ({ ...c, image: e.target.value }))}
                        placeholder="site-design Pfad oder URL"
                      />
                    </Field>
                    <div className="sm:col-span-2 space-y-3 rounded-lg border border-border/60 p-3">
                      <p className="text-sm font-medium">Kategorie-Portale</p>
                      <p className="text-[11px] text-muted-foreground">
                        Überschreibt das Bereichs-Portal pro Kategorie (dynamisch aus dem Katalog).
                      </p>
                      {(categoriesQuery.data ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">Keine Kategorien in diesem Bereich.</p>
                      ) : (
                        (categoriesQuery.data ?? []).map((cat) => {
                          const key = cat.category_key;
                          const current = categoryPortalsDraft[key]?.assetId ?? "";
                          return (
                            <div
                              key={key}
                              className="space-y-1 border-t border-border/40 pt-2 first:border-0 first:pt-0"
                              data-testid={`category-portal-row-${key}`}
                            >
                              <p className="text-xs font-medium">{cat.label || key}</p>
                              <Select
                                value={current || "__inherit__"}
                                onValueChange={(value) => {
                                  setCategoryPortalsDraft((prev) => {
                                    const next = { ...prev };
                                    if (value === "__inherit__") {
                                      delete next[key];
                                      return next;
                                    }
                                    next[key] = { assetId: value, customAsset: prev[key]?.customAsset ?? "" };
                                    return next;
                                  });
                                }}
                              >
                                <SelectTrigger className="h-9" data-testid={`category-portal-select-${key}`}>
                                  <SelectValue placeholder="Bereichs-Portal" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__inherit__">Bereichs-Portal übernehmen</SelectItem>
                                  <SelectItem value="portal_blue">Blau</SelectItem>
                                  <SelectItem value="portal_purple">Violett</SelectItem>
                                  <SelectItem value="portal_green">Grün</SelectItem>
                                  <SelectItem value="portal_red">Rot</SelectItem>
                                  <SelectItem value="portal_orange">Orange</SelectItem>
                                  <SelectItem value="portal_gold">Gold</SelectItem>
                                  <SelectItem value="portal_pink">Pink</SelectItem>
                                  <SelectItem value="portal_cyan">Cyan</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="sm:col-span-2 space-y-2 rounded-lg border border-border/60 p-3">
                      <p className="text-sm font-medium">Vial-Bilder (Fallback-Kette)</p>
                      <Field label="Bereichs-Vial" hint="site-design Pfad — vor Canonical">
                        <Input
                          value={vialMediaDraft.areaImage}
                          onChange={(e) =>
                            setVialMediaDraft((v) => ({ ...v, areaImage: e.target.value }))
                          }
                          placeholder="z. B. shop-areas/…/vial.png"
                        />
                      </Field>
                    </div>
                    <Field label="Portal-Hintergrund" hint="Optional">
                      <Input
                        value={portalDraft.backgroundImage}
                        onChange={(e) => setPortalDraft((c) => ({ ...c, backgroundImage: e.target.value }))}
                        placeholder="site-design Pfad oder URL"
                      />
                    </Field>
                  </div>
                ) : null}
                {sectionId === "identity" ? (
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
                    <Field label="Hub Titel" hint="Optionaler Titel auf der Shop-Übersicht.">
                      <Input
                        value={draft.hub.title}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, hub: { ...current.hub, title: event.target.value } }))
                        }
                      />
                    </Field>
                    <Field label="Hub Beschreibung" className="sm:col-span-2">
                      <Input
                        value={draft.hub.description}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            hub: { ...current.hub, description: event.target.value },
                          }))
                        }
                      />
                    </Field>
                  </div>
                ) : null}
                {sectionId === "colors" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor={`theme-on-${area.key}`}>Eigenes Theme aktiv</Label>
                      <Switch
                        id={`theme-on-${area.key}`}
                        checked={draft.enabled}
                        onCheckedChange={(value) => setDraft((current) => ({ ...current, enabled: value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Preset</p>
                      <p className="text-[11px] text-muted-foreground">Setzt Ausgangswerte. Danach einzeln anpassbar.</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {Object.entries(AREA_THEME_PRESETS).map(([key, tokens]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => applyPreset(key)}
                            className="rounded-lg border border-border p-2 text-left transition-colors hover:border-primary"
                          >
                            <div className="mb-2 flex h-8 overflow-hidden rounded-md">
                              <span className="flex-[2]" style={{ background: tokens.background || "#070b14" }} />
                              <span className="flex-1" style={{ background: tokens.primary || "#d4af37" }} />
                              <span className="flex-1" style={{ background: tokens.surface || "#101826" }} />
                            </div>
                            <p className="text-xs font-medium">{AREA_THEME_PRESET_LABELS[key] ?? key}</p>
                          </button>
                        ))}
                      </div>
                    </div>
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
                        Palette aus Hauptfarbe
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {BASIC_COLOR_KEYS.map((key) => (
                        <ColorField
                          key={key}
                          label={COLOR_FIELD_LABELS[key]}
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
                    <details className="rounded-md border border-border/60 px-3 py-2">
                      <summary className="cursor-pointer text-sm font-medium">Weitere Farben</summary>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {ADVANCED_COLOR_KEYS.map((key) => (
                          <ColorField
                            key={key}
                            label={COLOR_FIELD_LABELS[key]}
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
                    </details>
                    {contrastWarning ? (
                      <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
                        <p className="text-xs text-warning">Schlechter Kontrast. {contrastWarning}</p>
                        <Button type="button" size="sm" variant="outline" onClick={() => setDraft(improveThemeContrast)}>
                          Verbessern
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {sectionId === "background" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Hintergrund" hint="Overlay legt fest, wie stark das Bild abgedunkelt wird.">
                      <Select
                        value={draft.background.mode}
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            background: { ...current.background, mode: value as AreaThemeConfig["background"]["mode"] },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="global">PEPTIX Standard</SelectItem>
                          <SelectItem value="color">Eigene Farbe</SelectItem>
                          <SelectItem value="gradient">Eigener Gradient</SelectItem>
                          <SelectItem value="image">Eigenes Bild</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <ColorField
                      label="Hintergrundfarbe"
                      usage="Seitenhintergrund, wenn keine globale Vorlage gilt"
                      value={draft.background.color || draft.tokens.background || ""}
                      onChange={(value) =>
                        setDraft((current) => ({ ...current, background: { ...current.background, color: value } }))
                      }
                    />
                    <Field label="Gradient CSS" className="sm:col-span-2">
                      <Input
                        value={draft.background.gradient}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            background: { ...current.background, gradient: event.target.value },
                          }))
                        }
                        placeholder="linear-gradient(180deg, #070b14, #101826)"
                      />
                    </Field>
                    <ImageField
                      label="Desktop Bild"
                      areaKey={area.key}
                      kind="background"
                      value={draft.background.desktopImage}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          background: { ...current.background, desktopImage: value },
                        }))
                      }
                    />
                    <ImageField
                      label="Tablet Bild"
                      areaKey={area.key}
                      kind="background-tablet"
                      value={draft.background.tabletImage}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          background: { ...current.background, tabletImage: value },
                        }))
                      }
                    />
                    <ImageField
                      label="Mobile Bild"
                      areaKey={area.key}
                      kind="background-mobile"
                      value={draft.background.mobileImage}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          background: { ...current.background, mobileImage: value },
                        }))
                      }
                    />
                    <Field label="Overlay Stärke">
                      <Input
                        type="number"
                        min={0}
                        max={90}
                        value={draft.background.overlayStrength}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            background: { ...current.background, overlayStrength: Number(event.target.value) },
                          }))
                        }
                      />
                    </Field>
                    <details className="sm:col-span-2 rounded-md border border-border/60 px-3 py-2">
                      <summary className="cursor-pointer text-sm font-medium">Weitere Hintergrundoptionen</summary>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Field label="Position">
                          <Input
                            value={draft.background.position}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                background: { ...current.background, position: event.target.value },
                              }))
                            }
                          />
                        </Field>
                        <Field label="Skalierung">
                          <Select
                            value={draft.background.scale}
                            onValueChange={(value) =>
                              setDraft((current) => ({
                                ...current,
                                background: { ...current.background, scale: value as AreaThemeConfig["background"]["scale"] },
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cover">Ausfüllen</SelectItem>
                              <SelectItem value="contain">Einpassen</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Unschärfe">
                          <Input
                            type="number"
                            min={0}
                            max={40}
                            value={draft.background.blur}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                background: { ...current.background, blur: Number(event.target.value) },
                              }))
                            }
                          />
                        </Field>
                        <Field label="Bewegung">
                          <Select
                            value={draft.background.attachment}
                            onValueChange={(value) =>
                              setDraft((current) => ({
                                ...current,
                                background: {
                                  ...current.background,
                                  attachment: value as AreaThemeConfig["background"]["attachment"],
                                },
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="scroll">Scrollt mit</SelectItem>
                              <SelectItem value="fixed">Fixiert</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                    </details>
                  </div>
                ) : null}
                {sectionId === "hero" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3 sm:col-span-2">
                      <Label>Hero aktiv</Label>
                      <Switch
                        checked={draft.hero.enabled}
                        onCheckedChange={(value) =>
                          setDraft((current) => ({ ...current, hero: { ...current.hero, enabled: value } }))
                        }
                      />
                    </div>
                    <Field label="Titel">
                      <Input
                        value={draft.hero.title}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, hero: { ...current.hero, title: event.target.value } }))
                        }
                      />
                    </Field>
                    <Field label="Untertitel">
                      <Input
                        value={draft.hero.subtitle}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, hero: { ...current.hero, subtitle: event.target.value } }))
                        }
                      />
                    </Field>
                    <Field label="Beschreibung" className="sm:col-span-2">
                      <Input
                        value={draft.hero.description}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, hero: { ...current.hero, description: event.target.value } }))
                        }
                      />
                    </Field>
                    <Field label="Button Text">
                      <Input
                        value={draft.hero.buttonText}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, hero: { ...current.hero, buttonText: event.target.value } }))
                        }
                      />
                    </Field>
                    <Field label="Button Ziel">
                      <Input
                        value={draft.hero.buttonHref}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, hero: { ...current.hero, buttonHref: event.target.value } }))
                        }
                        placeholder="/shop"
                      />
                    </Field>
                    <Field label="Variante">
                      <Select
                        value={draft.hero.variant}
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            hero: { ...current.hero, variant: value as AreaThemeConfig["hero"]["variant"] },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minimal">Minimal</SelectItem>
                          <SelectItem value="centered">Centered</SelectItem>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                          <SelectItem value="split">Split</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <ImageField
                      label="Desktop Hero"
                      areaKey={area.key}
                      kind="hero"
                      value={draft.hero.desktopImage}
                      onChange={(value) =>
                        setDraft((current) => ({ ...current, hero: { ...current.hero, desktopImage: value } }))
                      }
                    />
                    <ImageField
                      label="Mobile Hero"
                      areaKey={area.key}
                      kind="hero-mobile"
                      value={draft.hero.mobileImage}
                      onChange={(value) =>
                        setDraft((current) => ({ ...current, hero: { ...current.hero, mobileImage: value } }))
                      }
                    />
                  </div>
                ) : null}
                {sectionId === "header" ? (
                  <p className="text-xs text-muted-foreground">
                    Titel, Untertitel und Badge kommen aus der Identität. Die globale Navigation bleibt unverändert.
                  </p>
                ) : null}
                {sectionId === "categories" ? (
                  <Field label="Darstellung" hint="Nur Optik. Die Kategorie-Logik bleibt unverändert.">
                    <Select
                      value={draft.categories.display}
                      onValueChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          categories: { display: value as AreaThemeConfig["categories"]["display"] },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pills">Pills</SelectItem>
                        <SelectItem value="tabs">Tabs</SelectItem>
                        <SelectItem value="cards">Cards</SelectItem>
                        <SelectItem value="buttons">Buttons</SelectItem>
                        <SelectItem value="minimal">Minimal</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
                {sectionId === "products" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Produkt Layout">
                      <Select
                        value={draft.products.layout}
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            products: { ...current.products, layout: value as AreaThemeConfig["products"]["layout"] },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                          <SelectItem value="table">Tabelle</SelectItem>
                          <SelectItem value="cards">Karten</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Kartenradius">
                      <Select
                        value={draft.products.radius}
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            products: { ...current.products, radius: value as AreaThemeConfig["products"]["radius"] },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sm">Klein</SelectItem>
                          <SelectItem value="md">Mittel</SelectItem>
                          <SelectItem value="lg">Groß</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                ) : null}
                {sectionId === "buttons" ? (
                  <Field label="Button Form" hint="Gilt für primäre und sekundäre Buttons der Sales Area.">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {AREA_BUTTON_RADIUS_OPTIONS.map((option) => {
                        const active = draft.buttons.radius === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                buttons: { radius: option.value },
                              }))
                            }
                            className={`min-h-11 rounded-xl border px-2 py-2 text-left transition-colors ${
                              active ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                            }`}
                          >
                            <span
                              className="mb-2 flex h-8 items-center justify-center bg-primary px-3 text-[11px] font-medium text-primary-foreground"
                              style={{ borderRadius: option.css }}
                            >
                              {option.label === "Leicht abgerundet" ? "Leicht" : option.label === "Abgerundet" ? "Rund" : option.label}
                            </span>
                            <span className="block text-xs font-medium">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                ) : null}
                {sectionId === "cards" ? (
                  <div className="flex items-center justify-between gap-3">
                    <Label>Schatten</Label>
                    <Switch
                      checked={draft.cards.shadow}
                      onCheckedChange={(value) =>
                        setDraft((current) => ({ ...current, cards: { ...current.cards, shadow: value } }))
                      }
                    />
                  </div>
                ) : null}
                {sectionId === "banner" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3 sm:col-span-2">
                      <Label>Banner aktiv</Label>
                      <Switch
                        checked={draft.banner.enabled}
                        onCheckedChange={(value) =>
                          setDraft((current) => ({ ...current, banner: { ...current.banner, enabled: value } }))
                        }
                      />
                    </div>
                    <Field label="Titel">
                      <Input
                        value={draft.banner.title}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, banner: { ...current.banner, title: event.target.value } }))
                        }
                      />
                    </Field>
                    <Field label="Beschreibung">
                      <Input
                        value={draft.banner.description}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            banner: { ...current.banner, description: event.target.value },
                          }))
                        }
                      />
                    </Field>
                  </div>
                ) : null}
                {sectionId === "typography" ? (
                  <Field label="Schriftgröße">
                    <Select
                      value={draft.typography.scale}
                      onValueChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          typography: { scale: value as AreaThemeConfig["typography"]["scale"] },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sm">Klein</SelectItem>
                        <SelectItem value="md">Standard</SelectItem>
                        <SelectItem value="lg">Groß</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
                {sectionId === "mobile" ? (
                  <Field label="Mobile Hero Höhe">
                    <Select
                      value={draft.mobile.heroHeight}
                      onValueChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          mobile: { heroHeight: value as AreaThemeConfig["mobile"]["heroHeight"] },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compact">Kompakt</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
                {sectionId === "assets" ? (
                  <ImageField
                    label="Hub Bild"
                    areaKey={area.key}
                    kind="hub"
                    value={draft.hub.image}
                    onChange={(value) =>
                      setDraft((current) => ({ ...current, hub: { ...current.hub, image: value } }))
                    }
                  />
                ) : null}
                {sectionId === "layout" ? (
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
                {sectionId === "search" ? (
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
                {sectionId === "price" ? (
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
              ))}
            </details>
          ))}
          <Button type="button" variant="ghost" className="w-full justify-start text-sm" onClick={() => setShowAdvanced((value) => !value)}>
            {showAdvanced ? "Weniger Einstellungen" : "Mehr Einstellungen"}
          </Button>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDraft(EMPTY_AREA_THEME)}>
              Standard wiederherstellen
            </Button>
            <Button type="button" variant="ghost" onClick={discard} disabled={!dirty}>
              Änderungen verwerfen
            </Button>
            <Button
              type="button"
              data-testid="area-design-save"
              onClick={() => void save()}
              disabled={saving || !dirty}
            >
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
            {PREVIEW_SCENES.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={previewScene === item.id ? "default" : "outline"}
                onClick={() => setPreviewScene(item.id)}
              >
                {item.title}
              </Button>
            ))}
          </div>
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
              className={`overflow-hidden rounded-xl border border-border ${AREA_THEME_BUTTON_CLASS}`}
              style={{
                ...areaThemeCssVars(draft),
                "--area-button-radius": areaButtonRadiusCss(draft.buttons.radius),
                background: draft.tokens.background || undefined,
                color: draft.tokens.text || undefined,
              } as React.CSSProperties}
            >
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold" style={{ color: draft.tokens.heading || undefined }}>
                  {draft.hero.title || area.name}
                </p>
                <p className="text-xs text-muted-foreground">{draft.hero.subtitle || subtitle || "Bereichsvorschau"}</p>
                {badge ? (
                  <span className="mt-1 inline-flex rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                    {badge}
                  </span>
                ) : null}
              </div>
              <div className="space-y-3 p-4">
                {previewScene === "portal" && portalDraft.enabled ? (
                  <div
                    className="overflow-hidden rounded-xl"
                    style={portalThemeCssVars(previewPortalAccent, portalDraft.glow) as React.CSSProperties}
                  >
                    <ShopAreaPortal
                      title={draft.hero.title || area.name}
                      description={draft.hero.subtitle || subtitle || "Portal-Vorschau — dieselbe Darstellung wie auf /shop."}
                      href="#"
                      accentHex={previewPortalAccent}
                      glow={portalDraft.glow}
                      atmosphere={portalDraft.atmosphere}
                      backgroundImageUrl={resolvePortalImageUrl(portalDraft.backgroundImage)}
                      portalAssetUrl={resolvePortalAssetPublicUrl({
                        assetId: portalDraft.assetId,
                        customPath: portalDraft.customAsset,
                        legacyOrbPath: portalDraft.image,
                      })}
                      badge={badge || undefined}
                      ctaLabel="Betreten"
                      disabled
                      layout="hub"
                    />
                  </div>
                ) : previewScene === "portal" && !portalDraft.enabled ? (
                  <p className="text-xs text-muted-foreground">Portal ist deaktiviert — aktivieren, um die Vorschau zu sehen.</p>
                ) : null}
                {previewScene !== "portal" ? (
                <>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm">Primary Button</Button>
                  <Button type="button" size="sm" variant="outline">Secondary Button</Button>
                  <Button type="button" size="sm">Shop</Button>
                  <Button type="button" size="sm" variant="outline">Group Buy</Button>
                  <Button type="button" size="sm">In den Warenkorb</Button>
                  <Button type="button" size="sm">Gesuch erstellen</Button>
                  <Button type="button" size="sm">Mitmachen</Button>
                </div>
                {(previewScene === "shop" || previewScene === "product") && draft.hero.enabled ? (
                  <div className="rounded-lg bg-primary/10 px-3 py-2 text-xs">
                    Hero: {draft.hero.variant} · {draft.hero.buttonText || "ohne Button"}
                  </div>
                ) : null}
                {previewScene === "shop" && draft.banner.enabled ? (
                  <div className="rounded-lg border border-border px-3 py-2 text-xs">
                    {draft.banner.title || "Banner"}
                  </div>
                ) : null}
                {previewScene === "shop" ? (
                  <Input readOnly value={draft.searchPlaceholder || "Artikel suchen …"} />
                ) : null}
                {(previewScene === "shop" || previewScene === "product"
                  ? previewScene === "product"
                    ? [{ name: "Semaglutide", variant: "5 mg", usd: 11.88 }]
                    : [
                        { name: "Semaglutide", variant: "5 mg", usd: 11.88 },
                        { name: "Retatrutide", variant: "10 mg", usd: 18.5 },
                        { name: "BAC Water", variant: "3 ml", usd: 6.25 },
                      ]
                  : []
                ).map((product) => (
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
                {previewScene === "kit" || previewScene === "shop" ? (
                  <div className="rounded-lg border border-border p-3" style={{ background: draft.tokens.surface || undefined }}>
                    <p className="text-sm font-medium">KPV</p>
                    <p className="text-xs text-muted-foreground">30 mg · 10 Vials</p>
                    <p className="mt-2 text-sm font-semibold">5 / 10 Kit</p>
                    <div className="my-2 h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full w-1/2 bg-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground">Noch 5 Plätze</p>
                    <p className="mt-2 text-xs text-muted-foreground">Dein Anteil</p>
                    <DualCurrencyPrice usd={45.85} rate={0.862} unit="Vial" size="compact" />
                    <p className="mt-2 text-[11px] text-muted-foreground">von @username</p>
                    <Button type="button" size="sm" className="mt-2">
                      Mitmachen
                    </Button>
                  </div>
                ) : null}
                {previewScene === "join" ? (
                  <div className="rounded-lg border border-border p-3" style={{ background: draft.tokens.surface || undefined }}>
                    <p className="text-sm font-semibold">Kit teilen</p>
                    <p className="text-xs text-muted-foreground">KPV · 30 mg · Noch 5 verfügbar</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((qty) => (
                        <span key={qty} className="min-w-11 rounded-md border border-border px-2 py-1 text-center text-xs">
                          {qty}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">Dein Anteil</p>
                    <DualCurrencyPrice usd={45.85} rate={0.862} size="summary" />
                    <p className="mt-1 text-xs text-muted-foreground">Du zahlst nur für deinen Anteil.</p>
                    <Button type="button" size="sm" className="mt-3">
                      Kit beitreten
                    </Button>
                  </div>
                ) : null}
                {previewScene === "shop" ? (
                  <p className="text-xs text-muted-foreground">
                    {draft.emptyTitle || "Dieser Bereich wird gerade vorbereitet."}
                  </p>
                ) : null}
                </>
                ) : null}
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
  const picker = normalizeHexColor(value) ?? "#111111";
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} wählen`}
          value={picker}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-11 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0"
        />
        <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="optional #d4af37" />
      </div>
      <p className="text-[11px] text-muted-foreground">{usage}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ImageField({
  label,
  areaKey,
  kind,
  value,
  onChange,
}: {
  label: string;
  areaKey: string;
  kind: Parameters<typeof uploadAreaDesignImage>[1];
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const preview = value
    ? value.startsWith("http") || value.startsWith("data:") || value.startsWith("/")
      ? value
      : siteDesignImageUrl(value)
    : null;

  async function onFile(file: File | undefined) {
    if (!file) return;
    const type = file.type.toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) {
      toast.error("Dateityp wird nicht unterstützt.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Bild ist zu groß.");
      return;
    }
    setBusy(true);
    try {
      const previous = value;
      const path = await uploadAreaDesignImage(areaKey, kind, file);
      onChange(path);
      if (previous && previous !== path && !previous.startsWith("http")) {
        await deleteSiteDesignImage(previous);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bild konnte nicht hochgeladen werden.";
      toast.error(/too large|größer|size/i.test(message) ? "Bild ist zu groß." : message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label={label} hint="JPG, PNG oder WEBP. Nur Darstellung.">
      <div
        className="rounded-md border border-dashed border-border px-3 py-3"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void onFile(event.dataTransfer.files?.[0]);
        }}
      >
        {preview ? <img src={preview} alt="" className="mb-2 h-16 w-full rounded-md object-cover" /> : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Wird geladen …" : preview ? "Bild ersetzen" : "Bild hochladen"}
          </Button>
          {value ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                if (value && !value.startsWith("http")) void deleteSiteDesignImage(value);
                onChange("");
              }}
            >
              Entfernen
            </Button>
          ) : null}
        </div>
      </div>
    </Field>
  );
}

function StatusChip({ ok, on, off }: { ok: boolean; on: string; off: string }) {
  return (
    <span className={ok ? "rounded-full bg-primary/15 px-2 py-0.5 text-primary" : "rounded-full bg-muted px-2 py-0.5 text-muted-foreground"}>
      {ok ? on : off}
    </span>
  );
}
