import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { formatAnnouncementDate, sortAnnouncementFeed } from "@/lib/announcements";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("announcements", () => {
  it("sorts pinned items first, then newest published", () => {
    const sorted = sortAnnouncementFeed([
      { id: "old", pinned: false, published_at: "2026-09-01T00:00:00Z", created_at: "2026-09-01T00:00:00Z" },
      { id: "new", pinned: false, published_at: "2026-09-09T00:00:00Z", created_at: "2026-09-09T00:00:00Z" },
      { id: "pin", pinned: true, published_at: "2026-08-01T00:00:00Z", created_at: "2026-08-01T00:00:00Z" },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["pin", "new", "old"]);
    expect(formatAnnouncementDate("2026-09-09T12:00:00+02:00")).toBe("09.09.2026");
  });

  it("keeps drafts admin-only and published rows customer-readable", () => {
    const sql = read("supabase/migrations/0063_announcements.sql");
    expect(sql).toContain("published = true or public.has_role(auth.uid(), 'admin')");
    expect(sql).toContain("announcements_admin_insert");
    expect(sql).toContain("announcements_admin_update");
    expect(sql).toContain("announcements_admin_delete");
    expect(sql).toContain("enable row level security");
  });

  it("routes users through announcements after consent", () => {
    expect(read("src/App.tsx")).toContain('path="/announcements"');
    expect(read("src/App.tsx")).toContain("ConsentGate");
    expect(read("src/pages/Announcements.tsx")).toContain("Was gibt's Neues?");
    expect(read("src/lib/adminNav.ts")).toContain("Ankündigungen");
    expect(read("src/services/auth.ts")).toContain('POST_LOGIN_PATH = "/announcements"');
  });
});
