import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Group Buy navigation and kit structure", () => {
  it("routes Group Buy 1 and 2 to GroupBuyPage (catalog + kits), /kit-gesuche redirects via KitRequestsPage", () => {
    const app = read("src/App.tsx");
    expect(app).toContain('path="/shop" element={<ShopHubPage />}');
    expect(app).toContain('path="/shop/:slug" element={<ShopAreaPage />}');
    expect(app).toContain('path="/kit-gesuche" element={<KitRequestsPage />}');
    expect(read("src/components/layout/Sidebar.tsx")).toContain("useCustomerNavItems");
    expect(read("src/components/layout/MobileNavDrawer.tsx")).toContain("useCustomerNavItems");
    expect(read("src/components/layout/MobileNav.tsx")).toContain("useCustomerNavItems");
    expect(read("src/components/layout/AdminNav.tsx")).not.toMatch("/kit-gesuche");
  });

  it("GroupBuyPage contains kit request logic", () => {
    expect(read("src/pages/GroupBuy.tsx")).toMatch("shopGroupsForCategory");
    expect(read("src/pages/GroupBuy.tsx")).toMatch("group.groupKey");
    expect(read("src/pages/GroupBuy.tsx")).toMatch("isGroupBuyPricing");
    expect(read("src/pages/GroupBuy.tsx")).toMatch("/403");
    expect(read("src/components/kit-requests/CreateKitRequestDialog.tsx")).toMatch("group.groupKey");
    expect(read("src/components/kit-requests/CreateKitRequestDialog.tsx")).toMatch("shopArea");
  });

  it("KitRequestsPage still handles /kit-gesuche redirect", () => {
    expect(read("src/pages/KitRequests.tsx")).toMatch("isGroupBuyPricing");
    expect(read("src/pages/KitRequests.tsx")).toMatch("/403");
    expect(read("src/pages/KitRequests.tsx")).toMatch("JoinKitRequestDialog");
  });
});
