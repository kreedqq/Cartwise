/** Ensures local QA "Zubehör by PenBuddy" shop area (hub-visible). Local only. */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { GENERATED_DIR, loadQaFile } from "./browser-helpers.mjs";
import { assertSafeLocalQaTarget } from "./productionGuard.mjs";

export const PENBUDDY_NAME = "Zubehör by PenBuddy";
const DB_CONTAINER = "supabase_db_shared-cart-app";
const ROOT = resolve(process.cwd());

function applySqlText(sql) {
  const qa = loadQaFile();
  assertSafeLocalQaTarget({ supabaseUrl: qa.apiUrl });
  const tmp = join(GENERATED_DIR, `penbuddy-qa-${Date.now()}.sql`);
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(tmp, sql, "utf8");
  execFileSync("docker", ["cp", tmp, `${DB_CONTAINER}:/tmp/peptix-penbuddy-qa.sql`], { encoding: "utf8" });
  execFileSync(
    "docker",
    ["exec", DB_CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-f", "/tmp/peptix-penbuddy-qa.sql"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

/** @param {import("@supabase/supabase-js").SupabaseClient} client */
export async function ensurePenbuddyQaArea(client) {
  const { data: existing } = await client.from("shop_areas").select("*").ilike("name", `%PenBuddy%`);
  if (existing?.length) {
    const row = existing[0];
    await client
      .from("shop_areas")
      .update({ status: "active", hub_visible: true, is_active: true })
      .eq("key", row.key);
    return { row, created: false };
  }
  const { data, error } = await client.rpc("admin_create_shop_area", {
    _name: PENBUDDY_NAME,
    _template: "retail",
    _source_key: "shop",
    _copy_categories: true,
    _copy_roles: true,
    _copy_design: false,
  });
  if (error) throw error;
  const key = data.key;
  const theme = {
    portal: {
      enabled: true,
      accent: "#2ecf8e",
      glow: 72,
      atmosphere: "calm",
      backgroundImage: "",
      image: "",
      assetId: "portal_green",
      customAsset: "",
    },
  };
  const { error: upErr } = await client
    .from("shop_areas")
    .update({
      subtitle: "Zubehör & Accessories · PenBuddy",
      icon_key: "package",
      theme,
    })
    .eq("key", key);
  if (upErr) throw upErr;

  applySqlText(`
    insert into public.shop_area_products (
      shop_area_key, product_id, vendor_code, vendor_name, vendor_dosage, is_active, imported_category_key
    )
    select '${key}', sap.product_id, sap.vendor_code, sap.vendor_name, sap.vendor_dosage, sap.is_active, sap.imported_category_key
    from public.shop_area_products sap
    where sap.shop_area_key = 'shop' and sap.is_active = true
    on conflict (shop_area_key, vendor_code) do update set is_active = true;
  `);
  return { row: data, created: true };
}
