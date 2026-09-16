import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd());

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("architecture audit (static guardrails)", () => {
  it("keeps a single kit join/allocation path on the client", () => {
    expect(read("src/services/kitRequests.ts")).toContain("join_kit_request");
    expect(read("src/hooks/useKitRequests.ts")).toContain("useJoinKitRequest");
    expect(read("src/pages/GroupBuy.tsx")).not.toContain("join_kit_request");
  });

  it("does not expose raw products.price_usd to customer shop pages", () => {
    const shopPage = read("src/pages/GroupBuy.tsx");
    expect(shopPage).not.toContain('.from("products")');
    expect(read("src/services/shopAreas.ts")).toContain("list_shop_products_for_area");
  });

  it("routes priced checkout through create_order RPC", () => {
    expect(read("src/services/orders.ts")).toMatch(/create_order/);
  });

  it("uses read-only kit reconciliation report", () => {
    expect(read("src/services/adminKitRequests.ts")).toContain("kit_share_reconcile_report");
    expect(read("supabase/migrations/0110_kit_share_reconcile_readonly_fix.sql")).toContain(
      "kit_share_reconcile_report",
    );
  });
});
