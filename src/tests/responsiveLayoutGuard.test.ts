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

  it("scopes group-buy catalog to the compact product list", () => {
    expect(read("src/pages/GroupBuy.tsx")).toContain("ShopProductGrid");
    expect(read("src/pages/GroupBuy.tsx")).not.toContain("ShopProductsMobileList");
  });

  it("compact retail row exposes retail CTA constant", () => {
    const row = read("src/components/shop/ShopProductCompactRow.tsx");
    expect(row).toContain("SHOP_RETAIL_ADD_CTA");
    expect(row).toContain("isRetail");
  });
});
