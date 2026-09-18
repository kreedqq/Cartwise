/** Visual asset metadata stored inside site_design_settings.config (additive JSON). */
export interface VialLibraryEntry {
  id: string;
  name: string;
  path: string;
  uploadedAt?: string;
}

export interface DesignStudioConfig {
  vialLibrary: VialLibraryEntry[];
  /** site-design storage path — fallback before canonical vial */
  globalVialPath: string | null;
}

export const EMPTY_DESIGN_STUDIO: DesignStudioConfig = {
  vialLibrary: [],
  globalVialPath: null,
};

export function parseDesignStudioConfig(raw: unknown): DesignStudioConfig {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const studio = row.designStudio;
  if (!studio || typeof studio !== "object") return { ...EMPTY_DESIGN_STUDIO };
  const s = studio as Record<string, unknown>;
  const vialLibrary: VialLibraryEntry[] = [];
  if (Array.isArray(s.vialLibrary)) {
    for (const item of s.vialLibrary) {
      if (!item || typeof item !== "object") continue;
      const v = item as Record<string, unknown>;
      const id = typeof v.id === "string" ? v.id : "";
      const name = typeof v.name === "string" ? v.name : "";
      const path = typeof v.path === "string" ? v.path : "";
      if (id && path) {
        vialLibrary.push({
          id,
          name: name || id,
          path,
          uploadedAt: typeof v.uploadedAt === "string" ? v.uploadedAt : undefined,
        });
      }
    }
  }
  return {
    vialLibrary,
    globalVialPath:
      typeof s.globalVialPath === "string" && s.globalVialPath.trim() ? s.globalVialPath.trim() : null,
  };
}

export function mergeDesignStudioIntoConfig(
  rawConfig: unknown,
  studio: DesignStudioConfig,
): Record<string, unknown> {
  const base = rawConfig && typeof rawConfig === "object" ? { ...(rawConfig as Record<string, unknown>) } : {};
  return { ...base, designStudio: studio };
}

export const DESIGN_STUDIO_TABS = [
  { id: "overview", label: "Übersicht", to: "/admin/design-studio" },
  { id: "global", label: "Globales Design", to: "/admin/design-studio/global" },
  { id: "shop-areas", label: "Shop Bereiche", to: "/admin/shop-areas" },
  { id: "portals", label: "Portale", to: "/admin/design-studio/portals" },
  { id: "vials", label: "Vials", to: "/admin/design-studio/vials" },
  { id: "products", label: "Produktbilder", to: "/admin/products" },
  { id: "presets", label: "Presets", to: "/admin/shop-areas" },
] as const;
