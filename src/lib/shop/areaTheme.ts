import type { CSSProperties } from "react";

export interface AreaThemeTokens {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  heading: string;
  price: string;
  border: string;
  button: string;
  buttonText: string;
  mutedText: string;
}

export interface AreaBackgroundConfig {
  mode: "global" | "color" | "gradient" | "image";
  color: string;
  gradient: string;
  desktopImage: string;
  tabletImage: string;
  mobileImage: string;
  overlay: boolean;
  overlayStrength: number;
  position: string;
  scale: "cover" | "contain";
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  attachment: "scroll" | "fixed";
}

export interface AreaHeroConfig {
  enabled: boolean;
  desktopImage: string;
  mobileImage: string;
  title: string;
  subtitle: string;
  description: string;
  buttonText: string;
  buttonHref: string;
  alignment: "left" | "center" | "right";
  variant: "centered" | "left" | "right" | "split" | "minimal";
  overlayStrength: number;
  height: "compact" | "standard" | "tall";
}

export interface AreaBannerConfig {
  enabled: boolean;
  title: string;
  description: string;
  buttonText: string;
  buttonHref: string;
}

export interface AreaThemeConfig {
  enabled: boolean;
  density: "compact" | "balanced" | "spacious";
  contentWidth: "narrow" | "standard" | "wide" | "full";
  priceEmphasis: "standard" | "prominent" | "luxury";
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
  tokens: Partial<AreaThemeTokens>;
  background: AreaBackgroundConfig;
  hero: AreaHeroConfig;
  banner: AreaBannerConfig;
  hub: { title: string; description: string; image: string };
  categories: { display: "pills" | "tabs" | "cards" | "buttons" | "minimal" };
  products: { layout: "table" | "cards" | "hybrid"; radius: "sm" | "md" | "lg"; shadow: boolean };
  cards: { radius: "sm" | "md" | "lg"; border: boolean; shadow: boolean };
  buttons: { radius: "sm" | "md" | "lg" | "full" };
  typography: { scale: "sm" | "md" | "lg" };
  mobile: { heroHeight: "compact" | "standard" };
}

export const EMPTY_AREA_BACKGROUND: AreaBackgroundConfig = {
  mode: "global",
  color: "",
  gradient: "",
  desktopImage: "",
  tabletImage: "",
  mobileImage: "",
  overlay: true,
  overlayStrength: 40,
  position: "center",
  scale: "cover",
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  attachment: "scroll",
};

export const EMPTY_AREA_HERO: AreaHeroConfig = {
  enabled: false,
  desktopImage: "",
  mobileImage: "",
  title: "",
  subtitle: "",
  description: "",
  buttonText: "",
  buttonHref: "",
  alignment: "left",
  variant: "minimal",
  overlayStrength: 45,
  height: "standard",
};

export const EMPTY_AREA_BANNER: AreaBannerConfig = {
  enabled: false,
  title: "",
  description: "",
  buttonText: "",
  buttonHref: "",
};

export const EMPTY_AREA_THEME: AreaThemeConfig = {
  enabled: false,
  density: "balanced",
  contentWidth: "standard",
  priceEmphasis: "standard",
  searchPlaceholder: "",
  emptyTitle: "",
  emptyDescription: "",
  tokens: {},
  background: EMPTY_AREA_BACKGROUND,
  hero: EMPTY_AREA_HERO,
  banner: EMPTY_AREA_BANNER,
  hub: { title: "", description: "", image: "" },
  categories: { display: "pills" },
  products: { layout: "hybrid", radius: "md", shadow: false },
  cards: { radius: "md", border: true, shadow: false },
  buttons: { radius: "md" },
  typography: { scale: "md" },
  mobile: { heroHeight: "compact" },
};

