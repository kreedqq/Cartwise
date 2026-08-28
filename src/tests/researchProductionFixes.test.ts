import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  EXPLICIT_PRODUCT_MAPPINGS,
  UNMAP_PREFIX_CODES,
  UNRESOLVED_PRODUCT_MAPPINGS,
} from "@/lib/peptide/persistence/explicitProductMappings";
import { LIVE_SHOP_PRODUCTS } from "@/lib/peptide/persistence/liveShopProducts";
import {
  mappingConfidence,
  postgresMappingSlug,
  sqlMappingSlug,
} from "@/lib/peptide/persistence/sqlProductMapping";
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
const MIGRATION_0029 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0029_research_explicit_product_mappings.sql"),
  "utf8",
);

const RESEARCH_MIGRATIONS = [
  MIGRATION_0024,
  MIGRATION_0025,
  MIGRATION_0026,
  MIGRATION_0027,
  MIGRATION_0028,
  MIGRATION_0029,
];

const NAMED_LIVE: Array<{
  code: string;
  name: string;
  expected: string | null;
}> = [
  { code: "RT5", name: "Retatrutide", expected: "retatrutide" },
  { code: "RT10", name: "Retatrutide", expected: "retatrutide" },
  { code: "RT20", name: "Retatrutide", expected: "retatrutide" },
  { code: "RT30", name: "Retatrutide", expected: "retatrutide" },
  { code: "RT40", name: "Retatrutide", expected: "retatrutide" },
  { code: "TR10", name: "Tirzepatide", expected: "tirzepatide" },
  { code: "SMO5", name: "Sermorelin Acetate", expected: "sermorelin" },
  { code: "TA5", name: "Thymosin Alpha-1", expected: "thymosin-alpha-1" },
  { code: "BT5", name: "TB-500 (Thymosin B4 Acetate)", expected: null },
  { code: "ML10", name: "MT-2 (Melanotan 2 Acetate)", expected: "melanotan-ii" },
  { code: "BBG70", name: "(GLOW) GHK-CU 50mg+TB500 10mg+BPC157 10mg Blend", expected: "glow-blend" },
];

describe("phase 6B evidence RLS (0028)", () => {
  it("lets admins read all assessments including review-required", () => {
    expect(MIGRATION_0028).toContain("has_role(auth.uid(), 'admin')");
    const adminBranch = MIGRATION_0028.slice(
      MIGRATION_0028.indexOf("has_role(auth.uid(), 'admin')"),
      MIGRATION_0028.indexOf("review_status = 'approved'"),
    );
    expect(adminBranch).not.toContain("review_status");
  });

  it("blocks non-admins from review-required evidence and allows approved evidence on approved claims", () => {
    expect(MIGRATION_0028).toContain("review_status = 'approved'");
    expect(MIGRATION_0028).toMatch(/c\.status = 'approved'/);
    expect(MIGRATION_0026).not.toContain("review_status = 'approved'");
    expect(MIGRATION_0026).toMatch(/claim_id and c\.status = 'approved'/);
  });

  it("leaves unauthenticated users without a SELECT policy or GRANT", () => {
    expect(MIGRATION_0028).toMatch(/for select to authenticated/);
    expect(MIGRATION_0028).not.toMatch(/to anon/);
    expect(MIGRATION_0026).not.toMatch(/grant .* on public\.evidence_assessments to anon/i);
    expect(MIGRATION_0026).not.toMatch(/for select to anon/i);
  });

  it("does not add public write and keeps 0026 admin-only writes", () => {
    expect(MIGRATION_0028).not.toMatch(/for insert/i);
    expect(MIGRATION_0028).not.toMatch(/for update/i);
    expect(MIGRATION_0028).not.toMatch(/for delete/i);
    expect(MIGRATION_0026).toContain("evidence_assessments_write_admin");
    expect(MIGRATION_0026).toContain("evidence_assessments_update_admin");
    expect(MIGRATION_0026).toContain("evidence_assessments_delete_admin");
    expect(MIGRATION_0026).toMatch(/evidence_assessments_write_admin[\s\S]*has_role\(auth\.uid\(\), 'admin'\)/);
    expect(MIGRATION_0026).toMatch(/evidence_assessments_update_admin[\s\S]*has_role\(auth\.uid\(\), 'admin'\)/);
    expect(MIGRATION_0026).toMatch(/evidence_assessments_delete_admin[\s\S]*has_role\(auth\.uid\(\), 'admin'\)/);
  });
});

