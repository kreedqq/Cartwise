/**
 * Premium shop grid — final local visual + functional QA (localhost only).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

requireQaAccounts();

const OUT = resolve(GENERATED_DIR, "screenshots/premium-shop-grid-final");
const REPORT = resolve(GENERATED_DIR, "premium-shop-grid-final-report.json");

const TEST_CODE = "QA-GRID-IMAGE";
const TEST_NAME = "QA Grid Image Product";

/** Minimal valid JPEG for upload test (no external URLs). */
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=",
  "base64",
);

mkdirSync(OUT, { recursive: true });

function measureGrid(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const list = document.querySelector('[role="list"][aria-label="Produktkatalog"]');
    const cards = [...document.querySelectorAll('[data-testid="shop-product-card"]')];
    const visible = cards.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.top < vh && r.bottom > 0 && r.width > 0;
    });
    const rects = cards.slice(0, 8).map((el) => {
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    let columnCount = 0;
    if (visible.length >= 2) {
      const tops = visible.map((el) => Math.round(el.getBoundingClientRect().top));
      const firstTop = tops[0];
      columnCount = tops.filter((t) => Math.abs(t - firstTop) < 8).length;
    } else {
      columnCount = visible.length;
    }
    const gridStyle = list ? getComputedStyle(list) : null;
    const template = gridStyle?.gridTemplateColumns ?? "";
    const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    const firstCard = cards[0];
    const checks = firstCard
      ? {
          hasPlaceholderOrImg: Boolean(
            firstCard.querySelector("img[src]") || firstCard.querySelector('[aria-hidden="true"]'),
          ),
          hasEur: Boolean(firstCard.querySelector('[data-currency="eur"]')),
          hasUsd: Boolean(firstCard.querySelector('[data-currency="usd"]')),
          hasAddBtn: Boolean(firstCard.querySelector('button[class*="min-h-11"]')),
          hasFavorite: Boolean(firstCard.querySelector('button[aria-label*="Favorit"]')),
        }
      : null;
    return {
      viewport: { width: vw, height: vh },
      totalCards: cards.length,
      visibleCards: visible.length,
      estimatedColumnsInFirstRow: columnCount,
      gridTemplateColumns: template,
      sampleCardDimensions: rects,
      horizontalOverflow: overflowX,
      hasCatalogTable: Boolean(document.querySelector("table tbody tr")),
      firstCardChecks: checks,
    };
  });
}

