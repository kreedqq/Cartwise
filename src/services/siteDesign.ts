import { SITE_DESIGN_BUCKET } from "@/lib/constants";
import { EMPTY_DESIGN_STUDIO, parseDesignStudioConfig, type DesignStudioConfig } from "@/lib/designStudio";
import { EMPTY_SITE_DESIGN, parseSiteDesignConfig, type SiteDesignConfig } from "@/lib/siteDesign";
import { publicMediaUrl, removeStorageObject, uploadPrivateOrPublicImage } from "@/services/mediaStorage";
import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/types/database";

export type SiteDesignSettings = Tables<"site_design_settings">;

export type SiteDesignSettingsView = {
  enabled: boolean;
  config: SiteDesignConfig;
  /** Full persisted JSON (background layers + designStudio). */
  configRecord: Record<string, unknown>;
  designStudio: DesignStudioConfig;
};

export async function getSiteDesignSettings(): Promise<SiteDesignSettingsView> {
  const { data, error } = await supabase.from("site_design_settings").select("*").eq("id", true).maybeSingle();
  if (error) throw error;
  if (!data) {
    return {
      enabled: false,
      config: EMPTY_SITE_DESIGN,
      configRecord: {},
      designStudio: { ...EMPTY_DESIGN_STUDIO },
    };
  }
  const configRecord =
    data.config && typeof data.config === "object" ? { ...(data.config as Record<string, unknown>) } : {};
  return {
    enabled: data.enabled,
    config: parseSiteDesignConfig(configRecord),
    configRecord,
    designStudio: parseDesignStudioConfig(configRecord),
  };
}

export async function saveSiteDesignSettings(input: { enabled: boolean; config: SiteDesignConfig }): Promise<void> {
  const { error } = await supabase
    .from("site_design_settings")
    .upsert({
      id: true,
      enabled: input.enabled,
      config: input.config as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
}

export async function uploadAreaDesignImage(
  areaKey: string,
  kind: "background" | "hero" | "hub" | "banner" | "mobile" | "background-tablet" | "background-mobile" | "hero-mobile",
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() === "png" ? "png" : file.name.toLowerCase().endsWith(".webp") ? "webp" : "jpg";
  const path = `areas/${areaKey}/${kind}-${crypto.randomUUID()}.${ext}`;
  return uploadPrivateOrPublicImage({
    bucket: SITE_DESIGN_BUCKET,
    path,
    file,
    maxBytes: 8 * 1024 * 1024,
    minWidth: 320,
    minHeight: 180,
  });
}

export async function uploadDesignStudioCategoryImage(categoryKey: string, file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  const ext = lower.endsWith(".png") ? "png" : lower.endsWith(".webp") ? "webp" : "jpg";
  const safeKey = categoryKey.replace(/[^a-z0-9-]/gi, "");
  const path = `design-studio/categories/${safeKey}/${crypto.randomUUID()}.${ext}`;
  return uploadPrivateOrPublicImage({
    bucket: SITE_DESIGN_BUCKET,
    path,
    file,
    maxBytes: 8 * 1024 * 1024,
    minWidth: 400,
    minHeight: 400,
  });
}

export async function uploadDesignStudioVial(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  const ext = lower.endsWith(".png") ? "png" : lower.endsWith(".webp") ? "webp" : "jpg";
  const path = `design-studio/vials/${crypto.randomUUID()}.${ext}`;
  return uploadPrivateOrPublicImage({
    bucket: SITE_DESIGN_BUCKET,
    path,
    file,
    maxBytes: 8 * 1024 * 1024,
    minWidth: 120,
    minHeight: 120,
  });
}

export async function uploadDesignStudioCustomPortal(file: File): Promise<string> {
  const ext = file.name.toLowerCase().endsWith(".png") ? "png" : "webp";
  const path = `design-studio/portals/${crypto.randomUUID()}.${ext}`;
  return uploadPrivateOrPublicImage({
    bucket: SITE_DESIGN_BUCKET,
    path,
    file,
    maxBytes: 8 * 1024 * 1024,
    minWidth: 256,
    minHeight: 256,
  });
}

export async function uploadSiteDesignImage(device: "desktop" | "tablet" | "mobile", file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() === "png" ? "png" : file.name.toLowerCase().endsWith(".webp") ? "webp" : "jpg";
  const path = `${device}/${crypto.randomUUID()}.${ext}`;
  return uploadPrivateOrPublicImage({
    bucket: SITE_DESIGN_BUCKET,
    path,
    file,
    maxBytes: 8 * 1024 * 1024,
    minWidth: 640,
    minHeight: 640,
  });
}

export async function deleteSiteDesignImage(path: string | null): Promise<void> {
  await removeStorageObject(SITE_DESIGN_BUCKET, path);
}

export function siteDesignImageUrl(path: string | null | undefined): string | null {
  return publicMediaUrl(SITE_DESIGN_BUCKET, path);
}
