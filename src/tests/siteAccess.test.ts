import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { isMaintenanceBypassPath, parseSiteAccessState, resolvePublicAccess } from "@/lib/siteAccess";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("maintenance access", () => {
  it("treats a load failure as closed for non-admins and open only for confirmed admins", () => {
    expect(
      resolvePublicAccess({ state: null, loadFailed: true, isAdminConfirmed: false }),
    ).toEqual({
      allowed: false,
      maintenanceMode: true,
      quantityDiscountsEnabled: false,
    });
    expect(resolvePublicAccess({ state: null, loadFailed: true, isAdminConfirmed: true }).allowed).toBe(true);
  });

  it("blocks normal users and keeps admins when maintenance is on", () => {
    const on = parseSiteAccessState({
      maintenance_mode: true,
      quantity_discounts_enabled: true,
      caller_is_admin: false,
      site_access_allowed: false,
    });
    expect(resolvePublicAccess({ state: on, loadFailed: false, isAdminConfirmed: false }).allowed).toBe(false);
    expect(resolvePublicAccess({ state: on, loadFailed: false, isAdminConfirmed: true }).allowed).toBe(true);
  });

  it("allows normal users when maintenance is off", () => {
    const off = parseSiteAccessState({
      maintenance_mode: false,
      quantity_discounts_enabled: true,
      caller_is_admin: false,
      site_access_allowed: true,
    });
    expect(resolvePublicAccess({ state: off, loadFailed: false, isAdminConfirmed: false }).allowed).toBe(true);
  });

  it("only bypasses login and auth callback while maintenance is on", () => {
    expect(isMaintenanceBypassPath("/login")).toBe(true);
    expect(isMaintenanceBypassPath("/auth/callback")).toBe(true);
    expect(isMaintenanceBypassPath("/register")).toBe(false);
    expect(isMaintenanceBypassPath("/shop")).toBe(false);
    expect(isMaintenanceBypassPath("/orders")).toBe(false);
  });

  it("stores maintenance server-side and checks admin via has_role", () => {
    const sql = read("supabase/migrations/0061_app_settings.sql");
    expect(sql).toContain("maintenance_mode");
    expect(sql).toContain("create table if not exists public.app_settings");
    expect(sql).toContain("create or replace function public.get_site_access_state");
    expect(sql).toContain("grant execute on function public.get_site_access_state() to anon, authenticated");
    expect(sql).toContain("has_role(auth.uid(), 'admin')");
    expect(sql).toContain("not public.maintenance_mode_enabled()");
    expect(sql).toContain("or public.has_role(_user_id, 'admin')");
    expect(read("src/routes/MaintenanceGate.tsx")).toContain("MaintenanceScreen");
    expect(read("src/pages/Login.tsx")).toContain("allowAdminLogin");
    expect(read("src/components/maintenance/MaintenanceScreen.tsx")).toContain("Wartungsarbeiten laufen");
    expect(read("src/pages/admin/AdminOrders.tsx")).toContain("EmergencyMaintenanceButton");
    expect(read("src/components/admin/EmergencyMaintenanceButton.tsx")).toContain("Notfallmodus aktivieren?");
    expect(read("src/components/admin/EmergencyMaintenanceButton.tsx")).toContain("Maintenance aktivieren");
    expect(existsSync(resolve(process.cwd(), "public/maintenance-pause.jpg"))).toBe(true);
    expect(read("src/components/maintenance/MaintenanceScreen.tsx")).toContain("maintenance-pause.jpg");
    expect(read("src/components/maintenance/MaintenanceScreen.tsx")).toContain("object-contain");
    expect(read("src/components/maintenance/MaintenanceScreen.tsx")).not.toContain("Administrator-Anmeldung");
    expect(read("src/components/maintenance/MaintenanceScreen.tsx")).not.toMatch(/to="\/login"/);
    expect(read("src/components/maintenance/MaintenanceScreen.tsx")).not.toContain("object-cover");
    expect(read("src/components/maintenance/MaintenanceScreen.tsx")).not.toContain("404");
    expect(read("src/components/maintenance/MaintenanceScreen.tsx")).not.toContain("500");
    expect(read("src/App.tsx")).toContain("MaintenanceGate");
  });
});
