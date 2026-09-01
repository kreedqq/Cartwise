import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  APPROVED_ZERO_PRICE_DEACTIVATE_SKUS,
  isApprovedZeroPriceDeactivation,
  zeroPriceAction,
} from "@/lib/shop/zeroPricePolicy";

describe("zero-price deactivation policy", () => {
  it("lists exactly the five operator-approved SKUs", () => {
    expect([...APPROVED_ZERO_PRICE_DEACTIVATE_SKUS]).toEqual(["B1201", "B1210", "GGH", "HHB", "SHB"]);
    expect(isApprovedZeroPriceDeactivation("B1201")).toBe(true);
    expect(isApprovedZeroPriceDeactivation("AA10")).toBe(false);
  });

  it("deactivates the approved 0-price SKUs even when Excel says AVAILABLE", () => {
    for (const code of APPROVED_ZERO_PRICE_DEACTIVATE_SKUS) {
      expect(zeroPriceAction({ priceUsd: 0, isActive: true, excelStatus: "AVAILABLE", code })).toBe(
        "deactivate",
      );
    }
  });

  it("deactivates only active 0-price SKUs that Excel marks OUT OF STOCK", () => {
    expect(
      zeroPriceAction({ priceUsd: 0, isActive: true, excelStatus: "OUT_OF_STOCK" }),
    ).toBe("deactivate");
  });

  it("does not deactivate unmatched 0-price SKUs that Excel marks AVAILABLE", () => {
    expect(
      zeroPriceAction({ priceUsd: 0, isActive: true, excelStatus: "AVAILABLE", code: "OTHER" }),
    ).toBe("keep-blocker");
  });

  it("does not deactivate 0-price SKUs that Excel cannot match", () => {
    expect(zeroPriceAction({ priceUsd: 0, isActive: true, excelStatus: "UNKNOWN" })).toBe(
      "keep-blocker",
    );
  });

  it("does not auto-deactivate positive-price SKUs even when Excel is OUT OF STOCK", () => {
    expect(
      zeroPriceAction({ priceUsd: 45, isActive: true, excelStatus: "OUT_OF_STOCK", code: "H06" }),
    ).toBe("keep");
  });
});

describe("shop and kit request active-only loading", () => {
  it("list_shop_products only returns active catalog rows", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/0021_fix_shop_product_rpc_types.sql"),
      "utf8",
    );
    expect(sql).toMatch(/create or replace function public\.list_shop_products/);
    expect(sql).toMatch(/where p\.is_active = true/);
  });

  it("create_kit_request refuses inactive products", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0041_kit_requests.sql"), "utf8");
    expect(sql).toMatch(/from public\.products where id = _product_id and is_active/);
  });

  it("Kit Gesuche create and browse load products via useShopProducts", () => {
    const create = readFileSync(
      resolve(process.cwd(), "src/components/kit-requests/CreateKitRequestDialog.tsx"),
      "utf8",
    );
    const page = readFileSync(resolve(process.cwd(), "src/pages/KitRequests.tsx"), "utf8");
    expect(create).toMatch(/useShopProducts/);
    expect(page).toMatch(/useShopProducts/);
  });
});
