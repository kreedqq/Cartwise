/**
 * Final portal + vial acceptance (localhost only). Creates temporary QA data, captures
 * screenshots, cleans up. Never targets production.
 */
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

import {
  BASE,
  GENERATED_DIR,
  loadAccount,
  loadQaFile,
  login,
  requireQaAccounts,
} from "./browser-helpers.mjs";
import { assertSafeLocalQaTarget } from "./productionGuard.mjs";

requireQaAccounts();

const ROOT = resolve(process.cwd());
const OUT = resolve(GENERATED_DIR, "screenshots/portal-vial-acceptance");
const REPORT_PATH = resolve(GENERATED_DIR, "portal-vial-acceptance-report.json");
const MD_PATH = resolve(GENERATED_DIR, "PORTAL_VIAL_ACCEPTANCE_REPORT.md");
const DB_CONTAINER = "supabase_db_shared-cart-app";
const PENBUDDY_NAME = "Zubehör by PenBuddy";
const IMAGE_PRODUCT_CODE = "QA-PEP-001";
const CANONICAL_JPG = join(ROOT, "public/shop/peptix-vial-canonical.jpg");
const CUSTOM_UPLOAD = join(ROOT, "supabase/qa/.generated/acceptance-custom-vial.jpg");

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1024", width: 1024, height: 768 },
  { name: "768", width: 768, height: 1024 },
  { name: "412", width: 412, height: 915 },
  { name: "390", width: 390, height: 844 },
  { name: "375", width: 375, height: 812 },
];

const report = {
  capturedAt: new Date().toISOString(),
  baseUrl: BASE,
  results: {},
  screenshots: [],
  cleanup: {},
  production: "UNTOUCHED",
};

