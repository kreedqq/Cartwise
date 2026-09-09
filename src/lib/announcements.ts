export interface AnnouncementFeedItem {
  id: string;
  title: string;
  content: string;
  published: boolean;
  pinned: boolean;
  image_url: string | null;
  external_url: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export function sortAnnouncementFeed<T extends Pick<AnnouncementFeedItem, "pinned" | "published_at" | "created_at">>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const aTime = a.published_at ?? a.created_at;
    const bTime = b.published_at ?? b.created_at;
    return bTime.localeCompare(aTime);
  });
}

export function formatAnnouncementDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function isSafeExternalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
