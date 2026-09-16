import { describe, expect, it } from "vitest";

import {
  buildShopCatalogSearchParams,
  readShopCatalogUrlState,
} from "@/lib/shop/shopCatalogUrlState";

describe("shopCatalogUrlState", () => {
  it("reads category, search, variant and legacy cat", () => {
    expect(readShopCatalogUrlState(new URLSearchParams("category=peptides&search=kpv&variant=10mg"))).toEqual({
      categoryKey: "peptides",
      search: "kpv",
      variant: "10mg",
    });
    expect(readShopCatalogUrlState(new URLSearchParams("cat=injectable-oils"))).toEqual({
      categoryKey: "injectable-oils",
      search: "",
      variant: "",
    });
  });

  it("writes params without loops and clears empty values", () => {
    const base = new URLSearchParams("category=peptides&search=old");
    const next = buildShopCatalogSearchParams(base, { search: "kpv", variant: "5 mg" });
    expect(next.get("category")).toBe("peptides");
    expect(next.get("search")).toBe("kpv");
    expect(next.get("variant")).toBe("5 mg");
    expect(next.get("cat")).toBeNull();

    const cleared = buildShopCatalogSearchParams(next, { categoryKey: null, search: "", variant: "" });
    expect(cleared.toString()).toBe("");
  });
});