export const AREA_THEME_PRESETS: Record<string, Partial<AreaThemeTokens>> = {
  "peptix-default": {},
  midnight: { primary: "#d4af37", accent: "#1e3a5f", background: "#070b14", surface: "#101826", text: "#e8e4dc", heading: "#f5f0e6", price: "#d4af37", button: "#d4af37", buttonText: "#1a1408", border: "#2a3344" },
  "midnight-blue": { primary: "#d4af37", accent: "#152a4a", background: "#070b16", surface: "#101828", text: "#e8e4dc", heading: "#f5f0e6", price: "#d4af37", button: "#d4af37", buttonText: "#1a1408", border: "#243044" },
  "midnight-violet": { primary: "#d4af37", accent: "#3b1d4a", background: "#120814", surface: "#1c1022", text: "#eee6f2", heading: "#f7f0fb", price: "#d4af37", button: "#d4af37", buttonText: "#1a1408", border: "#3a2744" },
  "dark-luxury": { primary: "#c9a227", accent: "#1a1a1a", background: "#0a0a0a", surface: "#141414", text: "#e8e4dc", heading: "#f3efe6", price: "#c9a227", button: "#c9a227", buttonText: "#1a1408", border: "#2a2a2a" },
  "gold-luxury": { primary: "#e0c068", accent: "#3a2a0a", background: "#0c0a06", surface: "#16130c", text: "#f0e6c8", heading: "#f7efd4", price: "#e0c068", button: "#e0c068", buttonText: "#1a1408", border: "#3a3018" },
  science: { primary: "#7dd3c0", accent: "#12332e", background: "#06110f", surface: "#0d1c19", text: "#dceee9", heading: "#eef8f4", price: "#7dd3c0", button: "#7dd3c0", buttonText: "#06201a", border: "#1d3a34" },
  accessories: { primary: "#d4af37", accent: "#1a3d2a", background: "#07140d", surface: "#102018", text: "#e6efe8", heading: "#f2f7f3", price: "#d4af37", button: "#d4af37", buttonText: "#1a1408", border: "#244433" },
  labor: { primary: "#8ab4f8", accent: "#1a2744", background: "#070b14", surface: "#10182a", text: "#dce4f5", heading: "#eef3fb", price: "#8ab4f8", button: "#8ab4f8", buttonText: "#071018", border: "#24344f" },
  minimal: { primary: "#e8e4dc", accent: "#2a2a2a", background: "#0e0e0e", surface: "#171717", text: "#e8e4dc", heading: "#f4f1ea", price: "#e8e4dc", button: "#e8e4dc", buttonText: "#111111", border: "#2e2e2e" },
  futuristic: { primary: "#67e8f9", accent: "#0b1f2a", background: "#05080c", surface: "#0c141c", text: "#d7eef3", heading: "#e8f8fb", price: "#67e8f9", button: "#67e8f9", buttonText: "#041018", border: "#1a3340" },
};

export const AREA_THEME_PRESET_LABELS: Record<string, string> = {
  "peptix-default": "PEPTIX Default",
  midnight: "Midnight",
  "midnight-blue": "Midnight Blue",
  "midnight-violet": "Midnight Violet",
  "dark-luxury": "Dark Luxury",
  "gold-luxury": "Gold Luxury",
  science: "Science",
  accessories: "Accessories",
  labor: "Labor",
  minimal: "Minimal",
  futuristic: "Futuristic",
};

export const COLOR_FIELD_USAGE: Record<keyof AreaThemeTokens, string> = {
  primary: "Buttons, aktive Elemente, Highlights",
  secondary: "Sekundäre Flächen",
  accent: "Icons und Akzente",
  background: "Seitenhintergrund",
  surface: "Karten und Tabellen",
  text: "Fließtext",
  heading: "Überschriften",
  price: "EUR-Preis",
  border: "Rahmen und Trenner",
  button: "Primärbutton",
  buttonText: "Button-Beschriftung",
  mutedText: "Hinweise und Untertitel",
};

export const COLOR_FIELD_LABELS: Record<keyof AreaThemeTokens, string> = {
  primary: "Hauptfarbe",
  secondary: "Zweitfarbe",
  accent: "Akzentfarbe",
  background: "Hintergrund",
  surface: "Karten",
  text: "Text",
  heading: "Überschrift",
  price: "Preis",
  border: "Rahmen",
  button: "Button",
  buttonText: "Button-Text",
  mutedText: "Hinweistext",
};

