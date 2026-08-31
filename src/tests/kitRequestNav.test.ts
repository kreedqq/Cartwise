import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Kit Gesuche navigation", () => {
  it("adds Kit Gesuche to desktop, drawer, and mobile nav without changing AdminNav", () => {
    expect(read("src/lib/navigation.ts")).toMatch(/to: "\/kit-gesuche"/);
    expect(read("src/lib/navigation.ts")).toMatch(/label: "Kit Gesuche"/);
    expect(read("src/components/layout/Sidebar.tsx")).toMatch("/kit-gesuche");
    expect(read("src/components/layout/MobileNavDrawer.tsx")).toMatch("/kit-gesuche");
    expect(read("src/components/layout/MobileNav.tsx")).toMatch("/kit-gesuche");
    expect(read("src/App.tsx")).toMatch("/kit-gesuche");
    expect(read("src/components/layout/AdminNav.tsx")).not.toMatch("/kit-gesuche");
    expect(read("src/pages/KitRequests.tsx")).toMatch("shopGroupsForCategory");
    expect(read("src/pages/KitRequests.tsx")).toMatch("group.groupKey");
    expect(read("src/components/kit-requests/CreateKitRequestDialog.tsx")).toMatch("group.groupKey");
  });
});
