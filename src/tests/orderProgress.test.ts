import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  clampProgressPercent,
  defaultOrderProgress,
  isOrderProgressStatusKey,
  isShippingProgressStatusKey,
  ORDER_PROGRESS_TEMPLATES,
  resolveOrderProgress,
  SHIPPING_PROGRESS_STATUSES,
  shippingProgressWritePayload,
} from "@/lib/orderProgress";

describe("orderProgress", () => {
  it("maps workflow statuses to a safe visual default without storing rows", () => {
    expect(defaultOrderProgress("pending").statusLabel).toBe("Bestellung eingegangen");
    expect(defaultOrderProgress("processing").progressPercent).toBe(28);
    expect(defaultOrderProgress("dispatched").statusKey).toBe("submitted");
    expect(defaultOrderProgress("shipped").statusKey).toBe("shipped");
    expect(defaultOrderProgress("completed").progressPercent).toBe(100);
    expect(defaultOrderProgress("cancelled").progressPercent).toBe(0);
    expect(defaultOrderProgress("cancelled").statusLabel).toBe("Storniert");
    expect(defaultOrderProgress("cancelled").isCancelled).toBe(true);
  });

  it("keeps stored title and percent for legacy keys outside the shipping dropdown", () => {
    const view = resolveOrderProgress("processing", {
      status_key: "received",
      progress_percent: 32,
      title: "Ihre Bestellung wird vorbereitet",
      comment: "Wir prüfen aktuell Ihre Bestellung und bereiten die nächsten Schritte vor.",
      updated_at: "2026-09-04T10:00:00.000Z",
    });
    expect(view.statusKey).toBe("received");
    expect(view.statusLabel).toBe("Ihre Bestellung wird vorbereitet");
    expect(view.progressPercent).toBe(32);
    expect(view.comment).toContain("prüfen aktuell");
    expect(view.isCustom).toBe(true);
    expect(view.isCancelled).toBe(false);
  });

  it("allows any percent from 0 through 100 on legacy stored rows", () => {
    for (const percent of [0, 1, 45, 99, 100]) {
      expect(
        resolveOrderProgress("processing", {
          status_key: "received",
          progress_percent: percent,
          title: "Frei",
          comment: "Frei beschreibbar",
          updated_at: "2026-09-04T10:00:00.000Z",
        }).progressPercent,
      ).toBe(percent);
    }
    expect(clampProgressPercent(-4)).toBe(0);
    expect(clampProgressPercent(140)).toBe(100);
    expect(clampProgressPercent(7)).toBe(7);
    expect(clampProgressPercent(61)).toBe(61);
  });

  it("maps the seven shipping statuses to fixed title, description, and percent", () => {
    expect(SHIPPING_PROGRESS_STATUSES).toHaveLength(7);
    expect(SHIPPING_PROGRESS_STATUSES.map((status) => status.title)).toEqual([
      "Bestellung wird bearbeitet",
      "Beim Händler bestellt",
      "Aus China versendet",
      "In Deutschland eingetroffen",
      "Für den Versand vorbereitet",
      "Bestellung ist unterwegs",
      "Bestellung abgeschlossen",
    ]);
    expect(SHIPPING_PROGRESS_STATUSES.map((status) => status.progressPercent)).toEqual([10, 25, 50, 65, 80, 90, 100]);
    expect(isShippingProgressStatusKey("received")).toBe(false);
    expect(isShippingProgressStatusKey("ordered_from_merchant")).toBe(false);

    for (const status of SHIPPING_PROGRESS_STATUSES) {
      const payload = shippingProgressWritePayload(status.key);
      expect(payload).toEqual({
        statusKey: status.key,
        progressPercent: status.progressPercent,
        title: status.title,
        comment: status.description,
      });
      const view = resolveOrderProgress("processing", {
        status_key: status.key,
        progress_percent: 3,
        title: "veralteter Titel",
        comment: "veraltete Beschreibung",
        updated_at: "2026-09-04T10:00:00.000Z",
      });
      expect(view.statusLabel).toBe(status.title);
      expect(view.comment).toBe(status.description);
      expect(view.progressPercent).toBe(status.progressPercent);
    }
  });

  it("does not write orders.status when building a shipping progress payload", () => {
    const payload = shippingProgressWritePayload("shipped");
    expect(payload).not.toHaveProperty("status");
    expect(JSON.stringify(payload)).not.toContain("dispatched");
    expect(payload.statusKey).toBe("shipped");
    expect(payload.progressPercent).toBe(50);
  });

  it("does not let a cancelled order look like it is still moving", () => {
    const view = resolveOrderProgress("cancelled", {
      status_key: "shipped",
      progress_percent: 75,
      title: "Bestellung wurde versendet",
      comment: "Ihre Bestellung wurde versendet.",
      updated_at: "2026-09-04T10:00:00.000Z",
    });
    expect(view.statusLabel).toBe("Storniert");
    expect(view.isCancelled).toBe(true);
    expect(view.comment).toBe("Ihre Bestellung wurde versendet.");
    expect(view.progressPercent).toBe(75);
  });

  it("clamps percent and rejects unknown keys", () => {
    expect(isOrderProgressStatusKey("shipped")).toBe(true);
    expect(isOrderProgressStatusKey("pending")).toBe(false);
    const fallback = resolveOrderProgress("processing", {
      status_key: "not-a-status",
      progress_percent: 12,
      comment: "ok",
      updated_at: "2026-09-04T10:00:00.000Z",
    });
    expect(fallback.statusKey).toBe("processing");
  });

  it("keeps templates as optional fillers with free labels", () => {
    expect(ORDER_PROGRESS_TEMPLATES.map((item) => item.title)).toEqual([
      "Bestellung eingegangen",
      "Bestellung wird bearbeitet",
      "Bestellung wurde übermittelt",
      "Versand wird vorbereitet",
      "Bestellung wurde versendet",
      "Bestellung ist unterwegs",
      "Bestellung angekommen",
    ]);
  });
});

