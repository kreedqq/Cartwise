import type { CSSProperties } from "react";

import { normalizeHexColor } from "@/lib/shop/areaTheme";
import { siteDesignImageUrl } from "@/services/siteDesign";

/** Canonical fallback product hero (supplied PEPTIX vial reference). */
export const PEPTIX_CANONICAL_VIAL_PATH = "/shop/peptix-vial-canonical.jpg";

export type PortalAtmosphere = "void" | "energy" | "molecule" | "calm";

export interface AreaPortalConfig {
  enabled: boolean;
  accent: string;
  /** 0–100 */
  glow: number;
  atmosphere: PortalAtmosphere;
  backgroundImage: string;
  /** Optional focal portal image (orb), not full-bleed wallpaper */
  image: string;
}

export const EMPTY_AREA_PORTAL: AreaPortalConfig = {
  enabled: true,
  accent: "",
  glow: 55,
  atmosphere: "energy",
  backgroundImage: "",
  image: "",
};

export function parseAreaPortal(raw: unknown): AreaPortalConfig {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const atmosphere =
    row.atmosphere === "void" ||
    row.atmosphere === "molecule" ||
    row.atmosphere === "calm" ||
    row.atmosphere === "energy"
      ? row.atmosphere
      : "energy";
  return {
    enabled: row.enabled !== false,
    accent: typeof row.accent === "string" ? row.accent : "",
    glow: typeof row.glow === "number" && Number.isFinite(row.glow) ? Math.min(100, Math.max(0, row.glow)) : 55,
    atmosphere,
    backgroundImage: typeof row.backgroundImage === "string" ? row.backgroundImage : "",
    image: typeof row.image === "string" ? row.image : "",
  };
}

/** Per-area world identity when portal accent is unset (admin can override via theme.portal.accent). */
export function defaultPortalAccentForShopArea(areaKey: string): string | null {
  if (areaKey === "shop") return "#c9a227";
  if (areaKey === "group_buy_1") return "#45b7d1";
  if (areaKey === "group_buy_2") return "#7c6bff";
  return null;
}

export function resolvePortalAccent(
  portal: AreaPortalConfig,
  themeAccent?: string,
  themePrimary?: string,
  areaKey?: string,
): string {
  const hex =
    normalizeHexColor(portal.accent) ||
    (areaKey ? defaultPortalAccentForShopArea(areaKey) : null) ||
    normalizeHexColor(themeAccent) ||
    normalizeHexColor(themePrimary) ||
    "#c9a227";
  return hex;
}

export function resolvePortalImageUrl(path: string | undefined): string | null {
  if (!path?.trim()) return null;
  if (path.startsWith("http") || path.startsWith("/")) return path;
  return siteDesignImageUrl(path);
}

/** CSS custom properties for portal + product stage accents. */
export function portalThemeCssVars(accentHex: string, glow: number): CSSProperties {
  const accent = normalizeHexColor(accentHex) || "#c9a227";
  const intensity = glow / 100;
  return {
    ["--portal-accent" as string]: accent,
    ["--portal-glow" as string]: String(intensity),
  };
}

export function portalAtmosphereLayers(atmosphere: PortalAtmosphere): string {
  switch (atmosphere) {
    case "void":
      return "opacity-90";
    case "molecule":
      return "opacity-95";
    case "calm":
      return "opacity-80";
    default:
      return "opacity-100";
  }
}

export function productStageBackgroundStyle(accentHex: string, glow: number): CSSProperties {
  const accent = normalizeHexColor(accentHex) || "#c9a227";
  const a = 0.12 + (glow / 100) * 0.22;
  return {
    backgroundImage: `radial-gradient(ellipse 90% 75% at 50% 42%, color-mix(in srgb, ${accent} ${Math.round(a * 100)}%, transparent), transparent 72%), radial-gradient(circle at 50% 100%, hsl(var(--background) / 0.85), transparent 55%), linear-gradient(180deg, hsl(var(--card) / 0.08) 0%, hsl(var(--background) / 0.55) 100%)`,
  };
}