export const BASIC_COLOR_KEYS: Array<keyof AreaThemeTokens> = [
  "primary",
  "accent",
  "background",
  "surface",
  "text",
  "heading",
  "price",
  "button",
];

export const ADVANCED_COLOR_KEYS: Array<keyof AreaThemeTokens> = [
  "secondary",
  "border",
  "buttonText",
  "mutedText",
];

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function normalizeHexColor(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
  return match ? `#${match[1].toLowerCase()}` : null;
}

function mixHex(hex: string, toward: string, amount: number): string {
  const a = normalizeHexColor(hex);
  const b = normalizeHexColor(toward);
  if (!a || !b) return hex;
  const parse = (h: string) => Number.parseInt(h.slice(1), 16);
  const left = parse(a);
  const right = parse(b);
  const mix = (shift: number) =>
    clampByte((((left >> shift) & 255) * (1 - amount) + ((right >> shift) & 255) * amount));
  return `#${[16, 8, 0].map((shift) => mix(shift).toString(16).padStart(2, "0")).join("")}`;
}

/** Deterministic dark premium palette from one primary color. */
export function paletteFromPrimary(hex: string): Partial<AreaThemeTokens> {
  const primary = normalizeHexColor(hex) ?? "#d4af37";
  return {
    primary,
    accent: mixHex(primary, "#0b1a14", 0.72),
    background: mixHex(primary, "#05080c", 0.92),
    surface: mixHex(primary, "#10141a", 0.82),
    text: "#e8e4dc",
    heading: "#f5f0e6",
    price: primary,
    border: mixHex(primary, "#1c2430", 0.7),
    button: primary,
    buttonText: "#1a1408",
    mutedText: "#b8b2a6",
    secondary: mixHex(primary, "#1a1a1a", 0.75),
  };
}

