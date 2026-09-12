import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildCustomerNavItems } from "@/lib/navigation";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("mobile navigation", () => {
  it("keeps the existing information architecture", () => {
    const items = buildCustomerNavItems([]);
    expect(items.map((item) => item.to)).toEqual([
      "/announcements",
      "/dashboard",
      "/shop",
      "/feedback",
      "/peptide",
      "/orders",
      "/profile",
    ]);
  });

  it("scrolls instead of squeezing labels", () => {
    const nav = read("src/components/layout/MobileNav.tsx");
    expect(nav).toContain("overflow-x-auto");
    expect(nav).toContain("snap-x");
    expect(nav).toContain("min-h-12");
    expect(nav).toContain("w-[4.75rem]");
    expect(nav).toContain("text-[11px]");
    expect(nav).not.toContain("flex-1");
    expect(nav).not.toContain("text-[9px]");
    expect(read("src/components/layout/Sidebar.tsx")).toContain("useCustomerNavItems");
  });
});
