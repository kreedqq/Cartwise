import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("responsive layout guard (touch targets + overflow hints)", () => {
  it("uses min-h-11 on primary kit join actions", () => {
    expect(read("src/components/kit-requests/JoinKitRequestDialog.tsx")).toContain("min-h-11");
  });

  it("uses mobile card layout for admin cart detail", () => {
    expect(read("src/pages/admin/AdminCartDetail.tsx")).toContain("md:hidden");
  });

  it("scopes group-buy catalog to responsive product lists", () => {
    expect(read("src/pages/GroupBuy.tsx")).toContain("ShopProductsMobileList");
    expect(read("src/pages/GroupBuy.tsx")).toContain("hidden lg:block");
  });

  it("retail desktop table exposes code, availability, and retail CTA", () => {
    const table = read("src/components/shop/ShopProductsTable.tsx");
    expect(table).toContain("SHOP_RETAIL_ADD_CTA");
    expect(table).toContain("Verfügbar");
    expect(table).toContain("isRetailTable");
  });
});
