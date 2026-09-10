import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { announcementFocalPosition, announcementImageSrc } from "@/lib/announcements";
import {
  averageRating,
  eligibleOrdersForFeedback,
  matchesAdminFeedbackFilter,
  publicDisplayName,
  ratingDistribution,
  starCountLabel,
  validateFeedbackBody,
  validateFeedbackRating,
  isPublicFeedbackStatus,
} from "@/lib/feedback";
import { isAllowedImageExtension, sniffImageMime } from "@/lib/mediaUpload";
import { designHasVisibleBackground, EMPTY_SITE_DESIGN, parseSiteDesignConfig, resolvedDesignLayer } from "@/lib/siteDesign";
import { StarRating } from "@/components/media/StarRating";
import { isMaintenanceBypassPath } from "@/lib/siteAccess";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("announcement media", () => {
  it("treats images as optional and prefers stored paths over external urls", () => {
    expect(
      announcementImageSrc({ image_path: null, image_url: null }, () => "https://cdn.example/a.jpg"),
    ).toBeNull();
    expect(
      announcementImageSrc({ image_path: "announcements/1/a.jpg", image_url: "https://evil.example/x.png" }, (path) => `https://cdn/${path}`),
    ).toBe("https://cdn/announcements/1/a.jpg");
    expect(announcementFocalPosition({ image_focal_x: 20, image_focal_y: 80 })).toBe("20% 80%");
  });

  it("renders announcement images in a fixed 16:9 frame with lazy loading", () => {
    const page = read("src/pages/Announcements.tsx");
    expect(page).toContain("<MediaFrame>");
    expect(read("src/components/media/MediaFrame.tsx")).toContain("aspect-video");
    expect(page).toContain("object-cover");
    expect(page).toContain('loading={index === 0 ? "eager" : "lazy"}');
    expect(page).toContain("announcementFocalPosition");
    expect(read("src/pages/admin/AdminAnnouncements.tsx")).toContain("ImageDropzone");
    expect(read("src/pages/admin/AdminAnnouncements.tsx")).toContain("useReplaceAnnouncementImage");
    expect(read("src/pages/admin/AdminAnnouncements.tsx")).toContain("mutateAsync(deleteRow)");
    expect(read("src/services/announcements.ts")).toContain("replaceAnnouncementImage");
    expect(read("src/services/announcements.ts")).toContain("clearAnnouncementImage");
    expect(read("src/services/announcements.ts")).toContain("removeStorageObject(ANNOUNCEMENT_MEDIA_BUCKET");
  });
});

describe("site design", () => {
  it("falls back to desktop artwork and stays inactive without a visible image", () => {
    const config = parseSiteDesignConfig({
      desktop: { imagePath: "desktop/a.jpg", enabled: true, overlay: true, overlayOpacity: 55 },
      tablet: { imagePath: null, enabled: true },
      mobile: { imagePath: null, enabled: true },
      inheritTabletFromDesktop: true,
      inheritMobileFromDesktop: false,
    });
    expect(resolvedDesignLayer(config, "tablet").imagePath).toBe("desktop/a.jpg");
    expect(resolvedDesignLayer(config, "mobile").imagePath).toBe("desktop/a.jpg");
    expect(designHasVisibleBackground(false, config)).toBe(false);
    expect(designHasVisibleBackground(true, EMPTY_SITE_DESIGN)).toBe(false);
    expect(designHasVisibleBackground(true, config)).toBe(true);
  });

  it("persists settings outside app_settings and keeps maintenance independent", () => {
    const sql = read("supabase/migrations/0065_announcement_media_design_feedback.sql");
    expect(sql).toContain("site_design_settings");
    expect(sql).toContain("site_design_admin_update");
    expect(sql).not.toContain("update public.orders");
    expect(sql).not.toContain("update public.order_items");
    expect(read("src/services/siteDesign.ts")).toContain("site_design_settings");
    expect(read("src/pages/admin/AdminDesign.tsx")).toContain('title="Design"');
    expect(read("src/pages/admin/AdminDesign.tsx")).toContain("SiteDesignPreview");
    expect(read("src/components/layout/SiteBackground.tsx")).not.toContain("MaintenanceScreen");
    expect(read("src/components/layout/SiteBackground.tsx")).not.toContain("maintenance-pause");
    expect(read("src/routes/MaintenanceGate.tsx")).toContain("MaintenanceScreen");
    expect(isMaintenanceBypassPath("/admin/design")).toBe(false);
    expect(read("src/lib/maintenanceArt.ts")).toContain("maintenance-pause-4k.jpg");
    expect(read("src/lib/maintenanceArt.ts")).toContain("maintenance-pause-mobile.jpg");
  });
});