describe("phase 6B explicit product mapping (0029)", () => {
  it("maps named live SKUs: expected vs client vs database", () => {
    for (const row of NAMED_LIVE) {
      const live = LIVE_SHOP_PRODUCTS.find((product) => product.code === row.code);
      expect(live, row.code).toEqual({ code: row.code, name: row.name });
      const client = substanceSlugForProduct(row);
      const database = postgresMappingSlug(row);
      expect(database, `${row.code} database`).toBe(row.expected);
      const match = client === database ? "MATCH" : "DIVERGE";
      if (row.code === "BT5") {
        expect(client).toBe("tb-500");
        expect(database).toBeNull();
        expect(match).toBe("DIVERGE");
      } else {
        expect(client, `${row.code} client`).toBe(row.expected);
        expect(match).toBe("MATCH");
      }
    }
    expect(substanceSlugForProduct({ code: "MT1", name: "MT-1" })).toBe("melanotan-ii");
    expect(postgresMappingSlug({ code: "MT1", name: "MT-1" })).toBeNull();
    expect(sqlMappingSlug({ code: "TR10", name: "Tirzepatide" })).toBeNull();
    expect(sqlMappingSlug({ code: "SMO5", name: "Sermorelin Acetate" })).toBeNull();
    expect(sqlMappingSlug({ code: "TA5", name: "Thymosin Alpha-1" })).toBeNull();
    expect(sqlMappingSlug({ code: "ML10", name: "MT-2 (Melanotan 2 Acetate)" })).toBeNull();
  });

  it("embeds every explicit live code in 0029 and does not invent SKUs or alter products", () => {
    const liveCodes = new Set(LIVE_SHOP_PRODUCTS.map((row) => row.code));
    expect(LIVE_SHOP_PRODUCTS).toHaveLength(320);
    for (const row of EXPLICIT_PRODUCT_MAPPINGS) {
      expect(liveCodes.has(row.code), row.code).toBe(true);
      expect(LIVE_SHOP_PRODUCTS.find((product) => product.code === row.code)?.name).toBe(row.name);
      expect(MIGRATION_0029).toContain(`('${row.code}', '${row.slug}')`);
    }
    expect(MIGRATION_0029).toMatch(/p\.code in \('MT1', 'KL80'\)/);
    expect(UNMAP_PREFIX_CODES).toEqual(expect.arrayContaining(["MT1", "KL80"]));
    expect(UNRESOLVED_PRODUCT_MAPPINGS.some((row) => row.code === "BT5")).toBe(true);
    expect(MIGRATION_0029.toLowerCase()).not.toMatch(/alter table public\.products/);
    expect(MIGRATION_0029.toLowerCase()).not.toMatch(/update public\.products/);
    expect(MIGRATION_0029).toContain("mapping_method");
    expect(MIGRATION_0029).toContain("'manual'");
  });

  it("does not map unresolved blends, fragments, or TB-500/TB4 mixed labels", () => {
    expect(postgresMappingSlug({ code: "KL80", name: "(KLOW) GHK-CU 50mg+TB500 10mg+BPC157 10mg+TB500 10mg Blend" })).toBeNull();
    expect(postgresMappingSlug({ code: "BB10", name: "BPC157 5mg+TB500 5mg Blend" })).toBeNull();
    expect(postgresMappingSlug({ code: "RC10", name: "Retatrutide 5mg+Cagrilintide 5mg Blend" })).toBeNull();
    expect(postgresMappingSlug({ code: "FR5", name: "HGH Fragment 176-191" })).toBeNull();
    expect(postgresMappingSlug({ code: "H100", name: "Tren Hex" })).toBeNull();
    expect(postgresMappingSlug({ code: "CD50", name: "Clomiphene" })).toBeNull();
    expect(postgresMappingSlug({ code: "G75", name: "HMG" })).toBeNull();
    expect(mappingConfidence({ code: "BT5", name: "TB-500 (Thymosin B4 Acetate)" })).toBe("unresolved");
    expect(substanceSlugForProduct({ code: "H100", name: "Tren Hex" })).toBeNull();
  });
});

describe("phase 6B shop and auth isolation", () => {
  it("keeps 0024–0029 off shop, cart, order, and auth tables", () => {
    const joined = RESEARCH_MIGRATIONS.join("\n").toLowerCase();
    expect(joined).not.toMatch(/alter table public\.(products|carts|cart_items|orders|order_items|profiles|user_roles)/);
    expect(joined).not.toMatch(/update public\.(products|carts|orders|profiles|user_roles)/);
    expect(joined).not.toMatch(/delete from public\.(products|carts|orders|profiles|user_roles)/);
    expect(joined).not.toMatch(/drop table public\.(products|carts|cart_items|orders|order_items|profiles|user_roles)/);
    expect(joined).not.toContain("create or replace function public.has_role");
    expect(MIGRATION_0024).toContain("references public.products (id) on delete cascade");
    expect(MIGRATION_0029).toContain("insert into public.product_substances");
    expect(MIGRATION_0029).toContain("delete from public.product_substances");
  });
});
