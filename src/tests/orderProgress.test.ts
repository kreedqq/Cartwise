import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  clampProgressPercent,
  defaultOrderProgress,
  isOrderProgressStatusKey,
  resolveOrderProgress,
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
  });

  it("uses stored admin values when present", () => {
    const view = resolveOrderProgress("processing", {
      status_key: "out_for_delivery",
      progress_percent: 60,
      comment: "Ihre Lieferung erfolgt heute zwischen 13:05 bis 14:35 Uhr",
      updated_at: "2026-09-04T10:00:00.000Z",
    });
    expect(view.statusKey).toBe("out_for_delivery");
    expect(view.statusLabel).toBe("In Zustellung");
    expect(view.progressPercent).toBe(60);
    expect(view.comment).toContain("13:05");
    expect(view.isCustom).toBe(true);
  });

  it("clamps percent and rejects unknown keys", () => {
    expect(clampProgressPercent(-4)).toBe(0);
    expect(clampProgressPercent(140)).toBe(100);
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
});

describe("order progress SQL", () => {
  it("keeps customer reads own-order-only and admin writes behind has_role", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/0049_order_progress.sql"),
      "utf8",
    );
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
});

describe("order progress UI wiring", () => {
  it("lets admin edit progress and shows the tracker on the customer order", () => {
    const admin = readFileSync(resolve(process.cwd(), "src/pages/admin/AdminOrderDetail.tsx"), "utf8");
    const customer = readFileSync(resolve(process.cwd(), "src/pages/OrderDetail.tsx"), "utf8");
    const editor = readFileSync(resolve(process.cwd(), "src/components/orders/AdminOrderProgressEditor.tsx"), "utf8");
    const service = readFileSync(resolve(process.cwd(), "src/services/orderProgress.ts"), "utf8");
    expect(admin).toContain("Bestellfortschritt");
    expect(admin).toContain("AdminOrderProgressEditor");
    expect(admin).toContain("OrderStatusSelect");
    expect(customer).toContain("OrderProgressTracker");
    expect(customer).not.toContain("useUpsertOrderProgress");
    expect(customer).not.toContain("upsertOrderProgress");
    expect(editor).toContain("Vorschau");
    expect(editor).toContain("Speichern");
    expect(service).toContain('rpc("upsert_order_progress"');
    expect(service).not.toMatch(/\.from\("order_progress"\)\.insert/);
    expect(service).not.toMatch(/\.from\("order_progress"\)\.update/);
    expect(service).not.toMatch(/\.from\("order_progress"\)\.upsert/);
  });
});