describe("verified order feedback", () => {
  it("validates rating, body, display name, and one review per eligible order", () => {
    expect(validateFeedbackRating(5)).toBe(5);
    expect(() => validateFeedbackRating(0)).toThrow();
    expect(() => validateFeedbackRating(6)).toThrow();
    expect(validateFeedbackBody("Kurzer Text der lang genug ist.")).toContain("Kurzer Text");
    expect(() => validateFeedbackBody("zu kurz")).toThrow();
    expect(publicDisplayName("")).toBe("Verifizierter Kunde");
    expect(publicDisplayName("kunde@example.com")).toBe("Verifizierter Kunde");
    expect(publicDisplayName("Alex")).toBe("Alex");
    expect(starCountLabel(4)).toBe("4 von 5 Sternen");
    const eligible = eligibleOrdersForFeedback(
      [
        { id: "a", status: "completed" },
        { id: "b", status: "pending" },
        { id: "c", status: "received" },
      ],
      ["a"],
    );
    expect(eligible.map((row) => row.id)).toEqual(["b", "c"]);
    expect(matchesAdminFeedbackFilter({ status: "pending", image_path: null, rating: 5 }, "pending")).toBe(true);
    expect(matchesAdminFeedbackFilter({ status: "approved", image_path: "x", rating: 3 }, "with_image")).toBe(true);
    expect(matchesAdminFeedbackFilter({ status: "rejected", image_path: null, rating: 1 }, "stars_1")).toBe(true);
    expect(averageRating([5, 4, 5])).toBe(4.7);
    expect(ratingDistribution([5, 5, 4, 1]).find((row) => row.stars === 5)?.percent).toBe(50);
  });

  it("enforces ownership, pending default, unique order, and approved-only public feed", () => {
    const sql = read("supabase/migrations/0065_announcement_media_design_feedback.sql");
    expect(sql).toContain("constraint order_feedback_order_unique unique (order_id)");
    expect(sql).toContain("o.user_id = auth.uid()");
    expect(sql).toContain("new.status := 'pending'");
    expect(sql).toContain("status = 'approved'");
    expect(sql).toContain("order_feedback_admin_update");
    expect(sql).toContain("order_feedback_admin_delete");
    expect(sql).not.toContain("update public.orders");
    expect(read("src/services/feedback.ts")).toContain('.eq("status", "approved")');
    expect(read("src/services/feedback.ts")).toContain("status: \"pending\"");
    expect(read("src/components/feedback/FeedbackCard.tsx")).toContain("Verifizierte Bestellung");
    expect(read("src/pages/Feedback.tsx")).toContain("image_consent");
    expect(read("src/pages/admin/AdminFeedback.tsx")).toContain("Freigeben");
    expect(read("src/App.tsx")).toContain('path="/feedback"');
  });
});

