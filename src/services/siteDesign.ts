import { SITE_DESIGN_BUCKET } from "@/lib/constants";
import { EMPTY_SITE_DESIGN, parseSiteDesignConfig, type SiteDesignConfig } from "@/lib/siteDesign";
import { publicMediaUrl, removeStorageObject, uploadPrivateOrPublicImage } from "@/services/mediaStorage";
import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/types/database";

export type SiteDesignSettings = Tables<"site_design_settings">;

export async function getSiteDesignSettings(): Promise<{ enabled: boolean; config: SiteDesignConfig }> {
  const { data, error } = await supabase.from("site_design_settings").select("*").eq("id", true).maybeSingle();
  if (error) throw error;
  if (!data) return { enabled: false, config: EMPTY_SITE_DESIGN };
  return { enabled: data.enabled, config: parseSiteDesignConfig(data.config) };
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
