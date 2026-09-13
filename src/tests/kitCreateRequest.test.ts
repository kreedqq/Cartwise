import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { isKitRequestableProductId, kitRequestFailureMessage, KIT_REQUEST_MUTATION_FAILED_MESSAGE } from "@/lib/kitRequests";
import { kitRequestableVariants } from "@/lib/shop/variantCoverage";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const createSql = read("supabase/migrations/0072_kit_request_catalog_identity.sql");

describe("create_kit_request catalog identity", () => {
  it("resolves area catalog rows to a real products.id and does not invent one", () => {
    expect(createSql).toContain("resolve_kit_request_master_product_id");
    expect(createSql).toContain("list_kit_requestable_product_ids");
    expect(createSql).toContain("create or replace function public.create_kit_request");
    expect(createSql).toContain("sap.product_id is not null");
    expect(createSql).toContain("Dieses Produkt kann nicht als Kit Gesuch geteilt werden.");
    expect(createSql).toContain("Produkt ist in diesem Bereich nicht verfügbar.");
    expect(createSql).toContain("_master_id");
    expect(createSql).not.toContain("insert into public.products");
    expect(createSql).not.toContain("Adamax");
    expect(createSql).not.toContain("AD10");
    expect(createSql).not.toContain("Retatrutide");
  });

  it("keeps create on the existing kit share + creator participant path", () => {
    const fn = createSql.slice(createSql.indexOf("create or replace function public.create_kit_request"));
    expect(fn).toContain("insert into public.kit_shares");
    expect(fn).toContain("is_open_request");
    expect(fn).toContain("insert into public.kit_share_participants");
    expect(fn).toContain("kit_request_card_payload");
    expect(fn).not.toContain("sync_completed_kit_request_carts");
    expect(fn).not.toContain("kit_share_sync_all_participant_carts");
    expect(fn).not.toContain("create_kit_share");
  });

  it("treats vendor-only area rows as not kit-requestable", () => {
    const emma = read("src/tests/emmaVendorCatalog.test.ts");
    expect(emma).toContain('"AD10"');
    expect(emma).toContain('"20AM"');
    expect(emma).toContain('"KP30"');
    expect(emma).toContain('"BA3"');
    const variants = [
      { id: "master-rt10", code: "RT10", name: "Retatrutide" },
      { id: "master-5am", code: "5AM", name: "5-amino-1mq" },
      { id: "master-kpv", code: "KPV", name: "KPV" },
      { id: "master-ba10", code: "BA10", name: "BAC Water" },
      { id: "area-ad10", code: "AD10", name: "Adamax 1032" },
      { id: "area-20am", code: "20AM", name: "5-amino-1mq" },
      { id: "area-kp30", code: "KP30", name: "KPV" },
      { id: "area-ba3", code: "BA3", name: "BAC Water" },
    ];
    const requestable = new Set(["master-rt10", "master-5am", "master-kpv", "master-ba10"]);
    expect(kitRequestableVariants(variants, requestable).map((item) => item.code)).toEqual([
      "RT10",
      "5AM",
      "KPV",
      "BA10",
    ]);
    expect(isKitRequestableProductId("area-ad10", requestable)).toBe(false);
    expect(isKitRequestableProductId("master-rt10", requestable)).toBe(true);
    expect(isKitRequestableProductId("area-ad10", null)).toBe(true);
  });

  it("keeps the customer create error generic and logs the real detail", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const postgrest = { message: "Produkt wurde nicht gefunden.", code: "P0002" };
    expect(kitRequestFailureMessage(postgrest)).toBe(KIT_REQUEST_MUTATION_FAILED_MESSAGE);
    expect(kitRequestFailureMessage(new Error("42501"))).toBe(KIT_REQUEST_MUTATION_FAILED_MESSAGE);
    expect(kitRequestFailureMessage(new Error("Der Kit Anteil konnte nicht synchronisiert werden."))).toBe(
      KIT_REQUEST_MUTATION_FAILED_MESSAGE,
    );
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    expect(read("src/components/kit-requests/CreateKitRequestDialog.tsx")).toContain("kitRequestFailureMessage");
    expect(read("src/components/kit-requests/CreateKitRequestDialog.tsx")).not.toContain(
      "Der Kit Anteil konnte nicht synchronisiert werden.",
    );
  });

  it("keeps linked catalog groups visible and only disables vendor-only variants", () => {
    const wizard = read("src/components/kit-requests/CreateKitRequestDialog.tsx");
    const variants = [
      { id: "master-ad5", code: "AD5", name: "Adamax 1032" },
      { id: "area-ad10", code: "AD10", name: "Adamax 1032" },
      { id: "master-au100", code: "AU100", name: "AHK-CU" },
      { id: "area-au50", code: "AU50", name: "AHK-CU" },
    ];
    const requestable = new Set(["master-ad5", "master-au100"]);
    expect(kitRequestableVariants(variants, requestable).map((item) => item.code)).toEqual(["AD5", "AU100"]);
    expect(isKitRequestableProductId("master-ad5", requestable)).toBe(true);
    expect(isKitRequestableProductId("area-ad10", requestable)).toBe(false);
    expect(isKitRequestableProductId("master-au100", requestable)).toBe(true);
    expect(isKitRequestableProductId("area-au50", requestable)).toBe(false);
    expect(wizard).toContain("groupAndSortShopProducts(productsQuery.data ?? [])");
    expect(wizard).toContain("isKitRequestableProductId");
    expect(wizard).toContain("KIT_REQUEST_NOT_SHAREABLE_MESSAGE");
    expect(wizard).toContain("kitRequestableVariants");
    expect(wizard).not.toContain("filter((group) => group.variants.length > 0)");
    expect(read("src/components/shop/KitShareDialog.tsx")).toContain("kitRequestableVariants");
    expect(read("src/components/shop/ShopProductsTable.tsx")).toContain("CreateKitRequestDialog");
    expect(read("src/services/kitRequests.ts")).toContain("list_kit_requestable_product_ids");
    expect(read("src/hooks/useKitRequests.ts")).toContain("QUERY_KEYS.kitRequestableProductIds");
  });
});
