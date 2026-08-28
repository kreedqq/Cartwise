import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { getIdentitySubstance } from "@/lib/peptide/catalog";
import { sqlMappingSlug } from "@/lib/peptide/persistence/sqlProductMapping";
import { substanceSlugForProduct } from "@/lib/peptide/search";

const MIGRATION_0024 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0024_research_identity_and_product_mapping.sql"),
  "utf8",
);
const MIGRATION_0025 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0025_research_sources_studies_runs.sql"),
  "utf8",
);
const MIGRATION_0026 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0026_research_claims_and_evidence.sql"),
  "utf8",
);
const MIGRATION_0027 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0027_research_regulatory_and_review.sql"),
  "utf8",
);
const MIGRATION_0028 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0028_research_evidence_assessments_select_approved.sql"),
  "utf8",
);

const RESEARCH_MIGRATIONS = [MIGRATION_0024, MIGRATION_0025, MIGRATION_0026, MIGRATION_0027];

describe("research production migration readiness 6A", () => {
  it("does not drop or mutate shop or auth tables in 0024–0027", () => {
    const joined = RESEARCH_MIGRATIONS.join("\n").toLowerCase();
    expect(joined).not.toMatch(/drop table public\.(products|carts|cart_items|orders|order_items|profiles|user_roles)/);
    expect(joined).not.toMatch(/alter table public\.(products|carts|orders|profiles|user_roles)/);
    expect(joined).not.toMatch(/delete from public\.(products|carts|orders|profiles|user_roles)/);
    expect(joined).not.toMatch(/update public\.(products|carts|orders|profiles|user_roles)/);
    expect(MIGRATION_0024).toContain("references public.products (id) on delete cascade");
    expect(MIGRATION_0027).toContain("references auth.users (id) on delete restrict");
    expect(MIGRATION_0024).toContain("has_role(auth.uid(), 'admin')");
    expect(joined).not.toContain("create or replace function public.has_role");
  });

  it("depends 0024 → 0025 → 0026 → 0027 via new tables only", () => {
    expect(MIGRATION_0025).toContain("references public.substances");
    expect(MIGRATION_0026).toContain("references public.claims");
    expect(MIGRATION_0026).toContain("join public.sources");
    expect(MIGRATION_0027).toContain("join public.sources");
    expect(MIGRATION_0027).toContain("join public.substances");
  });

  it("prepares a separate 0028 so non-admins cannot read review-required evidence", () => {
    expect(MIGRATION_0026).toMatch(/claim_id and c\.status = 'approved'/);
    expect(MIGRATION_0028).toContain("review_status = 'approved'");
    expect(MIGRATION_0028).toContain("has_role(auth.uid(), 'admin')");
    expect(MIGRATION_0028).toContain("drop policy if exists \"evidence_assessments_select_authenticated\"");
    expect(MIGRATION_0026).not.toContain("review_status = 'approved'");
  });

  it("compares client vs SQL mapping for the named shop codes", () => {
    const rows: Array<{ code: string; name: string; expectDiff?: boolean }> = [
      { code: "RT5", name: "Retatrutide" },
      { code: "RT10", name: "Retatrutide" },
      { code: "RT20", name: "Retatrutide" },
      { code: "RT30", name: "Retatrutide" },
      { code: "RT40", name: "Retatrutide" },
      { code: "MT1", name: "MT-1" },
      { code: "ML10", name: "MT-2 (Melanotan 2 Acetate)", expectDiff: true },
      { code: "SMO5", name: "Sermorelin Acetate", expectDiff: true },
      { code: "TA5", name: "Thymosin Alpha-1", expectDiff: true },
      { code: "BT5", name: "TB-500 (Thymosin B4 Acetate)", expectDiff: true },
      { code: "BBG70", name: "(GLOW) GHK-CU 50mg+TB500 10mg+BPC157 10mg Blend" },
      { code: "TR10", name: "Tirzepatide", expectDiff: true },
    ];
    for (const row of rows) {
      const client = substanceSlugForProduct(row);
      const sql = sqlMappingSlug(row);
      if (row.expectDiff) expect(client).not.toBe(sql);
      else expect(client).toBe(sql);
    }
    expect(substanceSlugForProduct({ code: "RT5", name: "Retatrutide" })).toBe("retatrutide");
    expect(sqlMappingSlug({ code: "RT5", name: "Retatrutide" })).toBe("retatrutide");
    expect(getIdentitySubstance("tb-500")?.slug).not.toBe(getIdentitySubstance("thymosin-beta-4")?.slug);
  });

  it("keeps identity CAS empty in Phase 1 seed (overlay CAS is not invented into SQL)", () => {
    expect(MIGRATION_0024).toMatch(/\('retatrutide'/);
    expect(MIGRATION_0024).not.toMatch(/2023788-19-2/);
  });
});