export function improveThemeContrast(theme: AreaThemeConfig): AreaThemeConfig {
  const button = theme.tokens.button || theme.tokens.primary || "#d4af37";
  const lum = relativeLuminance(button);
  const buttonText = lum != null && lum > 0.4 ? "#1a1408" : "#f7f4ee";
  return {
    ...theme,
    tokens: { ...theme.tokens, button, buttonText },
  };
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseBackground(raw: unknown): AreaBackgroundConfig {
  const row = asRecord(raw);
  const mode =
    row.mode === "color" || row.mode === "gradient" || row.mode === "image" ? row.mode : "global";
  return {
    ...EMPTY_AREA_BACKGROUND,
    mode,
    color: asString(row.color),
    gradient: asString(row.gradient),
    desktopImage: asString(row.desktopImage),
    tabletImage: asString(row.tabletImage),
    mobileImage: asString(row.mobileImage),
    overlay: row.overlay !== false,
    overlayStrength: asNumber(row.overlayStrength, EMPTY_AREA_BACKGROUND.overlayStrength),
    position: asString(row.position, "center"),
    scale: row.scale === "contain" ? "contain" : "cover",
    brightness: asNumber(row.brightness, 100),
    contrast: asNumber(row.contrast, 100),
    saturation: asNumber(row.saturation, 100),
    blur: asNumber(row.blur, 0),
    attachment: row.attachment === "fixed" ? "fixed" : "scroll",
  };
}

function parseHero(raw: unknown): AreaHeroConfig {
  const row = asRecord(raw);
  return {
    ...EMPTY_AREA_HERO,
    enabled: row.enabled === true,
    desktopImage: asString(row.desktopImage),
    mobileImage: asString(row.mobileImage),
    title: asString(row.title),
    subtitle: asString(row.subtitle),
    description: asString(row.description),
    buttonText: asString(row.buttonText),
    buttonHref: asString(row.buttonHref),
    alignment: row.alignment === "center" || row.alignment === "right" ? row.alignment : "left",
    variant:
      row.variant === "centered" || row.variant === "left" || row.variant === "right" || row.variant === "split"
        ? row.variant
        : "minimal",
    overlayStrength: asNumber(row.overlayStrength, EMPTY_AREA_HERO.overlayStrength),
    height: row.height === "compact" || row.height === "tall" ? row.height : "standard",
  };
}

export function parseAreaTheme(raw: unknown): AreaThemeConfig {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const tokensRaw = row.tokens && typeof row.tokens === "object" ? (row.tokens as Record<string, unknown>) : {};
  const density = row.density === "compact" || row.density === "spacious" ? row.density : "balanced";
  const contentWidth =
    row.contentWidth === "narrow" || row.contentWidth === "wide" || row.contentWidth === "full"
      ? row.contentWidth
      : "standard";
  const priceEmphasis =
    row.priceEmphasis === "prominent" || row.priceEmphasis === "luxury" ? row.priceEmphasis : "standard";
  const hub = asRecord(row.hub);
  const categories = asRecord(row.categories);
  const products = asRecord(row.products);
  const cards = asRecord(row.cards);
  const buttons = asRecord(row.buttons);
  const typography = asRecord(row.typography);
  const mobile = asRecord(row.mobile);
  const banner = asRecord(row.banner);
  return {
    enabled: row.enabled === true,
    density,
    contentWidth,
    priceEmphasis,
    searchPlaceholder: asString(row.searchPlaceholder),
    emptyTitle: asString(row.emptyTitle),
    emptyDescription: asString(row.emptyDescription),
    tokens: {
      primary: asString(tokensRaw.primary),
      secondary: asString(tokensRaw.secondary),
      accent: asString(tokensRaw.accent),
      background: asString(tokensRaw.background),
      surface: asString(tokensRaw.surface),
      text: asString(tokensRaw.text),
      heading: asString(tokensRaw.heading),
      price: asString(tokensRaw.price),
      border: asString(tokensRaw.border),
      button: asString(tokensRaw.button),
      buttonText: asString(tokensRaw.buttonText),
      mutedText: asString(tokensRaw.mutedText),
    },
    background: parseBackground(row.background),
    hero: parseHero(row.hero),
    banner: {
      enabled: banner.enabled === true,
      title: asString(banner.title),
      description: asString(banner.description),
      buttonText: asString(banner.buttonText),
      buttonHref: asString(banner.buttonHref),
    },
    hub: {
      title: asString(hub.title),
      description: asString(hub.description),
      image: asString(hub.image),
    },
    categories: {
      display:
        categories.display === "tabs" ||
        categories.display === "cards" ||
        categories.display === "buttons" ||
        categories.display === "minimal"
          ? categories.display
          : "pills",
    },
    products: {
      layout: products.layout === "table" || products.layout === "cards" ? products.layout : "hybrid",
      radius: products.radius === "sm" || products.radius === "lg" ? products.radius : "md",
      shadow: products.shadow === true,
    },
    cards: {
      radius: cards.radius === "sm" || cards.radius === "lg" ? cards.radius : "md",
      border: cards.border !== false,
      shadow: cards.shadow === true,
    },
    buttons: {
      radius:
        buttons.radius === "sm" || buttons.radius === "lg" || buttons.radius === "full" ? buttons.radius : "md",
    },
    typography: {
      scale: typography.scale === "sm" || typography.scale === "lg" ? typography.scale : "md",
    },
    mobile: {
      heroHeight: mobile.heroHeight === "standard" ? "standard" : "compact",
    },
  };
}

export function areaBackgroundStyle(theme: AreaThemeConfig, viewport: "desktop" | "tablet" | "mobile" = "desktop"): CSSProperties {
  if (!theme.enabled || theme.background.mode === "global") return {};
  const bg = theme.background;
  const image =
    viewport === "mobile"
      ? bg.mobileImage || bg.tabletImage || bg.desktopImage
      : viewport === "tablet"
        ? bg.tabletImage || bg.desktopImage
        : bg.desktopImage;
  const style: CSSProperties = {};
  if (bg.mode === "color" && bg.color) style.background = bg.color;
  if (bg.mode === "gradient" && bg.gradient) style.backgroundImage = bg.gradient;
  if (bg.mode === "image" && image) {
    style.backgroundImage = `url(${image.startsWith("http") || image.startsWith("data:") || image.startsWith("/") ? image : image})`;
    style.backgroundSize = bg.scale;
    style.backgroundPosition = bg.position || "center";
    style.backgroundAttachment = bg.attachment;
    style.backgroundRepeat = "no-repeat";
    style.filter = `brightness(${bg.brightness}%) contrast(${bg.contrast}%) saturate(${bg.saturation}%) blur(${bg.blur}px)`;
  }
  return style;
}

/** Converts #rrggbb (or existing "H S% L%") into the shadcn HSL channel triple. */
export function colorToHslChannels(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^#?([0-9a-f]{6})$/i);
  if (!match) return null;
  const n = Number.parseInt(match[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function relativeLuminance(hex: string): number | null {
  const match = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) return null;
  const n = Number.parseInt(match[1], 16);
  const channel = (shift: number) => {
    const c = ((n >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

export function areaThemeContrastWarning(theme: AreaThemeConfig): string | null {
  if (!theme.enabled) return null;
  const fg = theme.tokens.buttonText || theme.tokens.text;
  const bg = theme.tokens.button || theme.tokens.primary || theme.tokens.background;
  if (!fg || !bg) return null;
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  if (l1 == null || l2 == null) return null;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  if (ratio >= 4.5) return null;
  return `Kontrast ${ratio.toFixed(1)}:1 liegt unter 4,5:1. Farben prüfen.`;
}

export function areaThemeCssVars(theme: AreaThemeConfig): CSSProperties {
  if (!theme.enabled) return {};
  const t = theme.tokens;
  const vars: Record<string, string> = {};
  if (t.primary) vars["--area-primary"] = t.primary;
  if (t.secondary) vars["--area-secondary"] = t.secondary;
  if (t.accent) vars["--area-accent"] = t.accent;
  if (t.background) vars["--area-background"] = t.background;
  if (t.surface) vars["--area-surface"] = t.surface;
  if (t.text) vars["--area-text"] = t.text;
  if (t.heading) vars["--area-heading"] = t.heading;
  if (t.price) vars["--area-price"] = t.price;
  if (t.border) vars["--area-border"] = t.border;
  if (t.button) vars["--area-button"] = t.button;
  if (t.buttonText) vars["--area-button-text"] = t.buttonText;
  if (t.mutedText) vars["--area-muted"] = t.mutedText;

  const primary = colorToHslChannels(t.button || t.primary);
  if (primary) {
    vars["--primary"] = primary;
    vars["--ring"] = primary;
  }
  const primaryFg = colorToHslChannels(t.buttonText);
  if (primaryFg) vars["--primary-foreground"] = primaryFg;
  const accent = colorToHslChannels(t.accent);
  if (accent) vars["--accent"] = accent;
  const background = colorToHslChannels(t.background);
  if (background) vars["--background"] = background;
  const surface = colorToHslChannels(t.surface);
  if (surface) vars["--card"] = surface;
  const text = colorToHslChannels(t.text);
  if (text) {
    vars["--foreground"] = text;
    vars["--card-foreground"] = text;
  }
  const heading = colorToHslChannels(t.heading);
  if (heading) vars["--card-foreground"] = heading;
  const border = colorToHslChannels(t.border);
  if (border) {
    vars["--border"] = border;
    vars["--input"] = border;
  }
  const muted = colorToHslChannels(t.mutedText);
  if (muted) vars["--muted-foreground"] = muted;
  const secondary = colorToHslChannels(t.secondary);
  if (secondary) vars["--secondary"] = secondary;
  return vars as CSSProperties;
}

export function areaDensityClass(theme: AreaThemeConfig): string {
  if (theme.density === "compact") return "space-y-4";
  if (theme.density === "spacious") return "space-y-10";
  return "space-y-6";
}

export function areaWidthClass(theme: AreaThemeConfig): string {
  if (theme.contentWidth === "narrow") return "mx-auto max-w-3xl";
  if (theme.contentWidth === "wide") return "mx-auto max-w-7xl";
  if (theme.contentWidth === "full") return "w-full";
  return "mx-auto max-w-6xl";
}
