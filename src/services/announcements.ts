import { supabase } from "@/lib/supabaseClient";
import { sortAnnouncementFeed } from "@/lib/announcements";
import type { Tables } from "@/types/database";

export type Announcement = Tables<"announcements">;

export interface AnnouncementInput {
  title: string;
  content: string;
  published?: boolean;
  pinned?: boolean;
  image_url?: string | null;
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
    .insert({
      title: input.title.trim(),
      content: input.content.trim(),
      published: input.published ?? false,
      pinned: input.pinned ?? false,
      image_url: emptyToNull(input.image_url),
      external_url: emptyToNull(input.external_url),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateAnnouncement(id: string, input: AnnouncementInput): Promise<Announcement> {
  const { data, error } = await supabase
    .from("announcements")
    .update({
      title: input.title.trim(),
      content: input.content.trim(),
      published: input.published ?? false,
      pinned: input.pinned ?? false,
      image_url: emptyToNull(input.image_url),
      external_url: emptyToNull(input.external_url),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function setAnnouncementPublished(id: string, published: boolean): Promise<void> {
  const { error } = await supabase.from("announcements").update({ published }).eq("id", id);
  if (error) throw error;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}
