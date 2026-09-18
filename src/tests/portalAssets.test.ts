import { describe, expect, it } from "vitest";

import {
  DEFAULT_PORTAL_ASSET_ID,
  parseCategoryPortalOverrides,
  parseVialMedia,
  resolveCategoryPortalAsset,
  resolvePortalAssetPublicUrl,
} from "@/lib/shop/portalAssets";

describe("portalAssets", () => {
  it("resolves built-in portal paths", () => {
    expect(resolvePortalAssetPublicUrl({ assetId: "portal_blue" })).toBe("/shop/portals/portal_blue.png");
    expect(resolvePortalAssetPublicUrl({ assetId: "" })).toBe(`/shop/portals/${DEFAULT_PORTAL_ASSET_ID}.png`);
  });

  it("prefers custom asset over built-in", () => {
    expect(resolvePortalAssetPublicUrl({ assetId: "portal_red", customPath: "/custom.png" })).toBe("/custom.png");
  });

  it("parses category portal overrides from theme", () => {
    const map = parseCategoryPortalOverrides({
      categoryPortals: { peptides: { assetId: "portal_cyan", customAsset: "" } },
    });
    expect(map.peptides?.assetId).toBe("portal_cyan");
  });

  it("resolves category portal with hierarchy", () => {
    const url = resolveCategoryPortalAsset(
      "peptides",
      { assetId: "portal_gold" },
      { peptides: { assetId: "portal_blue", customAsset: "" } },
    );
    expect(url).toBe("/shop/portals/portal_blue.png");
  });

  it("falls through empty category override to area portal", () => {
    const url = resolveCategoryPortalAsset(
      "peptides",
      { assetId: "portal_cyan" },
      { peptides: { assetId: "", customAsset: "" } },
    );
    expect(url).toBe("/shop/portals/portal_cyan.png");
  });

  it("parses vial media config", () => {
    const v = parseVialMedia({
      vialMedia: { areaImage: "areas/gb/vial.png", categoryImages: { peptides: "cat.png" } },
    });
    expect(v.areaImage).toBe("areas/gb/vial.png");
    expect(v.categoryImages.peptides).toBe("cat.png");
  });
});
