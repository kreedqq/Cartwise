import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  VENDOR_APPLY_FAILED,
  VENDOR_UPLOAD_FAILED,
  diffVendorCatalog,
  matchVendorCatalogRows,
  runVendorCatalogApply,
} from "@/lib/shop/vendorCatalog";
import type { ParsedProductImportRow } from "@/lib/productImportRow";
import type { Tables } from "@/types/database";

function makeProduct(code: string, price_usd = 100): Tables<"products"> {
  return {
    id: `id-${code.toLowerCase()}`,
    code,
    name: `Product ${code}`,
    description: null,
    dosage_vial: null,
    category: null,
    price_usd,
    bulk_price_usd: null,
    bulk_price_min_quantity: null,
    currency: "USD",
    is_active: true,
    last_price_change_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function makeImportRow(code: string, price_usd: number): ParsedProductImportRow {
  return {
    rowNumber: 1,
    rawText: `${code}\t${price_usd}`,
    parsedCode: code,
    parsedName: `Product ${code}`,
    parsedDosageVial: null,
    parsedDescription: null,
    parsedCategory: null,
    parsedPriceUsd: price_usd,
    parsedBulkPriceUsd: null,
    parsedBulkPriceMinQuantity: null,
    parsedIsActive: null,
    quality: "ok",
    qualityReason: null,
    extraFields: null,
  };
}

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("runVendorCatalogApply order", () => {
  it("1 – successful upload then catalog apply then old file cleanup", async () => {
    const calls: string[] = [];
    const result = await runVendorCatalogApply({
      previousStoragePath: "shop-area-docs/shop/old.xlsx",
      uploadNewFile: async () => {
        calls.push("upload");
        return { storage_path: "shop-area-docs/shop/new.xlsx", file_name: "Emma.xlsx" };
      },
      applyCatalog: async (document) => {
        calls.push(`apply:${document.storage_path}`);
        return { added: 23, removed: 10, skipped: 0, ...document };
      },
      removePreviousFile: async (path) => {
        calls.push(`remove:${path}`);
      },
    });

    expect(calls).toEqual([
      "upload",
      "apply:shop-area-docs/shop/new.xlsx",
      "remove:shop-area-docs/shop/old.xlsx",
    ]);
    expect(result.document.file_name).toBe("Emma.xlsx");
    expect(result.applied.added).toBe(23);
  });

  it("2 – upload failure never applies catalog or deletes the old file", async () => {
    const calls: string[] = [];
    await expect(
      runVendorCatalogApply({
        previousStoragePath: "shop-area-docs/shop/old.xlsx",
        uploadNewFile: async () => {
          calls.push("upload");
          throw new Error("storage 403");
        },
        applyCatalog: async () => {
          calls.push("apply");
          return { added: 1 };
        },
        removePreviousFile: async () => {
          calls.push("remove");
        },
      }),
    ).rejects.toThrow(VENDOR_UPLOAD_FAILED);

    expect(calls).toEqual(["upload"]);
  });

  it("3 – RPC failure keeps the previous catalog and does not delete the old file", async () => {
    const calls: string[] = [];
    await expect(
      runVendorCatalogApply({
        previousStoragePath: "shop-area-docs/shop/old.xlsx",
        uploadNewFile: async () => {
          calls.push("upload");
          return { storage_path: "shop-area-docs/shop/pending.xlsx", file_name: "neu.xlsx" };
        },
        applyCatalog: async () => {
          calls.push("apply");
          throw new Error("rpc failed");
        },
        removePreviousFile: async () => {
          calls.push("remove");
        },
      }),
    ).rejects.toThrow(VENDOR_APPLY_FAILED);

    expect(calls).toEqual(["upload", "apply"]);
  });

  it("4+5 – a successful new catalog replaces products and vendor prices together", () => {
    const products = [makeProduct("SM5", 100), makeProduct("SM10", 200), makeProduct("TR10", 50)];
    const previous = {
      entries: [
        { product_id: "id-sm5", vendor_code: "SM5", price_usd: 65 },
        { product_id: "id-sm10", vendor_code: "SM10", price_usd: 70 },
      ],
    };
    const next = matchVendorCatalogRows(
      [makeImportRow("TR10", 40), makeImportRow("SM10", 55)],
      products,
    );
    const { added, removed } = diffVendorCatalog(previous, next);
    expect(added).toEqual(["TR10"]);
    expect(removed).toEqual(["SM5"]);
    expect(next.matched.find((row) => row.code === "SM10")?.price_usd).toBe(55);
    expect(next.matched.find((row) => row.code === "TR10")?.price_usd).toBe(40);
    expect(next.matched.map((row) => row.code)).not.toContain("SM5");
  });

  it("6 – applied document identity is the uploaded file, not the previous file", async () => {
    const result = await runVendorCatalogApply({
      previousStoragePath: "shop-area-docs/group_buy_1/alt.xlsx",
      uploadNewFile: async () => ({
        storage_path: "shop-area-docs/group_buy_1/neu.xlsx",
        file_name: "GB1 neu.xlsx",
      }),
      applyCatalog: async (document) => ({ catalogId: "gb1", document }),
      removePreviousFile: async () => undefined,
    });
    expect(result.applied.document.file_name).toBe("GB1 neu.xlsx");
    expect(result.applied.document.storage_path).toBe("shop-area-docs/group_buy_1/neu.xlsx");
    expect(result.document.storage_path).not.toBe("shop-area-docs/group_buy_1/alt.xlsx");
  });

  it("7 – Shop / GB1 / GB2 document paths stay isolated", async () => {
    const applied: string[] = [];
    for (const area of ["shop", "group_buy_1", "group_buy_2"] as const) {
      await runVendorCatalogApply({
        previousStoragePath: null,
        uploadNewFile: async () => ({
          storage_path: `shop-area-docs/${area}/vendor.xlsx`,
          file_name: `${area}.xlsx`,
        }),
        applyCatalog: async (document) => {
          applied.push(document.storage_path);
          return document;
        },
        removePreviousFile: async () => undefined,
      });
    }
    expect(applied).toEqual([
      "shop-area-docs/shop/vendor.xlsx",
      "shop-area-docs/group_buy_1/vendor.xlsx",
      "shop-area-docs/group_buy_2/vendor.xlsx",
    ]);
  });

  it("8 – matching for apply does not mutate global products", () => {
    const products = [makeProduct("SM5", 100)];
    const snapshot = structuredClone(products);
    matchVendorCatalogRows([makeImportRow("SM5", 80)], products);
    expect(products).toEqual(snapshot);
  });
});

describe("apply workflow SQL stays on 0056/0057", () => {
  const sql0056 = read("supabase/migrations/0056_area_vendor_catalog.sql");
  const sql0057 = read("supabase/migrations/0057_vendor_catalog_raw.sql");
  const service = read("src/services/shopAreas.ts");

  it("9 – fail-closed checkout in 0056 is unchanged", () => {
    expect(sql0056).toContain("Ein Produkt gehört nicht zum aktuellen Händlerkatalog.");
    expect(sql0056).toMatch(/if not public\.product_visible_in_shop_area/);
    expect(sql0056).toMatch(/raise exception 'Ein Produkt gehört nicht zum aktuellen Händlerkatalog\.'/);
    expect(sql0056).not.toMatch(/update public\.products set price_usd/);
  });

  it("updates the applied document only inside apply_area_vendor_catalog", () => {
    expect(sql0057).toContain("drop function if exists public.apply_area_vendor_catalog(text, jsonb)");
    expect(sql0057).toContain("_storage_path");
    expect(sql0057).toContain("_file_name");
    expect(sql0057).toContain("Händlerkatalog braucht eine gespeicherte Händlerdatei.");
    expect(sql0057).toContain("insert into public.shop_area_documents");
    expect(sql0057).toContain("delete from public.shop_area_product_prices");
    expect(sql0057).not.toMatch(/update public\.products/);
    expect(service).toContain("storeVendorCatalogFile");
    expect(service.indexOf("storeVendorCatalogFile")).toBeLessThan(service.indexOf("applyAreaVendorCatalog("));
  });
});
