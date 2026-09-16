import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

import { auditVendorCatalogAgainstShop } from "@/lib/shop/vendorCatalogExcelAudit";
import { matchVendorCatalogRows } from "@/lib/shop/vendorCatalog";
import { parseVendorCatalogFile } from "@/services/vendorCatalogImport";
import { assertSafeLocalQaTarget } from "@/lib/qa/productionGuard";

const EMMA_XLSX = resolve(
  process.cwd(),
  "src/tests/fixtures/Emma_Group_Buy_1_Haendlerkatalog_bereinigt.xlsx",
);

const LOCAL_URL = process.env.VITE_SUPABASE_URL ?? "";
const LOCAL_ANON = process.env.VITE_SUPABASE_ANON_KEY ?? "";
const LOCAL_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const RUN = process.env.PEPTIX_GB1_LOCAL === "1";
const APPLY = process.env.PEPTIX_GB1_APPLY === "1";

describe.skipIf(!RUN)("GB1 Emma catalog local integration", () => {
  it("preview diff against group_buy_1 (read-only)", async () => {
    assertSafeLocalQaTarget({ supabaseUrl: LOCAL_URL });
    const client = createClient(LOCAL_URL, LOCAL_ANON);
    const { data: auth, error: signInError } = await client.auth.signInWithPassword({
      email: "qa-admin@local.test",
      password: "QaLocal-Admin-2026!",
    });
    expect(signInError).toBeNull();
    expect(auth.session).toBeTruthy();

    const buffer = readFileSync(EMMA_XLSX);
    const file = new File([buffer], "Emma_Group_Buy_1_Haendlerkatalog_bereinigt.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const parsed = await parseVendorCatalogFile(file);
    const { matched } = matchVendorCatalogRows(parsed.rows, []);
    expect(matched).toHaveLength(136);

    const [{ data: catalog }, { data: prices }, { data: products }] = await Promise.all([
      client.from("shop_area_products").select("*").eq("shop_area_key", "group_buy_1"),
      client.from("shop_area_product_prices").select("*").eq("shop_area_key", "group_buy_1"),
      client.from("products").select("*"),
    ]);

    const productById = new Map((products ?? []).map((p) => [p.id, p]));
    const summary = auditVendorCatalogAgainstShop(
      "group_buy_1",
      matched,
      catalog ?? [],
      prices ?? [],
      productById,
    );

    expect(summary.totalExcel).toBe(136);
    // Preview only — mismatches expected until import apply.
    expect(summary.lines.find((l) => l.code === "BA3")?.excelVariant).toBe("3ml*10vials");
  });

  it.skipIf(!APPLY)("apply Emma catalog with Excel prices forced and read back 136 matches", async () => {
    assertSafeLocalQaTarget({ supabaseUrl: LOCAL_URL });
    const client = createClient(LOCAL_URL, LOCAL_ANON);
    await client.auth.signInWithPassword({
      email: "qa-admin@local.test",
      password: "QaLocal-Admin-2026!",
    });

    const buffer = readFileSync(EMMA_XLSX);
    const file = new File([buffer], "Emma_Group_Buy_1_Haendlerkatalog_bereinigt.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const parsed = await parseVendorCatalogFile(file);
    const { matched } = matchVendorCatalogRows(parsed.rows, []);
    const rows = matched.map((entry) => ({
      vendor_code: entry.code,
      product_id: entry.product_id,
      price_usd: entry.price_usd,
      bulk_price_usd: null,
      bulk_price_min_quantity: null,
      vendor_name: entry.name,
      vendor_dosage: entry.dosage_vial,
      vendor_raw: entry.vendor_raw,
      imported_category_key: entry.imported_category_key,
    }));

    const storagePath = `shop-areas/group_buy_1/vendor/${Date.now()}_emma_integration.xlsx`;
    const storageClient = LOCAL_SERVICE
      ? createClient(LOCAL_URL, LOCAL_SERVICE, { auth: { persistSession: false } })
      : client;
    const { error: uploadError } = await storageClient.storage.from("pdf-imports").upload(storagePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });
    expect(uploadError).toBeNull();

    const { error: applyError } = await client.rpc("apply_area_vendor_catalog", {
      _area_key: "group_buy_1",
      _rows: rows,
      _storage_path: storagePath,
      _file_name: "Emma_Group_Buy_1_Haendlerkatalog_bereinigt.xlsx",
      _keep_manual_overrides: false,
    });
    expect(applyError).toBeNull();

    const [{ data: catalog }, { data: prices }, { data: products }] = await Promise.all([
      client.from("shop_area_products").select("*").eq("shop_area_key", "group_buy_1"),
      client.from("shop_area_product_prices").select("*").eq("shop_area_key", "group_buy_1"),
      client.from("products").select("*"),
    ]);
    const productById = new Map((products ?? []).map((p) => [p.id, p]));
    const readback = auditVendorCatalogAgainstShop(
      "group_buy_1",
      matched,
      catalog ?? [],
      prices ?? [],
      productById,
    );

    expect(catalog?.length).toBe(136);
    expect(readback.matched).toBe(136);
    expect(readback.priceMismatches).toBe(0);
    expect(readback.variantMismatches).toBe(0);
    expect(readback.productMismatches).toBe(0);
    expect(readback.missingInShop).toBe(0);
    expect(readback.duplicatesInShop).toBe(0);
  });
});