describe("order progress SQL", () => {
  it("keeps customer reads own-order-only and admin writes behind has_role", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0049_order_progress.sql"), "utf8");
    expect(sql).toMatch(/create table public\.order_progress/);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/order_progress_select_own_or_admin/);
    expect(sql).toMatch(/o\.user_id = auth\.uid\(\)/);
    expect(sql).toMatch(/has_role\(auth\.uid\(\), 'admin'\)/);
    expect(sql).toMatch(/create or replace function public\.upsert_order_progress/);
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/Nur Admins dürfen den Bestellfortschritt ändern/);
    expect(sql).not.toMatch(/create policy "order_progress_update_own"/);
    expect(sql).toMatch(/revoke all on function public\.upsert_order_progress/);
  });

  it("adds a free title column without rewriting existing progress rows", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/0050_order_tracking_and_progress_title.sql"),
      "utf8",
    );
    expect(sql).toMatch(/add column if not exists title text/);
    expect(sql).toMatch(/_title text default null/);
    expect(sql).not.toMatch(/update public\.order_progress/);
    expect(sql).not.toMatch(/delete from public\.order_progress/);
  });
});

describe("order progress UI wiring", () => {
  it("lets admin edit progress and shows the tracker on the customer order", () => {
    const admin = readFileSync(resolve(process.cwd(), "src/pages/admin/AdminOrderDetail.tsx"), "utf8");
    const customer = readFileSync(resolve(process.cwd(), "src/pages/OrderDetail.tsx"), "utf8");
    const editor = readFileSync(resolve(process.cwd(), "src/components/orders/AdminOrderProgressEditor.tsx"), "utf8");
    const form = readFileSync(resolve(process.cwd(), "src/components/orders/OrderProgressForm.tsx"), "utf8");
    const service = readFileSync(resolve(process.cwd(), "src/services/orderProgress.ts"), "utf8");
    const tracker = readFileSync(resolve(process.cwd(), "src/components/orders/OrderProgressTracker.tsx"), "utf8");
    expect(admin).toContain("Bestellfortschritt");
    expect(admin).toContain("ShippingProgressSelect");
    expect(admin).not.toContain("AdminOrderProgressEditor");
    expect(admin).not.toContain("OrderProgressFormFields");
    expect(admin).toContain("OrderStatusSelect");
    expect(admin).toContain("AdminOrderTrackingForm");
    expect(customer).toContain("OrderProgressTracker");
    expect(customer).toContain("OrderTrackingCard");
    expect(customer).not.toContain("useUpsertOrderProgress");
    expect(customer).not.toContain("upsertOrderProgress");
    expect(editor).toContain("OrderProgressLivePreview");
    expect(editor).toContain("Fortschritt speichern");
    expect(form).toContain("Live-Vorschau");
    expect(form).toContain("Vorlage verwenden");
    expect(form).toContain("Überschrift");
    expect(form).toContain("Beschreibung");
    expect(service).toContain('rpc("upsert_order_progress"');
    expect(service).toContain("_title");
    expect(service).not.toMatch(/\.from\("order_progress"\)\.insert/);
    expect(service).not.toMatch(/\.from\("order_progress"\)\.update/);
    expect(service).not.toMatch(/\.from\("order_progress"\)\.upsert/);
    expect(tracker).toContain("max-w-[50rem]");
    expect(tracker).not.toContain("50vw");
  });

  it("keeps the seven shipping statuses on the order overview and detail", () => {
    const overview = readFileSync(resolve(process.cwd(), "src/pages/admin/AdminOrders.tsx"), "utf8");
    const detail = readFileSync(resolve(process.cwd(), "src/pages/admin/AdminOrderDetail.tsx"), "utf8");
    const select = readFileSync(resolve(process.cwd(), "src/components/orders/ShippingProgressSelect.tsx"), "utf8");
    const tracking = readFileSync(resolve(process.cwd(), "src/components/orders/AdminOrderTrackingForm.tsx"), "utf8");
    expect(overview).toContain("ShippingProgressSelect");
    expect(overview).toContain("OrderStatusSelect");
    expect(detail).toContain("ShippingProgressSelect");
    expect(detail).toContain("AdminOrderTrackingForm");
    expect(detail).toContain("Bestellung stornieren");
    expect(select).toContain("SHIPPING_PROGRESS_STATUSES");
    expect(select).toContain("shippingProgressWritePayload");
    expect(select).toContain("useUpsertOrderProgress");
    expect(tracking).toContain("useSaveOrderTracking");
    expect(tracking).toContain("Test-E-Mail an mich");
    expect(detail).not.toContain("OrderProgressFormFields");
    expect(detail).not.toContain("Vorlage verwenden");
    expect(detail).not.toContain('type="range"');
  });
});
