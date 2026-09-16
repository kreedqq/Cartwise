import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd());

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") walk(p, acc);
    else if (/\.(tsx?|sql)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

describe("pricing forensic RC", () => {
  it("0106 quantity_discounts_enabled remains the SQL gate for bulk tiers", () => {
    const sql = read("supabase/migrations/0106_disable_quantity_discounts.sql");
    expect(sql).toContain("quantity_discounts_enabled");
  });

  it("customer shop tables gate bulk UI on quantityDiscountsEnabled", () => {
    expect(read("src/components/shop/ShopProductsTable.tsx")).toMatch(/showBulkColumn.*quantityDiscountsEnabled/s);
  });

  it("no second create_order implementation in pages", () => {
    const pages = walk(join(ROOT, "src/pages"));
    const hits = pages.filter((p) => /rpc\(\s*['"]create_order/.test(readFileSync(p, "utf8")));
    expect(hits).toEqual([]);
  });
});
