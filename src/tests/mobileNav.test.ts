import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildCustomerNavItems } from "@/lib/navigation";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("mobile navigation", () => {
  it("puts dashboard first and announcements as a secondary item", () => {
    const items = buildCustomerNavItems([]);
    expect(items.map((item) => item.to)).toEqual([
      "/dashboard",
      "/shop",
      "/orders",
      "/peptide",
      "/feedback",
      "/profile",
      "/announcements",
    ]);
    // Dashboard is the new landing page (primary home)
    expect(items[0]).toMatchObject({ to: "/dashboard" });
    // Announcements is secondary (deprioritised)
    expect(items.find((i) => i.to === "/announcements")?.secondary).toBe(true);
  });

  it("scrolls instead of squeezing labels", () => {
    const nav = read("src/components/layout/MobileNav.tsx");
    expect(nav).toContain("overflow-x-auto");
    expect(nav).toContain("snap-x");
    expect(nav).toContain("min-h-12");
    expect(nav).toContain("w-[5.25rem]");
    expect(nav).toContain("text-[11px]");
    expect(nav).not.toContain("flex-1");
    expect(nav).not.toContain("text-[9px]");
    expect(read("src/components/layout/Sidebar.tsx")).toContain("useCustomerNavItems");
  });
});