const report = {
  capturedAt: new Date().toISOString(),
  baseUrl: BASE,
  migration0111: { appliedLocally: true },
  grids: {},
  cart: {},
  variant: {},
  adminProduct: {},
  import: {},
  accessibility: {},
  screenshots: [],
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
loadQaFile();
const kunde = loadAccount("kunde");
const admin = loadAccount("admin");
const groupBuy = loadAccount("groupBuy");

async function shot(page, file, path, account = kunde, viewport = { width: 1280, height: 800 }) {
  await page.setViewportSize(viewport);
  await login(page, account.email, account.password);
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForSelector('[data-testid="shop-product-card"], h1, main', { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const outPath = join(OUT, file);
  await page.screenshot({ path: outPath, fullPage: file.includes("hub") || file.includes("import") });
  report.screenshots.push(file);
  return outPath;
}

const page = await ctx.newPage();

// --- 1280 catalog shots ---
await shot(page, "01-shop-hub.png", "/shop");
await shot(page, "02-retail-peptides-grid.png", "/shop/retail?category=peptides");
report.grids["1280-peptides"] = await measureGrid(page);

await shot(page, "03-retail-oils-grid.png", "/shop/retail?category=injectable-oils");
await shot(page, "04-group-buy-grid.png", "/shop/group-buy-1?category=peptides", groupBuy);
await shot(page, "05-kit-marketplace.png", "/shop/group-buy-1/kit-gesuche", groupBuy);

// Cart drawer from grid
await login(page, kunde.email, kunde.password);
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(`${BASE}/shop/retail?category=peptides`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="shop-product-card"]', { timeout: 60_000 });
const addBtn = page.locator('[data-testid="shop-product-card"]').first().locator("button.min-h-11.w-full");
await addBtn.waitFor({ state: "visible", timeout: 60_000 });
await addBtn.click();
await page.waitForTimeout(2000);
const drawerOpen = await page
  .locator('aside[aria-label="Artikel hinzugefügt"]')
  .first()
  .isVisible()
  .catch(() => false);
report.cart = {
  addClicked: true,
  drawerOrDialogVisible: drawerOpen,
};
await page.screenshot({ path: join(OUT, "06-cart-drawer.png"), fullPage: false });
report.screenshots.push("06-cart-drawer.png");

// Variant price (if multi-variant card exists)
const multiCard = page.locator('[data-testid="shop-product-card"]').filter({ has: page.locator('[aria-label="Variante wählen"]') }).first();
if (await multiCard.count()) {
  const eurBefore = await multiCard.locator('[data-currency="eur"]').first().textContent();
  await multiCard.locator('[aria-label="Variante wählen"]').click();
  await page.locator('[role="option"]').nth(1).click();
  await page.waitForTimeout(400);
  const eurAfter = await multiCard.locator('[data-currency="eur"]').first().textContent();
  report.variant = { eurBefore: eurBefore?.trim(), eurAfter: eurAfter?.trim(), changed: eurBefore !== eurAfter };
} else {
  report.variant = { skipped: "no multi-variant card in view" };
}

// 1440 + 390 peptides grid
await login(page, kunde.email, kunde.password);
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${BASE}/shop/retail?category=peptides`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
report.grids["1440-peptides"] = await measureGrid(page);
await page.screenshot({ path: join(OUT, "02-retail-peptides-grid-1440.png"), fullPage: false });
report.screenshots.push("02-retail-peptides-grid-1440.png");

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/shop/retail?category=peptides`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
report.grids["390-peptides"] = await measureGrid(page);
await page.screenshot({ path: join(OUT, "02-retail-peptides-grid-390.png"), fullPage: false });
report.screenshots.push("02-retail-peptides-grid-390.png");

// Admin
await login(page, admin.email, admin.password);
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
await page.screenshot({ path: join(OUT, "07-admin-products.png"), fullPage: true });
report.screenshots.push("07-admin-products.png");

await page.goto(`${BASE}/admin/products/create`, { waitUntil: "networkidle" });
await page.screenshot({ path: join(OUT, "08-product-create.png"), fullPage: true });
report.screenshots.push("08-product-create.png");

await page.fill("#pf-name", TEST_NAME);
await page.fill("#pf-code", TEST_CODE);
await page.fill("#pf-category", "Peptides");
await page.fill("#pf-dosage", "5 mg / Vial");
await page.fill("#pf-price", "42.5");
await page.locator('input[type="file"]').setInputFiles({
  name: "qa-grid.jpg",
  mimeType: "image/jpeg",
  buffer: TINY_JPEG,
});
await page.getByRole("button", { name: "Produkt erstellen" }).click();
await page.waitForTimeout(3000);
report.adminProduct.createSubmitted = true;

const editLink = page.getByRole("link", { name: "Produkt öffnen" });
if (await editLink.isVisible().catch(() => false)) {
  await editLink.click();
} else {
  await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
  await page.getByPlaceholder(/Suche nach Code/i).fill(TEST_CODE);
  await page.waitForTimeout(800);
  const row = page.locator("tr", { hasText: TEST_CODE }).first();
  await row.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: "Bearbeiten" }).click();
}
await page.waitForSelector("#pf-name", { timeout: 30_000 });
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT, "09-product-edit.png"), fullPage: true });
report.screenshots.push("09-product-edit.png");
report.adminProduct.editFormLoaded = true;
report.adminProduct.imagePreview = await page.locator("img").filter({ hasNot: page.locator('[alt=""]') }).first().isVisible().catch(() => false);

// Cleanup test product
await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
await page.getByPlaceholder(/Suche nach Code/i).fill(TEST_CODE);
await page.waitForTimeout(800);
const delRow = page.locator("tr", { hasText: TEST_CODE }).first();
if (await delRow.isVisible().catch(() => false)) {
  await delRow.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: "Löschen" }).click();
  await page.getByRole("button", { name: /Endgültig löschen|Löschen/i }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
}
report.adminProduct.deletedAfterTest = !(await page.getByText(TEST_CODE).isVisible().catch(() => false));

// Import
execFileSync("npx vitest run src/tests/finalDensityImportEmit.test.ts", {
  cwd: resolve(process.cwd()),
  env: { ...process.env, FINAL_QA_EMIT: "1" },
  stdio: "pipe",
  shell: true,
});
const metricsPath = resolve(GENERATED_DIR, "import-metrics-temp.json");
report.import.metrics = existsSync(metricsPath) ? JSON.parse(readFileSync(metricsPath, "utf8")) : null;

await page.goto(`${BASE}/admin/pdf-import`, { waitUntil: "networkidle" });
const emmaCsv = "Abkürzung,Peptide,mg*10vials,Preis pro 10erKit in $\nKP10,KPV,10mg*10vials,60.85\n";
await page.locator('input[type="file"]').first().setInputFiles({
  name: "emma-snippet.csv",
  mimeType: "text/csv",
  buffer: Buffer.from(emmaCsv),
});
await page.waitForTimeout(3500);
report.import.uiPreview = await page.getByText(/Import-Vorschau|Vorschau/i).isVisible().catch(() => false);
await page.screenshot({ path: join(OUT, "10-import.png"), fullPage: true });
report.screenshots.push("10-import.png");

// Accessibility on retail peptides @ 1280
await login(page, kunde.email, kunde.password);
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(`${BASE}/shop/retail?category=peptides`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const axe = await new AxeBuilder({ page }).analyze();
const critical = axe.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
report.accessibility = {
  violationCount: axe.violations.length,
  criticalSeriousCount: critical.length,
  criticalSeriousIds: critical.map((v) => v.id),
};

writeFileSync(REPORT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
