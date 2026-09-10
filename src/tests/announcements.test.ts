import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ADMIN_NAV_GROUPS } from "@/lib/adminNav";
import { formatAnnouncementDate, sortAnnouncementFeed } from "@/lib/announcements";
import { buildCustomerNavItems } from "@/lib/navigation";
import { POST_LOGIN_PATH } from "@/services/auth";
import { isMaintenanceBypassPath } from "@/lib/siteAccess";

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
    expect(read("src/services/announcements.ts")).toContain('.eq("published", true)');
    expect(read("src/hooks/useAnnouncements.ts")).toContain("listPublishedAnnouncements");
    expect(read("src/hooks/useAnnouncements.ts")).toContain("listAllAnnouncements");
  });

  it("exposes /announcements as the customer landing route", () => {
    const app = read("src/App.tsx");
    expect(app).toContain('path="/announcements"');
    expect(app).toContain('<Navigate to="/announcements" replace />');
    expect(app).toContain('path="/news"');
    expect(app).toContain('path="/newsfeed"');
    expect(app).toContain('path="/neuigkeiten"');
    expect(app).toContain("ConsentGate");
    expect(POST_LOGIN_PATH).toBe("/announcements");
    expect(read("src/services/auth.ts")).toContain('POST_LOGIN_PATH = "/announcements"');
    expect(read("src/pages/Login.tsx")).toContain("POST_LOGIN_PATH");
    expect(read("src/pages/AuthCallback.tsx")).toContain("OAUTH_SUCCESS_PATH");
  });

  it("puts Ankündigungen first in customer and admin navigation", () => {
    const customer = buildCustomerNavItems([]);
    expect(customer[0]).toMatchObject({ to: "/announcements", label: "Ankündigungen" });
    expect(customer.map((item) => item.label)).toEqual([
      "Ankündigungen",
      "Übersicht",
      "Shop",
      "Lexikon & Rechner",
      "Meine Bestellungen",
      "Profil",
    ]);
    expect(ADMIN_NAV_GROUPS[0]).toMatchObject({ label: "Ankündigungen", to: "/admin/announcements" });
    expect(ADMIN_NAV_GROUPS[0]?.items).toEqual([]);
    expect(read("src/App.tsx")).toContain('path="announcements"');
    expect(read("src/pages/admin/AdminAnnouncements.tsx")).toContain('title="Ankündigungen"');
    expect(read("src/pages/admin/AdminAnnouncements.tsx")).toContain("useAdminAnnouncements");
    expect(read("src/pages/admin/AdminAnnouncements.tsx")).toContain("useCreateAnnouncement");
    expect(read("src/pages/admin/AdminAnnouncements.tsx")).toContain("useSetAnnouncementPublished");
  });

  it("uses Ankündigungen copy and removes Neuigkeiten from this area", () => {
    const page = read("src/pages/Announcements.tsx");
    const nav = read("src/lib/navigation.ts");
    const adminNav = read("src/lib/adminNav.ts");
    expect(page).toContain('title="Ankündigungen"');
    expect(page).toContain("Keine Ankündigungen vorhanden.");
    expect(page).toContain("Ankündigungen konnten nicht geladen werden.");
    expect(page).not.toContain("Neuigkeiten");
    expect(page).not.toContain("Was gibt's Neues?");
    expect(nav).not.toContain("Neuigkeiten");
    expect(adminNav).not.toContain("Neuigkeiten");
    expect(read("src/pages/admin/AdminAnnouncements.tsx")).not.toContain("Neuigkeiten");
  });

  it("does not change maintenance security for the announcements landing page", () => {
    expect(isMaintenanceBypassPath("/announcements")).toBe(false);
    expect(isMaintenanceBypassPath("/admin/announcements")).toBe(false);
    expect(isMaintenanceBypassPath("/login")).toBe(true);
    expect(read("src/routes/MaintenanceGate.tsx")).toContain("MaintenanceScreen");
    expect(read("src/App.tsx")).toContain("MaintenanceGate");
  });
});
