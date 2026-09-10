import { ANNOUNCEMENT_MEDIA_BUCKET } from "@/lib/constants";
import { sortAnnouncementFeed } from "@/lib/announcements";
import { publicMediaUrl, removeStorageObject, uploadPrivateOrPublicImage } from "@/services/mediaStorage";
import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/types/database";

export type Announcement = Tables<"announcements">;

export interface AnnouncementInput {
  title: string;
  content: string;
  published?: boolean;
  pinned?: boolean;
  image_url?: string | null;
  image_path?: string | null;
  image_focal_x?: number;
  image_focal_y?: number;
  external_url?: string | null;
}

export async function listPublishedAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("published", true)
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false });
  if (error) throw error;
  return sortAnnouncementFeed(data ?? []);
}

export async function listAllAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createAnnouncement(input: AnnouncementInput): Promise<Announcement> {
  const { data, error } = await supabase
    .from("announcements")
    .insert(toRow(input))
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateAnnouncement(id: string, input: AnnouncementInput): Promise<Announcement> {
  const { data, error } = await supabase.from("announcements").update(toRow(input)).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function setAnnouncementPublished(id: string, published: boolean): Promise<void> {
  const { error } = await supabase.from("announcements").update({ published }).eq("id", id);
  if (error) throw error;
}

export async function deleteAnnouncement(row: Announcement): Promise<void> {
  const { error } = await supabase.from("announcements").delete().eq("id", row.id);
  if (error) throw error;
  await removeStorageObject(ANNOUNCEMENT_MEDIA_BUCKET, row.image_path).catch(() => undefined);
}

export async function uploadAnnouncementImage(announcementId: string, file: File): Promise<string> {
  const ext = file.name.toLowerCase().endsWith(".png") ? "png" : file.name.toLowerCase().endsWith(".webp") ? "webp" : "jpg";
  const path = `announcements/${announcementId}/${crypto.randomUUID()}.${ext}`;
  return uploadPrivateOrPublicImage({
    bucket: ANNOUNCEMENT_MEDIA_BUCKET,
    path,
    file,
    minWidth: 640,
    minHeight: 360,
  });
}

export async function replaceAnnouncementImage(
  row: Announcement,
  file: File,
  focalX = 50,
  focalY = 50,
): Promise<string> {
  const nextPath = await uploadAnnouncementImage(row.id, file);
  const { error } = await supabase
    .from("announcements")
    .update({
      image_path: nextPath,
      image_url: null,
      image_focal_x: focalX,
      image_focal_y: focalY,
    })
    .eq("id", row.id);
  if (error) {
    await removeStorageObject(ANNOUNCEMENT_MEDIA_BUCKET, nextPath).catch(() => undefined);
    throw error;
  }
  if (row.image_path && row.image_path !== nextPath) {
    await removeStorageObject(ANNOUNCEMENT_MEDIA_BUCKET, row.image_path).catch(() => undefined);
  }
  return nextPath;
}

export async function clearAnnouncementImage(row: Announcement): Promise<void> {
  const { error } = await supabase.from("announcements").update({ image_path: null }).eq("id", row.id);
  if (error) throw error;
  await removeStorageObject(ANNOUNCEMENT_MEDIA_BUCKET, row.image_path).catch(() => undefined);
}

export function announcementPublicUrl(path: string | null | undefined): string | null {
  return publicMediaUrl(ANNOUNCEMENT_MEDIA_BUCKET, path);
}

function toRow(input: AnnouncementInput) {
  return {
    title: input.title.trim(),
    content: input.content.trim(),
    published: input.published ?? false,
    pinned: input.pinned ?? false,
    image_url: emptyToNull(input.image_url),
    image_path: emptyToNull(input.image_path),
    image_focal_x: input.image_focal_x ?? 50,
    image_focal_y: input.image_focal_y ?? 50,
    external_url: emptyToNull(input.external_url),
  };
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}
