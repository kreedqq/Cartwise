import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("migration 0106 disable quantity discounts", () => {
  const sql = read("supabase/migrations/0106_disable_quantity_discounts.sql");

  it("turns off app setting and hard-disables live bulk pricing", () => {
    expect(sql).toContain("quantity_discounts_enabled");
    expect(sql).toContain("set value_bool = false");
    expect(sql).toMatch(/create or replace function public\.quantity_discounts_enabled\(\)[\s\S]*select false/s);
  });
});
