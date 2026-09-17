import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd());
const SRC = join(ROOT, "src");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "peptide") walkTsFiles(full, out);
    else if (/\.(tsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("architecture audit RC (document risky patterns)", () => {
  it("customer pages do not call create_order or join_kit_request directly", () => {
    const pages = walkTsFiles(join(SRC, "pages")).filter((p) => !p.includes("admin"));
    const violations = pages.filter((p) => {
      const text = readFileSync(p, "utf8");
      return /rpc\(\s*["']create_order|rpc\(\s*["']join_kit_request/.test(text);
    });
    expect(violations).toEqual([]);
  });

  it("shop UI hides bulk column when quantity discounts disabled at app level", () => {
    expect(read("src/components/shop/ShopProductsTable.tsx")).toContain("quantityDiscountsEnabled");
    expect(read("src/pages/ShopRetail.tsx")).toContain("ShopProductGrid");
    expect(read("src/components/shop/ShopProductsMobileList.tsx")).toContain("quantityDiscountsEnabled");
  });

  it("retail desktop uses shared retail CTA constant", () => {
    expect(read("src/components/shop/ShopProductCompactRow.tsx")).toContain("SHOP_RETAIL_ADD_CTA");
  });

  it("kit reconciliation remains admin-only service path", () => {
    expect(read("src/services/adminKitRequests.ts")).toContain("kit_share_reconcile_report");
    expect(read("src/components/admin/KitIntegritySection.tsx")).toBeTruthy();
  });
});
