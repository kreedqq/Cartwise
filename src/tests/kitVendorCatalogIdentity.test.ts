import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { isKitRequestableProductId } from "@/lib/kitRequests";
import { getProductUnitLabel } from "@/lib/quantityFormat";
import {
  formatVendorDosageDisplay,
  formatVialVariant,
  wizardVariantPresentation,
} from "@/lib/shop/variantCoverage";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("0073 vendor-only kit catalog identity", () => {
  const sql = read("supabase/migrations/0073_kit_request_vendor_catalog_identity.sql");

  it("stores vendor-only kits on area_product_id without inventing a products row", () => {
    expect(sql).toContain("add column if not exists area_product_id uuid");
    expect(sql).toContain("alter column product_id drop not null");
    expect(sql).toContain("kit_shares_catalog_identity_chk");
    expect(sql).toContain("product_id is not null or vendor_code is not null");
    expect(sql).not.toContain("kit_shares_area_product_id_fkey");
    expect(sql).toContain("kit_share_catalog_product");
    expect(sql).toContain("vendor_catalog_as_product");
    expect(sql).toContain("sap.product_id is null");
    expect(sql).toContain("area_product_id");
    expect(sql).not.toContain("insert into public.products");
    expect(sql).not.toContain("Adamax");
    expect(sql).not.toContain("AD10");
    expect(sql).not.toContain("AD5");
    expect(read("supabase/migrations/0070_one_user_cart.sql").slice(0, 40)).toContain("0070");
  });

  it("keeps fail-closed create, join, leave, cart sync and checkout on catalog identity", () => {
    expect(sql).toContain("create or replace function public.create_kit_request");
    expect(sql).toContain("create or replace function public.join_kit_request");
    expect(sql).toContain("create or replace function public.preview_kit_request_join");
    expect(sql).toContain("create or replace function public.kit_share_sync_participant_cart");
    expect(sql).toContain("create or replace function public.create_one_area_order");
    expect(sql).not.toContain("create or replace function public.create_order");
    expect(sql).toContain("Produkt ist in diesem Bereich nicht verfügbar.");
    expect(sql).toContain("_master_id := _kit.product_id");
    expect(sql).toContain("kit_share_catalog_product(_kit)");
    expect(sql).toContain("sap.vendor_code = upper(btrim(coalesce(k.vendor_code, '')))");
    expect(sql).toContain("list_kit_requestable_product_ids");
    expect(sql).toContain("union");
    expect(isKitRequestableProductId("area-ad10", new Set(["area-ad10", "master-ad5"]))).toBe(true);
    expect(isKitRequestableProductId("master-ad5", new Set(["area-ad10", "master-ad5"]))).toBe(true);
    expect(isKitRequestableProductId("unknown", new Set(["area-ad10"]))).toBe(false);
  });

  it("creates One Cart for area-restricted owners during kit cart sync", () => {
    const cartFix = read("supabase/migrations/0074_one_cart_accessible_area.sql");
    expect(cartFix).toContain("user_can_access_shop_area(NEW.user_id, NEW.shop_area)");
    expect(cartFix).not.toContain("user_can_access_shop_area(auth.uid(), NEW.shop_area)");
    expect(cartFix).toContain("user_can_access_shop_area(_user_id, sa.key)");
    expect(cartFix).toContain("get_or_create_user_cart_for");
    expect(read("supabase/migrations/0070_one_user_cart.sql").slice(0, 40)).toContain("0070");
  });

  it("does not map a vendor-only row onto another SKU", () => {
    const createStart = sql.indexOf("create or replace function public.create_kit_request");
    const createFn = sql.slice(createStart, sql.indexOf("revoke all on function public.create_kit_request"));
    expect(createFn).not.toContain("lower(p.name)");
    expect(createFn).not.toContain("similar");
    expect(createFn).toContain("sap.product_id = _product_id or sap.id = _product_id");
    expect(createFn).toContain("_sap.id");
    expect(createFn).toContain("area_product_id");
    expect(createFn).toContain("nullif(btrim(coalesce(_sap.vendor_code, '')), '') is null");
  });
});

describe("kit price unit and wizard tiles", () => {
  it("keeps EUR unit suffixes on the quantity SSoT", () => {
    expect(getProductUnitLabel({ categoryId: "peptides" })).toBe("Vial");
    expect(getProductUnitLabel({ categoryId: "reconstitution-water" })).toBe("Vial");
    expect(getProductUnitLabel({ categoryId: "injectable-oils" })).toBe("Vial");
    expect(getProductUnitLabel({ categoryId: "orals" })).toBe("Packung");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("unit={unitLabel}");
    expect(read("src/components/common/DualCurrencyPrice.tsx")).toContain(" / ${unit.trim()}");
  });

  it("splits wizard variants into strength and pack size", () => {
    const lines = wizardVariantPresentation({
      code: "AD10",
      name: "Adamax",
      dosage_vial: "10 mg / 10 Vials",
    });
    expect(lines.title).toBe("10 mg");
    expect(lines.subtitle).toBe("10 Vials");
  });

  it("keeps AD5 and AD10 as independent display variants", () => {
    const ad5 = {
      code: "AD5",
      name: "Adamax",
      dosage_vial: "5mg*10vials",
    };
    const ad10 = {
      code: "AD10",
      name: "Adamax",
      dosage_vial: "10mg*10vials",
    };

    expect(formatVialVariant(ad5)).toBe("5 mg · 10 Vials");
    expect(formatVialVariant(ad10)).toBe("10 mg · 10 Vials");
    expect(formatVialVariant(ad10)).not.toContain("5 mg");
    expect(wizardVariantPresentation(ad5)).toEqual({ title: "5 mg", subtitle: "10 Vials" });
    expect(wizardVariantPresentation(ad10)).toEqual({ title: "10 mg", subtitle: "10 Vials" });
  });
});

describe("formatVendorDosageDisplay", () => {
  it("normalizes common vendor dosage strings without inventing data", () => {
    expect(formatVendorDosageDisplay("5mg*10vials", "AD5")).toBe("5 mg · 10 Vials");
    expect(formatVendorDosageDisplay("10mg*10vials", "AD10")).toBe("10 mg · 10 Vials");
    expect(formatVendorDosageDisplay("3ml*10vials", "BA3")).toBe("3 ml · 10 Vials");
    expect(formatVendorDosageDisplay("100mg*10vials", "AU100")).toBe("100 mg · 10 Vials");
    expect(formatVendorDosageDisplay("30mg/vial x10vials", "KP30")).toBe("30 mg · 10 Vials");
  });

  it("falls back to the original raw value when parsing is unsafe", () => {
    expect(formatVendorDosageDisplay("custom-pack-ABC", "ZZ9")).toBe("custom-pack-ABC");
    expect(formatVendorDosageDisplay("—")).toBe("—");
  });
});
