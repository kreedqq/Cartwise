import { siteDesignImageUrl } from "@/services/siteDesign";

/** Built-in dimensional portal art (transparent PNG). */
export type BuiltinPortalAssetId =
  | "portal_blue"
  | "portal_purple"
  | "portal_green"
  | "portal_red"
  | "portal_orange"
  | "portal_gold"
  | "portal_pink"
  | "portal_cyan";

export interface PortalAssetDefinition {
  id: BuiltinPortalAssetId;
  label: string;
  colorLabel: string;
  /** Suggested accent when this asset is selected */
  accentHex: string;
  /** Public path under /shop/portals/ */
  path: string;
  builtin: true;
  previewUrl: string;
  assetUrl: string;
}

function builtinPortal(
  id: BuiltinPortalAssetId,
  label: string,
  colorLabel: string,
  accentHex: string,
): PortalAssetDefinition {
  const path = `/shop/portals/${id}.png`;
  return { id, label, colorLabel, accentHex, path, builtin: true, previewUrl: path, assetUrl: path };
}

export const BUILTIN_PORTAL_ASSETS: PortalAssetDefinition[] = [
  builtinPortal("portal_blue", "Blue Portal", "Blau", "#3b82f6"),
  builtinPortal("portal_purple", "Purple Portal", "Violett", "#a855f7"),
  builtinPortal("portal_green", "Green Portal", "Grün", "#22c55e"),
  builtinPortal("portal_red", "Red Portal", "Rot", "#ef4444"),
  builtinPortal("portal_orange", "Orange Portal", "Orange", "#f97316"),
  builtinPortal("portal_gold", "Gold Portal", "Gold", "#c9a227"),
  builtinPortal("portal_pink", "Pink Portal", "Pink", "#ec4899"),
  builtinPortal("portal_cyan", "Cyan Portal", "Cyan", "#22d3ee"),
];

export const DEFAULT_PORTAL_ASSET_ID: BuiltinPortalAssetId = "portal_gold";

const BY_ID = new Map(BUILTIN_PORTAL_ASSETS.map((a) => [a.id, a]));

export function isBuiltinPortalAssetId(value: string): value is BuiltinPortalAssetId {
  return BY_ID.has(value as BuiltinPortalAssetId);
}

export function portalAssetById(id: string | undefined | null): PortalAssetDefinition | null {
  if (!id || !isBuiltinPortalAssetId(id)) return null;
  return BY_ID.get(id) ?? null;
}

export function resolvePortalAssetPublicUrl(input: {
  assetId?: string;
  customPath?: string;
  legacyOrbPath?: string;
}): string | null {
  if (input.customPath?.trim()) {
    const p = input.customPath.trim();
    if (p.startsWith("http") || p.startsWith("/")) return p;
    return siteDesignImageUrl(p);
  }
  const assetId = input.assetId?.trim();
  if (assetId) {
    const built = portalAssetById(assetId);
    if (built) return built.path;
  }
  if (input.legacyOrbPath?.trim()) {
    const p = input.legacyOrbPath.trim();
    if (p.startsWith("http") || p.startsWith("/")) return p;
    return siteDesignImageUrl(p);
  }
  return portalAssetById(DEFAULT_PORTAL_ASSET_ID)?.path ?? null;
}

export interface CategoryPortalOverride {
  assetId: string;
  customAsset: string;
}

export function parseCategoryPortalOverrides(raw: unknown): Record<string, CategoryPortalOverride> {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const src = row.categoryPortals;
  if (!src || typeof src !== "object") return {};
  const out: Record<string, CategoryPortalOverride> = {};
  for (const [key, value] of Object.entries(src as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    out[key] = {
      assetId: typeof v.assetId === "string" ? v.assetId : "",
      customAsset: typeof v.customAsset === "string" ? v.customAsset : "",
    };
  }
  return out;
}

export interface VialMediaConfig {
  areaImage: string;
  categoryImages: Record<string, string>;
}

export function parseVialMedia(raw: unknown): VialMediaConfig {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const src = row.vialMedia;
  if (!src || typeof src !== "object") {
    return { areaImage: "", categoryImages: {} };
  }
  const v = src as Record<string, unknown>;
  const categoryImages: Record<string, string> = {};
  if (v.categoryImages && typeof v.categoryImages === "object") {
    for (const [k, val] of Object.entries(v.categoryImages as Record<string, unknown>)) {
      if (typeof val === "string" && val.trim()) categoryImages[k] = val.trim();
    }
  }
  return {
    areaImage: typeof v.areaImage === "string" ? v.areaImage : "",
    categoryImages,
  };
}

export function resolveCategoryPortalAsset(
  categoryKey: string,
  areaPortal: { assetId?: string; customAsset?: string; image?: string },
  categoryOverrides: Record<string, CategoryPortalOverride>,
): string | null {
  const cat = categoryOverrides[categoryKey];
  if (cat && (cat.assetId?.trim() || cat.customAsset?.trim())) {
    const url = resolvePortalAssetPublicUrl({ assetId: cat.assetId, customPath: cat.customAsset });
    if (url) return url;
  }
  return resolvePortalAssetPublicUrl({
    assetId: areaPortal.assetId,
    customPath: areaPortal.customAsset,
    legacyOrbPath: areaPortal.image,
  });
}
