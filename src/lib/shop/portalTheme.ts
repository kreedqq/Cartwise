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
  /** Optional focal portal image (orb), not full-bleed wallpaper — legacy */
  image: string;
  /** Built-in portal asset id (portal_blue, portal_gold, …) */
  assetId: string;
  /** Admin-uploaded portal asset (site-design path or URL) */
  customAsset: string;
}

export const EMPTY_AREA_PORTAL: AreaPortalConfig = {
  enabled: true,
  accent: "",
  glow: 55,
  atmosphere: "energy",
  backgroundImage: "",
  image: "",
  assetId: "",
  customAsset: "",
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
    assetId: typeof row.assetId === "string" ? row.assetId : "",
    customAsset: typeof row.customAsset === "string" ? row.customAsset : "",
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
  const a = 0.14 + (glow / 100) * 0.26;
  return {
    backgroundColor: "#060608",
    backgroundImage: `radial-gradient(ellipse 85% 70% at 50% 38%, color-mix(in srgb, ${accent} ${Math.round(a * 100)}%, transparent), transparent 68%), radial-gradient(circle at 18% 12%, color-mix(in srgb, ${accent} 12%, transparent), transparent 42%), linear-gradient(165deg, #0c0a08 0%, #050506 45%, #020203 100%), repeating-linear-gradient(125deg, rgba(201,162,39,0.04) 0px, rgba(201,162,39,0.04) 1px, transparent 1px, transparent 9px)`,
  };
}
