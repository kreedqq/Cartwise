import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("central admin pricing rules IA", () => {
  it("registers /admin/pricing-rules and nav Preisregeln under Kunden", () => {
    expect(read("src/App.tsx")).toContain('path="pricing-rules"');
    expect(read("src/lib/adminNav.ts")).toContain('to: "/admin/pricing-rules"');
    expect(read("src/lib/adminNav.ts")).toContain('label: "Preisregeln"');
    expect(read("src/lib/adminNav.ts")).not.toContain('label: "Rollenaufschläge"');
  });

  it("keeps order surcharge reporting separate under Bestellungen", () => {
    const nav = read("src/lib/adminNav.ts");
    expect(nav).toContain('to: "/admin/surcharges"');
    expect(nav).toContain("Aufschlags-Auswertung");
  });

  it("central panel owns global sell factors and area role sell factors", () => {
    const panel = read("src/components/admin/AdminPricingRulesPanel.tsx");
    expect(panel).toContain("upsertCustomerRole");
    expect(panel).toContain("saveAdminShopAreaRoleSellFactors");
    expect(panel).toContain("applyAreaRoleSellUnit");
    expect(panel).toContain("applySellFactorPct");
    expect(panel).toContain("Globaler Verkaufspreisfaktor");
    expect(panel).toContain('placeholder="—"');
  });

  it("shows area base price read-only on Preisregeln and does not persist it there", () => {
    const panel = read("src/components/admin/AdminPricingRulesPanel.tsx");
    expect(panel).toContain("area?.base_price_factor_pct");
    expect(panel).toContain("Shop → Verkaufsbereiche → Preise");
    expect(panel).not.toContain("updateAdminShopArea");
    expect(panel).not.toContain("setAreaFactorDraft");
    expect(panel).toContain("{areaFactor} %");
  });

  it("shop area Preise tab edits base price and not role sell factors", () => {
    const areas = read("src/pages/admin/AdminShopAreas.tsx");
    expect(areas).toContain("/admin/pricing-rules");
    expect(areas).not.toContain("saveAdminShopAreaRoleSellFactors");
    expect(areas).not.toContain("listAdminShopAreaRoleSellFactors");
    expect(areas).toContain("Grundpreis des Bereichs");
    expect(areas).toContain("updateAdminShopArea");
    expect(areas).toContain('aria-label="Bereichsgrundpreis in Prozent"');
  });

  it("role catalog no longer edits markup percent inline", () => {
    const catalog = read("src/pages/admin/AdminRoleCatalog.tsx");
    expect(catalog).not.toContain("role-markup");
    expect(catalog).not.toContain("Aufschlag %");
    expect(catalog).toContain("/admin/pricing-rules");
  });

  it("preserves legacy /admin/roles redirect", () => {
    expect(read("src/pages/admin/AdminRoles.tsx")).toContain('to="/admin/users"');
  });
});
