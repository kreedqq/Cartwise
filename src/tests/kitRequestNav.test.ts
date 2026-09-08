import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Group Buy navigation and kit structure", () => {
  it("routes Group Buy 1 and 2 to Kit Gesuche, not the retail shop catalog", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch('path="/shop" element={<ShopPage />}');
    expect(app).toMatch('path="/shop/group-buy-1" element={<KitRequestsPage />}');
    expect(app).toMatch('path="/shop/group-buy-2" element={<KitRequestsPage />}');
    expect(app).toMatch('path="/kit-gesuche" element={<KitRequestsPage />}');
    expect(read("src/components/layout/Sidebar.tsx")).toContain("useCustomerNavItems");
    expect(read("src/components/layout/MobileNavDrawer.tsx")).toContain("useCustomerNavItems");
    expect(read("src/components/layout/MobileNav.tsx")).toContain("useCustomerNavItems");
    expect(read("src/components/layout/AdminNav.tsx")).not.toMatch("/kit-gesuche");
    expect(read("src/pages/KitRequests.tsx")).toMatch("shopGroupsForCategory");
    expect(read("src/pages/KitRequests.tsx")).toMatch("group.groupKey");
    expect(read("src/pages/KitRequests.tsx")).toMatch("isGroupBuyAreaKey");
    expect(read("src/pages/KitRequests.tsx")).toMatch("/403");
    expect(read("src/components/kit-requests/CreateKitRequestDialog.tsx")).toMatch("group.groupKey");
    expect(read("src/components/kit-requests/CreateKitRequestDialog.tsx")).toMatch("shopArea");
  });
});