describe("feedback is allowed for any own order", () => {
  it("lets processing, submitted, shipped and completed orders be reviewed", () => {
    const eligible = eligibleOrdersForFeedback(
      [
        { id: "processing", status: "processing" },
        { id: "submitted", status: "submitted" },
        { id: "shipped", status: "shipped" },
        { id: "completed", status: "completed" },
        { id: "arrived", status: "arrived" },
      ],
      [],
    );
    expect(eligible.map((row) => row.id)).toEqual([
      "processing",
      "submitted",
      "shipped",
      "completed",
      "arrived",
    ]);
    expect(read("src/lib/feedback.ts")).not.toContain("FEEDBACK_ELIGIBLE_STATUSES");
    expect(read("src/pages/Feedback.tsx")).toContain("feedbackOrderChoiceLabel");
    expect(read("src/pages/Feedback.tsx")).not.toContain("Nur abgeschlossene");
  });

  it("rejects foreign orders server-side and keeps new reviews pending until admin approval", () => {
    const policy = read("supabase/migrations/0066_feedback_any_own_order.sql");
    expect(policy).toContain("order_feedback_insert_own");
    expect(policy).toContain("o.user_id = auth.uid()");
    expect(policy).not.toContain("o.status in");
    expect(policy).not.toContain("received");
    expect(read("src/services/feedback.ts")).toContain("user_id: userId");
    expect(read("src/services/feedback.ts")).toContain('status: "pending"');
    expect(read("src/services/feedback.ts")).toContain('.eq("status", "approved")');
    expect(read("src/hooks/useTrustExperience.ts")).toContain("listApprovedFeedback");
    expect(read("src/pages/admin/AdminFeedback.tsx")).toContain('status: "approved"');
    const storage = read("supabase/migrations/0065_announcement_media_design_feedback.sql");
    expect(storage).toContain("f.status = 'approved'");
    expect(storage).toContain("feedback-media");
    expect(isPublicFeedbackStatus("pending")).toBe(false);
    expect(isPublicFeedbackStatus("approved")).toBe(true);
    expect(isPublicFeedbackStatus("rejected")).toBe(false);
    expect(isPublicFeedbackStatus("hidden")).toBe(false);
  });
});

describe("image security", () => {
  it("accepts jpeg/png/webp magic bytes and rejects svg", () => {
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer)).toBe("image/jpeg");
    expect(sniffImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer)).toBe("image/png");
    const webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(sniffImageMime(webp.buffer)).toBe("image/webp");
    expect(isAllowedImageExtension("photo.SVG")).toBe(false);
    expect(isAllowedImageExtension("photo.jpg")).toBe(true);
    expect(read("src/lib/mediaUpload.ts")).toContain("SVG-Dateien sind nicht erlaubt");
    const sql = read("supabase/migrations/0065_announcement_media_design_feedback.sql");
    expect(sql).toContain("announcement-media");
    expect(sql).toContain("site-design");
    expect(sql).toContain("feedback-media");
    expect(sql).toContain("array['image/jpeg', 'image/png', 'image/webp']");
    expect(sql).toContain("public.has_role(auth.uid(), 'admin')");
    expect(sql).toContain("(storage.foldername(name))[1] = auth.uid()::text");
  });
});

describe("star rating accessibility", () => {
  it("exposes text labels for keyboard and screen readers", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = render(<StarRating value={3} onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "5 von 5 Sternen" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "5 von 5 Sternen" }));
    expect(onChange).toHaveBeenCalledWith(5);
    view.unmount();
    render(<StarRating value={2} readOnly />);
    expect(screen.getByLabelText("2 von 5 Sternen")).toBeInTheDocument();
  });
});

describe("responsive trust surfaces", () => {
  it("uses stacked then multi-column cards and keeps login redirect", () => {
    expect(read("src/pages/Feedback.tsx")).toContain("grid-cols-1");
    expect(read("src/pages/Feedback.tsx")).toContain("sm:grid-cols-2");
    expect(read("src/pages/Feedback.tsx")).toContain("xl:grid-cols-3");
    expect(read("src/pages/admin/AdminFeedback.tsx")).toContain("xl:grid-cols-2");
    expect(read("src/services/auth.ts")).toContain('POST_LOGIN_PATH = "/announcements"');
    expect(read("src/components/media/MediaFrame.tsx")).toContain("aspect-[4/3]");
  });
});
