import type { CSSProperties } from "react";

export interface SiteDesignLayer {
  imagePath: string | null;
  enabled: boolean;
  focalX: number;
  focalY: number;
  size: "cover" | "contain";
  scale: number;
  overlay: boolean;
  overlayOpacity: number;
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  opacity: number;
  attachment: "fixed" | "scroll";
}

export interface SiteDesignConfig {
  desktop: SiteDesignLayer;
  tablet: SiteDesignLayer;
  mobile: SiteDesignLayer;
  inheritTabletFromDesktop: boolean;
  inheritMobileFromDesktop: boolean;
}

export const DEFAULT_SITE_DESIGN_LAYER: SiteDesignLayer = {
  imagePath: null,
  enabled: true,
  focalX: 50,
  focalY: 40,
  size: "cover",
  scale: 100,
  overlay: true,
  overlayOpacity: 55,
  brightness: 82,
  contrast: 100,
  saturation: 100,
  blur: 0,
  opacity: 100,
  attachment: "scroll",
};

export const EMPTY_SITE_DESIGN: SiteDesignConfig = {
  desktop: { ...DEFAULT_SITE_DESIGN_LAYER },
  tablet: { ...DEFAULT_SITE_DESIGN_LAYER },
  mobile: { ...DEFAULT_SITE_DESIGN_LAYER, attachment: "scroll", focalY: 35 },
  inheritTabletFromDesktop: true,
  inheritMobileFromDesktop: false,
};

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function asLayer(raw: unknown, fallback: SiteDesignLayer): SiteDesignLayer {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const row = raw as Record<string, unknown>;
  return {
    imagePath: typeof row.imagePath === "string" && row.imagePath.trim() ? row.imagePath.trim() : null,
    enabled: row.enabled !== false,
    focalX: clamp(Number(row.focalX ?? fallback.focalX), 0, 100),
    focalY: clamp(Number(row.focalY ?? fallback.focalY), 0, 100),
    size: row.size === "contain" ? "contain" : "cover",
    scale: clamp(Number(row.scale ?? fallback.scale), 80, 140),
    overlay: row.overlay !== false,
    overlayOpacity: clamp(Number(row.overlayOpacity ?? fallback.overlayOpacity), 0, 85),
    brightness: clamp(Number(row.brightness ?? fallback.brightness), 40, 120),
    contrast: clamp(Number(row.contrast ?? fallback.contrast), 70, 130),
    saturation: clamp(Number(row.saturation ?? fallback.saturation), 0, 140),
    blur: clamp(Number(row.blur ?? fallback.blur), 0, 16),
    opacity: clamp(Number(row.opacity ?? fallback.opacity), 20, 100),
    attachment: row.attachment === "fixed" ? "fixed" : "scroll",
  };
}

export function parseSiteDesignConfig(raw: unknown): SiteDesignConfig {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const desktop = asLayer(row.desktop, EMPTY_SITE_DESIGN.desktop);
  const tablet = asLayer(row.tablet, desktop);
  const mobile = asLayer(row.mobile, EMPTY_SITE_DESIGN.mobile);
  return {
    desktop,
    tablet,
    mobile,
    inheritTabletFromDesktop: row.inheritTabletFromDesktop !== false,
    inheritMobileFromDesktop: row.inheritMobileFromDesktop === true,
  };
}

export function resolvedDesignLayer(
  config: SiteDesignConfig,
  viewport: "desktop" | "tablet" | "mobile",
): SiteDesignLayer {
  if (viewport === "desktop") return config.desktop;
  if (viewport === "tablet") {
    const layer = config.inheritTabletFromDesktop ? { ...config.desktop, ...pickDeviceOverrides(config.tablet) } : config.tablet;
    return layer.imagePath ? layer : { ...config.desktop, ...layer, imagePath: config.desktop.imagePath };
  }
  const layer = config.inheritMobileFromDesktop ? { ...config.desktop, ...pickDeviceOverrides(config.mobile) } : config.mobile;
  return layer.imagePath ? layer : { ...layer, imagePath: config.desktop.imagePath };
}

function pickDeviceOverrides(layer: SiteDesignLayer): Partial<SiteDesignLayer> {
  return {
    focalX: layer.focalX,
    focalY: layer.focalY,
    size: layer.size,
    scale: layer.scale,
    overlay: layer.overlay,
    overlayOpacity: layer.overlayOpacity,
    brightness: layer.brightness,
    contrast: layer.contrast,
    saturation: layer.saturation,
    blur: layer.blur,
    opacity: layer.opacity,
    attachment: layer.attachment,
    enabled: layer.enabled,
  };
}

export function designHasVisibleBackground(enabled: boolean, config: SiteDesignConfig): boolean {
  if (!enabled) return false;
  return (["desktop", "tablet", "mobile"] as const).some((viewport) => {
    const layer = resolvedDesignLayer(config, viewport);
    return Boolean(layer.enabled && layer.imagePath);
  });
}

export function layerCss(layer: SiteDesignLayer, imageUrl: string | null): CSSProperties {
  if (!imageUrl || !layer.enabled) return { display: "none" };
  return {
    backgroundImage: `url("${imageUrl}")`,
    backgroundSize: layer.size,
    backgroundPosition: `${layer.focalX}% ${layer.focalY}%`,
    backgroundRepeat: "no-repeat",
    backgroundAttachment: layer.attachment,
    opacity: layer.opacity / 100,
    filter: `brightness(${layer.brightness}%) contrast(${layer.contrast}%) saturate(${layer.saturation}%) blur(${layer.blur}px)`,
    transform: layer.scale === 100 ? undefined : `scale(${layer.scale / 100})`,
    transformOrigin: `${layer.focalX}% ${layer.focalY}%`,
  };
}
