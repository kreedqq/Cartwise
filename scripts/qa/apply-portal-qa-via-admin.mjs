/**

 * Applies LOCAL QA portal assignments through Admin UI (not raw SQL),

 * optional proof screenshots. Restores themes unless PEPTIX_PORTAL_QA_SKIP_RESTORE=1.

 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join, resolve } from "node:path";

import { chromium } from "playwright";

import { createClient } from "@supabase/supabase-js";



import {

  ACCOUNTS_PATH,

  GENERATED_DIR,

  loadAccount,

  loadQaFile,

  login,

  requireQaAccounts,

} from "./browser-helpers.mjs";

import { assertSafeLocalQaTarget } from "./productionGuard.mjs";

import { startQaDevServer } from "./qa-dev-server.mjs";
import {
  PORTAL_OPTION_LABEL,
  QA_AREA_PORTALS,
  QA_CATEGORY_PORTALS,
} from "./portal-qa-config.mjs";
import { ensurePenbuddyQaArea } from "./penbuddy-qa-area.mjs";

requireQaAccounts();

const OUT = resolve(GENERATED_DIR, "screenshots/final-visual-acceptance");
const BACKUP = resolve(GENERATED_DIR, "portal-theme-backup.json");
const SKIP_RESTORE = process.env.PEPTIX_PORTAL_QA_SKIP_RESTORE === "1";
const MANAGE_VITE = process.env.PEPTIX_MANAGE_QA_VITE !== "0";



async function backupThemes(client) {

  const { data, error } = await client.from("shop_areas").select("key, theme");

  if (error) throw error;

  writeFileSync(BACKUP, JSON.stringify(data ?? [], null, 2));

}



async function restoreThemes(client) {

  if (!readFileSync(BACKUP, "utf8")) return;

  const rows = JSON.parse(readFileSync(BACKUP, "utf8"));

  for (const row of rows) {

    await client.from("shop_areas").update({ theme: row.theme }).eq("key", row.key);

  }

}



async function assignAreaPortal(page, base, areaKey, assetId) {

  await page.goto(`${base}/admin/shop-areas/${areaKey}`, { waitUntil: "networkidle", timeout: 120_000 });

  await page.getByRole("tab", { name: "Bereichsdesign" }).click();

  await page.locator("summary").filter({ hasText: /^Portal$/ }).click();

  await page.getByTestId(`portal-asset-${assetId}`).click();

  const save = page.getByTestId("area-design-save");

  await save.waitFor({ state: "visible" });

  if (await save.isEnabled()) {
    await save.click();
    await page.waitForTimeout(1000);
  }

}



async function assignCategoryPortalByKey(page, base, areaKey, categoryKey, assetId) {
  const optionLabel = PORTAL_OPTION_LABEL[assetId];
  if (!optionLabel) throw new Error(`Unknown asset ${assetId}`);
  await page.goto(`${base}/admin/shop-areas/${areaKey}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByRole("tab", { name: "Bereichsdesign" }).click();
  await page.locator("summary").filter({ hasText: /^Portal$/ }).click();
  await page.getByTestId(`category-portal-select-${categoryKey}`).click();
  await page.getByRole("option", { name: optionLabel, exact: true }).click();
  const save = page.getByTestId("area-design-save");
  if (await save.isEnabled()) {
    await save.click();
    await page.waitForTimeout(1000);
  }
}

async function clearCategoryPortalByKey(page, base, areaKey, categoryKey) {
  await page.goto(`${base}/admin/shop-areas/${areaKey}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByRole("tab", { name: "Bereichsdesign" }).click();
  await page.locator("summary").filter({ hasText: /^Portal$/ }).click();
  await page.getByTestId(`category-portal-select-${categoryKey}`).click();
  await page.getByRole("option", { name: "Bereichs-Portal übernehmen" }).click();
  const save = page.getByTestId("area-design-save");
  if (await save.isEnabled()) {
    await save.click();
    await page.waitForTimeout(1000);
  }
}

const qa = loadQaFile();

assertSafeLocalQaTarget({ supabaseUrl: qa.apiUrl });

const admin = loadAccount("admin");

const client = createClient(qa.apiUrl, qa.anonKey);

const { error: signInError } = await client.auth.signInWithPassword({

  email: admin.email,

  password: admin.password,

});

if (signInError) throw signInError;

if (process.env.PEPTIX_PORTAL_QA_RESTORE_ONLY === "1") {
  await restoreThemes(client);
  console.log("Themes restored from backup.");
  process.exit(0);
}

if (process.env.PEPTIX_PORTAL_QA_SKIP_BACKUP !== "1") {
  await backupThemes(client);
}



let viteChild = null;

let base = process.env.PEPTIX_DEV_URL?.replace(/\/$/, "");

if (MANAGE_VITE && !base) {

  const started = await startQaDevServer(ACCOUNTS_PATH, Number(process.env.PEPTIX_BROWSER_DEV_PORT ?? 5190));

  base = started.base;

  viteChild = started.child;

  process.env.PEPTIX_DEV_URL = base;

} else if (!base) {

  throw new Error("Set PEPTIX_DEV_URL to local QA Vite or allow PEPTIX_MANAGE_QA_VITE");

}



mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

const page = await browser.newPage();



try {

  await login(page, admin.email, admin.password);



  for (const row of QA_AREA_PORTALS) {
    await assignAreaPortal(page, base, row.key, row.asset);
  }



  const pen = await ensurePenbuddyQaArea(client);
  console.log(`PenBuddy QA area: ${pen.row.key} (created=${pen.created})`);
  await assignAreaPortal(page, base, pen.row.key, "portal_green");



  const { data: gb1Cats } = await client
    .from("shop_area_categories")
    .select("category_key,label")
    .eq("shop_area_key", "group_buy_1");
  for (const [categoryKey, assetId] of Object.entries(QA_CATEGORY_PORTALS)) {
    const row = (gb1Cats ?? []).find((c) => c.category_key === categoryKey);
    if (!row) {
      console.warn(`Category key missing in DB: ${categoryKey}`);
      continue;
    }
    console.log(`Assign category ${categoryKey} (${row.label}) → ${assetId}`);
    try {
      await assignCategoryPortalByKey(page, base, "group_buy_1", categoryKey, assetId);
    } catch (err) {
      console.warn(`Category ${categoryKey} skip:`, err.message);
    }
  }



  if (process.env.PEPTIX_PORTAL_FALLBACK_TEST === "1") {
    await assignCategoryPortalByKey(page, base, "group_buy_1", "peptides", "portal_purple");
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, loadAccount("groupBuy").email, loadAccount("groupBuy").password);
    await page.goto(`${base}/shop/group-buy-1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    let src = await page
      .locator('[data-category-key="peptides"] img.peptix-portal-asset')
      .getAttribute("src");
    if (!src?.includes("portal_purple")) console.warn("Fallback A: expected purple, got", src);
    await page.screenshot({ path: join(OUT, "16-fallback-category-1440.png") });

    await login(page, admin.email, admin.password);
    await clearCategoryPortalByKey(page, base, "group_buy_1", "peptides");
    await login(page, loadAccount("groupBuy").email, loadAccount("groupBuy").password);
    await page.goto(`${base}/shop/group-buy-1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    src = await page.locator('[data-category-key="peptides"] img.peptix-portal-asset').getAttribute("src");
    if (!src?.includes("portal_cyan")) console.warn("Fallback B: expected area cyan after clear, got", src);
    await page.screenshot({ path: join(OUT, "17-fallback-area-1440.png") });
  }



  const groupBuy = loadAccount("groupBuy");
  const hubUser = loadAccount("admin");

  await page.setViewportSize({ width: 1440, height: 900 });

  await login(page, hubUser.email, hubUser.password);

  await page.goto(`${base}/shop`, { waitUntil: "networkidle" });

  const hubPortalImg = page.locator('[data-testid="shop-area-portal"] img.peptix-portal-asset').first();
  await hubPortalImg.waitFor({ state: "visible", timeout: 60_000 });

  await page.waitForTimeout(800);

  await page.screenshot({ path: join(OUT, "13-portal-assignment-proof-1440.png") });

  const portals = await page.locator('[data-testid="shop-area-portal"] img.peptix-portal-asset').all();

  const srcs = await Promise.all(portals.map((p) => p.getAttribute("src")));

  console.log("Hub portal srcs:", srcs);
  if (portals.length < 2) {
    throw new Error(`Hub proof: expected >=2 area portals, got ${portals.length} (use multi-area user, not single-area redirect)`);
  }

  await login(page, groupBuy.email, groupBuy.password);

  await page.goto(`${base}/shop/group-buy-1`, { waitUntil: "networkidle" });

  await page.waitForTimeout(1200);

  await page.screenshot({ path: join(OUT, "14-category-assignment-proof-1440.png") });



  await page.goto(`${base}/shop/group-buy-1?category=peptides`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, "15-vial-assignment-proof-1440.png") });

  await login(page, admin.email, admin.password);
  await page.goto(`${base}/shop`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, "18-penbuddy-green-1440.png") });

  await login(page, groupBuy.email, groupBuy.password);
  await page.goto(`${base}/shop/group-buy-1`, { waitUntil: "networkidle" });
  await page.locator('[data-testid="shop-category-portal"]').first().waitFor({ state: "visible", timeout: 60_000 });
  const oilsImg = page.locator('[data-category-key="injectable-oils"] img.peptix-portal-asset');
  await oilsImg.waitFor({ state: "visible", timeout: 60_000 });
  await oilsImg.scrollIntoViewIfNeeded();
  const oilsSrc = await oilsImg.getAttribute("src");
  console.log("Injectable oils portal src:", oilsSrc);
  await page.screenshot({ path: join(OUT, "19-oils-orange-1440.png") });

} finally {

  await browser.close();

  if (!SKIP_RESTORE) {

    await restoreThemes(client);

    console.log("Themes restored from backup.");

  } else {

    console.log("PEPTIX_PORTAL_QA_SKIP_RESTORE=1 — themes left at QA assignments for capture.");

  }

  if (viteChild && !viteChild.killed && process.env.PEPTIX_KEEP_QA_VITE !== "1") {
    viteChild.kill("SIGTERM");
  }
}



console.log("Portal QA via Admin UI complete.");