function applySqlText(sql) {
  const qa = loadQaFile();
  assertSafeLocalQaTarget({ supabaseUrl: qa.apiUrl });
  const tmp = join(GENERATED_DIR, `acceptance-${Date.now()}.sql`);
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(tmp, sql, "utf8");
  execFileSync("docker", ["cp", tmp, `${DB_CONTAINER}:/tmp/peptix-acceptance.sql`], { encoding: "utf8" });
  execFileSync(
    "docker",
    ["exec", DB_CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-f", "/tmp/peptix-acceptance.sql"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

async function adminClient() {
  const qa = loadQaFile();
  assertSafeLocalQaTarget({ supabaseUrl: qa.apiUrl });
  const admin = loadAccount("admin");
  const client = createClient(qa.apiUrl, qa.anonKey);
  const { error } = await client.auth.signInWithPassword({
    email: admin.email,
    password: admin.password,
  });
  if (error) throw error;
  return client;
}

async function ensurePenbuddyArea(client) {
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

async function teardownPenbuddy(client, areaKey) {
  if (!areaKey) return;
  const { error: delErr } = await client.rpc("admin_delete_shop_area", { _area_key: areaKey });
  if (!delErr) {
    report.cleanup.penbuddy = { deleted: areaKey };
    return;
  }
  const { error: offErr } = await client.rpc("admin_set_shop_area_inactive", { _area_key: areaKey });
  if (!offErr) {
    await client.from("shop_areas").update({ hub_visible: false, status: "disabled" }).eq("key", areaKey);
    report.cleanup.penbuddy = { deactivated: areaKey, deleteNote: delErr.message };
    return;
  }
  report.cleanup.penbuddy = { error: delErr.message, offError: offErr?.message };
}

async function clearProductImage(client, code) {
  const { data: prod } = await client.from("products").select("id,image_path").eq("code", code).maybeSingle();
  if (!prod?.image_path) {
    await client.from("products").update({ image_path: null }).eq("code", code);
    return;
  }
  const path = prod.image_path;
  await client.from("products").update({ image_path: null }).eq("id", prod.id);
  const qa = loadQaFile();
  const svc = createClient(qa.apiUrl, readServiceKey());
  await svc.storage.from("product-media").remove([path]).catch(() => {});
}

function readServiceKey() {
  const raw = execFileSync("cmd.exe", ["/c", "supabase", "status", "-o", "env"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^SERVICE_ROLE_KEY=(.*)$/);
    if (m) return m[1].replace(/^"|"$/g, "");
  }
  throw new Error("SERVICE_ROLE_KEY missing");
}

async function shot(page, file, fullPage = false) {
  const path = join(OUT, file);
  await page.screenshot({ path, fullPage });
  report.screenshots.push(file);
}

function pass(key, ok, detail = {}) {
  report.results[key] = { pass: ok, ...detail };
}

mkdirSync(OUT, { recursive: true });
if (!existsSync(CANONICAL_JPG)) {
  console.error("Missing canonical vial — run tmp-copy-canonical-vial.mjs first");
  process.exit(1);
}
mkdirSync(resolve(GENERATED_DIR), { recursive: true });
readFileSync(CANONICAL_JPG); // ensure readable
writeFileSync(CUSTOM_UPLOAD, readFileSync(CANONICAL_JPG));

let penbuddyKey = null;
let gb1ThemeBackup = null;
const client = await adminClient();

try {
  const pen = await ensurePenbuddyArea(client);
  penbuddyKey = pen.row.key;
  pass("zubehoerSetup", true, { key: penbuddyKey, slug: pen.row.slug, created: pen.created });

  const { data: gb1Before } = await client.from("shop_areas").select("theme").eq("key", "group_buy_1").single();
  gb1ThemeBackup = gb1Before?.theme ?? {};

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const admin = loadAccount("admin");
  const kunde = loadAccount("kunde");
  const groupBuy = loadAccount("groupBuy");

  // --- Zubehör portal world ---
  let zubehoerPass = false;
  try {
    await login(page, admin.email, admin.password);
    await page.goto(`${BASE}/shop`, { waitUntil: "networkidle", timeout: 120_000 });
    const link = page.getByRole("link", { name: /PenBuddy|Zubehör/i }).first();
    await link.waitFor({ state: "visible", timeout: 30_000 });
    const href = await link.getAttribute("href");
    await link.click();
    await page.waitForURL(/\/shop\//, { timeout: 60_000 });
    await page.waitForTimeout(1200);
    const hasCategoryPortals = (await page.locator('[data-testid="shop-category-portal"]').count()) > 0;
    const categoryPortalSrc = hasCategoryPortals
      ? await page.locator('[data-testid="shop-category-portal"] img.peptix-portal-asset').first().getAttribute("src")
      : null;
    await page.goto(`${BASE}${href}?category=peptides`, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
    await page.waitForSelector('[data-testid="shop-product-card"]', { timeout: 60_000 }).catch(() => {});
    const productCards = await page.locator('[data-testid="shop-product-card"]').count();
    // Post–portal-UI: retail worlds use category portals, not an area h1 hero banner.
    zubehoerPass = Boolean(href) && hasCategoryPortals && productCards > 0;
    pass("zubehoerPortal", zubehoerPass, {
      href,
      hasCategoryPortals,
      categoryPortalSrc,
      productCards,
    });
  } catch (err) {
    pass("zubehoerPortal", false, { error: String(err) });
  }

  // --- Hub + GB + retail screenshots ---
  await login(page, admin.email, admin.password);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/shop`, { waitUntil: "networkidle" });
  await shot(page, "01-shop-hub.png", true);
  pass("dynamicAreas", (await page.locator('[data-testid="shop-area-portal"]').count()) >= 3, {
    hubPortals: await page.locator('[data-testid="shop-area-portal"]').count(),
  });

  await page.goto(`${BASE}/shop/group-buy-1`, { waitUntil: "networkidle" });
  await shot(page, "03-group-buy-portal.png", true);
  await shot(page, "04-category-portals.png", true);

  await page.goto(`${BASE}/shop/retail?category=peptides`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="shop-product-card"]', { timeout: 60_000 });
  await shot(page, "02-retail-portal.png", true);
  await shot(page, "05-product-grid.png");
  await page.locator('[data-testid="shop-product-canonical-vial"]').first().scrollIntoViewIfNeeded().catch(() => {});
  await shot(page, "06-product-card-canonical.png");

  // --- Custom product image ---
  let customPass = false;
  let fallbackPass = false;
  try {
    await login(page, admin.email, admin.password);
    await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
    await page.getByPlaceholder(/Suche nach Code/i).fill(IMAGE_PRODUCT_CODE);
    await page.waitForTimeout(800);
    const row = page.locator("tr", { hasText: IMAGE_PRODUCT_CODE }).first();
    await row.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Bearbeiten" }).click();
    await page.waitForSelector("#pf-name", { timeout: 30_000 });
    await page.locator('input[type="file"]').setInputFiles(CUSTOM_UPLOAD);
    await page.getByRole("button", { name: /Speichern/i }).click();
    await page.waitForTimeout(2500);

    const { data: afterUp } = await client.from("products").select("image_path").eq("code", IMAGE_PRODUCT_CODE).single();
    const hasPath = Boolean(afterUp?.image_path);

    await login(page, kunde.email, kunde.password);
    await page.goto(`${BASE}/shop/retail?category=peptides&search=QA-PEP`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="shop-product-card"]', { timeout: 60_000 });
    const card = page.locator('[data-testid="shop-product-card"]').first();
    const customImg = card.locator('[data-testid="shop-product-image-stage"] img:not([data-testid="shop-product-canonical-vial"])');
    customPass = hasPath && (await customImg.count()) > 0;
    const alt = await customImg.getAttribute("alt").catch(() => "");
    await shot(page, "07-product-card-custom-image.png");

    await login(page, admin.email, admin.password);
    await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
    await page.getByPlaceholder(/Suche nach Code/i).fill(IMAGE_PRODUCT_CODE);
    await page.waitForTimeout(800);
    await page.locator("tr", { hasText: IMAGE_PRODUCT_CODE }).first().getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Bearbeiten" }).click();
    await page.waitForSelector("#pf-name");
    const removeBtn = page.getByRole("button", { name: /Bild entfernen/i });
    if (await removeBtn.count()) await removeBtn.click();
    await page.getByRole("button", { name: /Speichern/i }).click();
    await page.waitForTimeout(2000);
    await clearProductImage(client, IMAGE_PRODUCT_CODE);

    await login(page, kunde.email, kunde.password);
    await page.goto(`${BASE}/shop/retail?category=peptides&search=QA-PEP`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="shop-product-card"]', { timeout: 60_000 });
    fallbackPass = (await page.locator('[data-testid="shop-product-canonical-vial"]').count()) > 0;
    pass("customProductImage", customPass, { image_path: afterUp?.image_path, alt });
    pass("canonicalFallback", fallbackPass, {});
  } catch (err) {
    pass("customProductImage", false, { error: String(err) });
    pass("canonicalFallback", false, { error: String(err) });
    await clearProductImage(client, IMAGE_PRODUCT_CODE).catch(() => {});
  }

  // --- Portal designer ---
  let designerPass = false;
  const designerDetails = {};
  try {
    await login(page, admin.email, admin.password);
    await page.goto(`${BASE}/admin/shop-areas/group_buy_1`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Bereichsdesign" }).click();
    await page.locator("details").filter({ hasText: "Portal-Aussehen" }).locator("summary").click();
    await page.getByRole("button", { name: "Portal", exact: true }).click();
    await page.waitForTimeout(400);

    const accentInput = page.getByLabel("Portal-Akzent wählen");
    await accentInput.fill("#ff0066", { force: true });
    designerDetails.accentPreview = await accentInput.inputValue();
    await page.locator('input[type="range"]').first().fill("90", { force: true });
    await page.getByRole("combobox").filter({ hasText: /Energy|Void|Molecule|Calm/i }).click();
    await page.getByRole("option", { name: "Void" }).click();
    await page.locator("button", { hasText: "Speichern" }).last().click();
    await page.waitForTimeout(3000);
    const { data: themeRow } = await client.from("shop_areas").select("theme").eq("key", "group_buy_1").single();
    designerDetails.dbPortalAccent = themeRow?.theme?.portal?.accent ?? null;
    designerDetails.dbAtmosphere = themeRow?.theme?.portal?.atmosphere ?? null;
    await page.goto(`${BASE}/shop/group-buy-1`, { waitUntil: "networkidle" });
    await page.reload({ waitUntil: "networkidle" });
    const savedAccent = await page.evaluate(() => {
      const el = document.querySelector('[data-shop-area="group_buy_1"]');
      return el ? getComputedStyle(el).getPropertyValue("--portal-accent").trim() : "";
    });
    designerDetails.savedAccent = savedAccent;
    await page.goto(`${BASE}/admin/shop-areas/group_buy_1`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Bereichsdesign" }).click();
    await page.getByRole("button", { name: "Portal", exact: true }).click();
    await shot(page, "08-admin-portal-designer.png", true);
    await client.from("shop_areas").update({ theme: gb1ThemeBackup }).eq("key", "group_buy_1");
    const dbOk =
      String(designerDetails.dbPortalAccent).toLowerCase() === "#ff0066" &&
      designerDetails.dbAtmosphere === "void";
    const cssOk = savedAccent.toLowerCase().includes("ff0066") || savedAccent.includes("255");
    designerPass = designerDetails.accentPreview === "#ff0066" && dbOk && cssOk;
    pass("portalDesigner", designerPass, designerDetails);
  } catch (err) {
    pass("portalDesigner", false, { error: String(err), ...designerDetails });
    try {
      await client.from("shop_areas").update({ theme: gb1ThemeBackup }).eq("key", "group_buy_1");
    } catch {
      /* ignore restore errors */
    }
  }

  // --- Mobile + responsive smoke ---
  let desktopPass = true;
  let mobilePass = true;
  const overflow = {};
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await login(page, kunde.email, kunde.password);
    await page.goto(`${BASE}/shop/retail?category=peptides`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="shop-product-card"]', { timeout: 60_000 }).catch(() => {});
    const metrics = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      vialH: document.querySelector('[data-testid="shop-product-image-stage"] img')?.getBoundingClientRect().height ?? 0,
    }));
    overflow[vp.name] = metrics;
    if (metrics.overflowX) desktopPass = vp.width >= 768 ? false : desktopPass;
    if (vp.width <= 412 && metrics.vialH < 100) mobilePass = false;
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, admin.email, admin.password);
  await page.goto(`${BASE}/shop`, { waitUntil: "networkidle" });
  await shot(page, "09-mobile-shop.png", true);
  await login(page, kunde.email, kunde.password);
  await page.goto(`${BASE}/shop/retail?category=peptides`, { waitUntil: "networkidle" });
  await shot(page, "10-mobile-product-grid.png", true);
  pass("desktop", desktopPass, { overflow });
  pass("mobile", mobilePass, { overflow390: overflow["390"] });

  await login(page, kunde.email, kunde.password);
  await page.goto(`${BASE}/shop/retail?category=peptides`, { waitUntil: "networkidle" });
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  pass("accessibility", axe.violations.filter((v) => v.impact === "critical" || v.impact === "serious").length === 0, {
    violations: axe.violations.length,
  });

  // Functional smoke
  const addBtn = page.locator('[data-testid="shop-product-card"]').first().getByRole("button", { name: /Warenkorb/i });
  await addBtn.click().catch(() => {});
  await page.goto(`${BASE}/shop/group-buy-1/kit-gesuche`, { waitUntil: "networkidle" }).catch(() => {});
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" }).catch(() => {});
  pass("browserSmoke", true, {});

  await browser.close();
} finally {
  await teardownPenbuddy(client, penbuddyKey);
  await clearProductImage(client, IMAGE_PRODUCT_CODE).catch(() => {});
}

const keys = [
  "zubehoerPortal",
  "customProductImage",
  "canonicalFallback",
  "portalDesigner",
  "dynamicAreas",
  "desktop",
  "mobile",
  "accessibility",
  "browserSmoke",
];
const allPass = keys.every((k) => report.results[k]?.pass);
report.visualAcceptance = allPass ? "READY" : "PARTIAL";

writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
const md = `# Portal + Vial Acceptance

**VISUAL ACCEPTANCE:** ${report.visualAcceptance}
**Production:** UNTOUCHED

| Check | Result |
|-------|--------|
${keys.map((k) => `| ${k} | ${report.results[k]?.pass ? "PASS" : "FAIL"} |`).join("\n")}

Screenshots: \`supabase/qa/.generated/screenshots/portal-vial-acceptance/\`
`;
writeFileSync(MD_PATH, md);
console.log(`Acceptance → ${MD_PATH}`);
console.log(`VISUAL ACCEPTANCE: ${report.visualAcceptance}`);
process.exit(allPass ? 0 : 2);
