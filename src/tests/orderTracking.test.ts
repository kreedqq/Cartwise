import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildCarrierTrackingUrl,
  hasTrackingNumber,
  resolveTrackingUrl,
  shouldSendTrackingNotification,
} from "@/lib/tracking";
import {
  buildTrackingEmailHtml,
  buildTrackingEmailSubject,
  trackingEmailRecipientAllowed,
  trackingLogoUrl,
} from "@/lib/trackingEmail";
import { countShippingStats, filterShippingHubOrders, isActiveShippingStatus } from "@/lib/shippingHub";
import type { OrderStatus } from "@/types/database";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("tracking URLs", () => {
  it("builds carrier links and keeps a custom URL", () => {
    expect(buildCarrierTrackingUrl("dhl", "00340434123456789012")).toContain("00340434123456789012");
    expect(buildCarrierTrackingUrl("dpd", "123")).toContain("123");
    expect(buildCarrierTrackingUrl("ups", "1Z")).toContain("1Z");
    expect(buildCarrierTrackingUrl("gls", "GLS1")).toContain("GLS1");
    expect(buildCarrierTrackingUrl("hermes", "H1")).toContain("H1");
    expect(buildCarrierTrackingUrl("other", "ABC")).toBeNull();
    expect(
      resolveTrackingUrl({ carrier: "other", trackingNumber: "ABC", customUrl: "https://example.test/track/ABC" }),
    ).toBe("https://example.test/track/ABC");
    expect(hasTrackingNumber({ tracking_number: " 00340 " })).toBe(true);
    expect(hasTrackingNumber({ tracking_number: "   " })).toBe(false);
  });
});

describe("tracking email idempotency", () => {
  it("sends only when a tracking number is assigned for the first time", () => {
    expect(shouldSendTrackingNotification({ tracking_number: null, tracking_notification_sent_at: null }, "00340")).toBe(
      true,
    );
    expect(
      shouldSendTrackingNotification({ tracking_number: "00340", tracking_notification_sent_at: null }, "00340"),
    ).toBe(true);
    expect(
      shouldSendTrackingNotification(
        { tracking_number: "00340", tracking_notification_sent_at: "2026-09-04T10:00:00.000Z" },
        "99999",
      ),
    ).toBe(false);
    expect(
      shouldSendTrackingNotification({ tracking_number: null, tracking_notification_sent_at: null }, "  "),
    ).toBe(false);
    expect(trackingEmailRecipientAllowed(null)).toBe(false);
    expect(trackingEmailRecipientAllowed("")).toBe(false);
    expect(trackingEmailRecipientAllowed("kunde@example.test")).toBe(true);
  });

  it("builds a professional HTML email with the site logo", () => {
    const html = buildTrackingEmailHtml({
      customerName: "PepQueen",
      orderNumber: "CW-2026-000030",
      carrier: "dhl",
      trackingNumber: "00340434123456789012",
      trackingUrl: "https://www.dhl.de/track",
      logoUrl: trackingLogoUrl(),
    });
    expect(html).toContain("PEPTIX");
    expect(html).toContain("peptix-logo.png");
    expect(html).toContain("CW-2026-000030");
    expect(html).toContain("00340434123456789012");
    expect(html).toContain("DHL");
    expect(html).toContain("Sendung verfolgen");
    expect(html).toContain("PepQueen");
    expect(buildTrackingEmailSubject("CW-2026-000030")).toContain("CW-2026-000030");
    expect(read("src/services/orderTracking.ts")).toContain("send-tracking-email");
    expect(read("src/services/orderTracking.ts")).toContain("shouldSendTrackingNotification");
    expect(read("supabase/functions/send-tracking-email/index.ts")).toContain("already_notified");
    expect(read("supabase/functions/send-tracking-email/index.ts")).toContain("no_email");
    expect(read("supabase/functions/send-tracking-email/index.ts")).toContain("RESEND_API_KEY");
    expect(read("supabase/functions/send-tracking-email/index.ts")).toContain("requireAdmin");
    expect(read("supabase/functions/send-tracking-email/index.ts")).not.toContain("VITE_");
  });
});

describe("shipping hub filters", () => {
  const orders = [
    { status: "pending" as OrderStatus, order_number: "CW-1", telegram_username_snapshot: "Alpha", tracking_number: null },
    { status: "processing" as OrderStatus, order_number: "CW-2", telegram_username_snapshot: "Beta", tracking_number: null },
    { status: "dispatched" as OrderStatus, order_number: "CW-3", telegram_username_snapshot: "Gamma", tracking_number: "DHL1" },
    { status: "shipped" as OrderStatus, order_number: "CW-4", telegram_username_snapshot: "Delta", tracking_number: "DHL2" },
    { status: "cancelled" as OrderStatus, order_number: "CW-5", telegram_username_snapshot: "Echo", tracking_number: null },
  ];

  it("counts real workflow buckets and keeps cancelled out of active shipping", () => {
    expect(countShippingStats(orders)).toEqual({
      pending: 1,
      processing: 1,
      ready: 1,
      shipped: 1,
      cancelled: 1,
    });
    expect(isActiveShippingStatus("processing")).toBe(true);
    expect(isActiveShippingStatus("cancelled")).toBe(false);
    expect(filterShippingHubOrders(orders, { status: "cancelled", tracking: "all", search: "" }).map((row) => row.order_number)).toEqual([
      "CW-5",
    ]);
    expect(filterShippingHubOrders(orders, { status: "ready", tracking: "all", search: "" }).map((row) => row.order_number)).toEqual([
      "CW-3",
    ]);
    expect(
      filterShippingHubOrders(orders, { status: "all", tracking: "without", search: "" }).every((row) => !row.tracking_number),
    ).toBe(true);
    expect(filterShippingHubOrders(orders, { status: "all", tracking: "all", search: "beta" }).map((row) => row.order_number)).toEqual([
      "CW-2",
    ]);
  });
});

describe("shipping SQL and cancel wiring", () => {
  it("stores tracking on orders through an admin RPC and never deletes cancelled orders", () => {
    const sql = read("supabase/migrations/0050_order_tracking_and_progress_title.sql");
    expect(sql).toMatch(/add column if not exists tracking_number text/);
    expect(sql).toMatch(/create or replace function public\.upsert_order_tracking/);
    expect(sql).toMatch(/has_role\(auth\.uid\(\), 'admin'\)/);
    expect(sql).toMatch(/tracking_notification_sent_at/);
    expect(sql).toMatch(/mark_order_tracking_notified/);
    expect(sql).not.toMatch(/delete from public\.orders/);
    expect(sql).not.toMatch(/supabase db reset/);
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).toContain('status: "cancelled"');
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).toContain("CancelOrderDialog");
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).toContain("Bestellung stornieren");
    expect(read("src/pages/admin/AdminOrderDetail.tsx")).toContain("AdminOrderTrackingForm");
    expect(read("src/components/orders/AdminOrderTrackingForm.tsx")).toContain("useSaveOrderTracking");
    expect(read("src/components/orders/AdminOrderTrackingForm.tsx")).toContain("Test-E-Mail an mich");
    expect(read("src/services/orders.ts")).toContain('cancelled: "Storniert"');
    expect(read("src/pages/OrderDetail.tsx")).toContain("OrderTrackingCard");
    expect(read("src/pages/admin/AdminShipping.tsx")).toContain("Versandkosten");
    expect(read("src/App.tsx")).toContain("shipping-costs");
    expect(read("src/App.tsx")).toContain('Navigate to="/admin/orders"');
  });
});
