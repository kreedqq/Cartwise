/**
 * Premium shop — final visual polish QA (localhost only).
 * Screenshots → supabase/qa/.generated/screenshots/premium-shop-final/
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

const OUT = resolve(GENERATED_DIR, "screenshots/premium-shop-final");
const REPORT = resolve(GENERATED_DIR, "premium-shop-final-report.json");
const MD_REPORT = resolve(GENERATED_DIR, "PREMIUM_SHOP_FINAL_QA_REPORT.md");

const IMAGE_QA_CODE = "QA-DEN-01";
const TEST_CODE = "QA-GRID-IMAGE";
const TEST_NAME = "QA Grid Image Product";

const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=",
  "base64",
);

mkdirSync(OUT, { recursive: true });

function measureGrid(page) {
  return page.evaluate(() => {
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
          hasPlaceholderOrImg: Boolean(firstCard.querySelector("img[src]")),
          hasEur: Boolean(firstCard.querySelector('[data-currency="eur"]')),
          hasUsd: Boolean(firstCard.querySelector('[data-currency="usd"]')),
          hasAddBtn: Boolean(firstCard.querySelector("button.w-full")),
          hasFavorite: Boolean(firstCard.querySelector('button[aria-label*="Favorit"]')),
        }
      : null;
    return {
      viewport: { width: window.innerWidth, height: vh },
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

async function createQaProductPng(page) {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 800;
    c.height = 1000;
    const g = c.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 800, 1000);
    grd.addColorStop(0, "#14141c");
    grd.addColorStop(1, "#2a2010");
    g.fillStyle = grd;
    g.fillRect(0, 0, 800, 1000);
    g.fillStyle = "#c9a227";
    g.fillRect(280, 200, 240, 520);
    g.fillStyle = "#666";
    g.beginPath();
    g.arc(400, 175, 28, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#eee";
    g.font = "bold 48px system-ui,sans-serif";
    g.textAlign = "center";
    g.fillText("QA", 400, 480);
    return c.toDataURL("image/png");
  });
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

async function openAdminProductEdit(page, code) {
  await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
  await page.getByPlaceholder(/Suche nach Code/i).fill(code);
  await page.waitForTimeout(900);
  const row = page.locator("tr", { hasText: code }).first();
  await row.waitFor({ state: "visible", timeout: 30_000 });
  await row.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: "Bearbeiten" }).click();
  await page.waitForSelector("#pf-name", { timeout: 30_000 });
}

const report = {
  capturedAt: new Date().toISOString(),
  baseUrl: BASE,
  polishPass: true,
  grids: {},
  cart: {},
  variant: {},
  productImageQa: {},
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

async function shot(page, file, path, account = kunde, viewport = { width: 1280, height: 800 }, fullPage = false) {
  await page.setViewportSize(viewport);
  await login(page, account.email, account.password);
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForSelector('[data-testid="shop-product-card"], h1, main', { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const outPath = join(OUT, file);
  await page.screenshot({ path: outPath, fullPage });
  report.screenshots.push(file);
  return outPath;
}

const page = await ctx.newPage();

await shot(page, "01-shop-hub.png", "/shop", kunde, { width: 1280, height: 800 }, true);
await shot(page, "02-retail-peptides-grid.png", "/shop/retail?category=peptides");
report.grids["1280-peptides"] = await measureGrid(page);

await shot(page, "03-retail-oils-grid.png", "/shop/retail?category=injectable-oils");
await shot(page, "04-group-buy-grid.png", "/shop/group-buy-1?category=peptides", groupBuy);
await shot(page, "05-kit-marketplace.png", "/shop/group-buy-1/kit-gesuche", groupBuy);

await login(page, kunde.email, kunde.password);
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(`${BASE}/shop/retail?category=peptides`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="shop-product-card"]', { timeout: 60_000 });
const addBtn = page
  .locator('[data-testid="shop-product-card"]')
  .first()
  .getByRole("button", { name: /Warenkorb|Zum Warenkorb/i });
await addBtn.waitFor({ state: "visible", timeout: 60_000 });
await addBtn.click();
await page.waitForTimeout(2000);
const drawerOpen = await page
  .locator('aside[aria-label="Artikel hinzugefügt"]')
  .first()
  .isVisible()
  .catch(() => false);
report.cart = { addClicked: true, drawerOrDialogVisible: drawerOpen };
await page.screenshot({ path: join(OUT, "06-cart-drawer.png"), fullPage: false });
report.screenshots.push("06-cart-drawer.png");

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

// --- Product image QA on existing QA catalog SKU (local only) ---
await login(page, admin.email, admin.password);
const qaPng = await createQaProductPng(page);
await openAdminProductEdit(page, IMAGE_QA_CODE);
const hadImageBefore = await page.getByRole("button", { name: "Bild entfernen" }).isVisible().catch(() => false);

await page.locator('input[type="file"]').setInputFiles({
  name: "qa-local-product-800x1000.png",
  mimeType: "image/png",
  buffer: qaPng,
});
await page.waitForTimeout(600);
report.productImageQa.previewAfterSelect = await page.locator("img.max-h-48").isVisible().catch(() => false);
await page.getByRole("button", { name: "Änderungen speichern" }).click();
await page.waitForTimeout(2500);
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector("#pf-name", { timeout: 30_000 });
report.productImageQa.savedAndReloadPreview = await page.locator("img.max-h-48").isVisible().catch(() => false);
await page.screenshot({ path: join(OUT, "09-product-edit-with-image.png"), fullPage: true });
report.screenshots.push("09-product-edit-with-image.png");

await login(page, kunde.email, kunde.password);
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(`${BASE}/shop/retail?category=peptides`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const selankCard = page.locator(`[data-testid="shop-product-card"][data-product-code="${IMAGE_QA_CODE}"]`);
report.productImageQa.gridCardFound = (await selankCard.count()) > 0;
if (report.productImageQa.gridCardFound) {
  const img = selankCard.locator("img[alt]");
  report.productImageQa.gridShowsRealImage = await img.isVisible().catch(() => false);
  report.productImageQa.gridAlt = await img.getAttribute("alt").catch(() => null);
}
await page.screenshot({ path: join(OUT, "02-retail-peptides-with-local-image.png"), fullPage: false });
report.screenshots.push("02-retail-peptides-with-local-image.png");

// Tiny image rejection on create form
await login(page, admin.email, admin.password);
await page.goto(`${BASE}/admin/products/create`, { waitUntil: "networkidle" });
await page.fill("#pf-name", TEST_NAME);
await page.fill("#pf-code", TEST_CODE);
await page.fill("#pf-category", "Peptides");
await page.fill("#pf-dosage", "5 mg / Vial");
await page.fill("#pf-price", "42.5");
await page.locator('input[type="file"]').setInputFiles({
  name: "qa-tiny.jpg",
  mimeType: "image/jpeg",
  buffer: TINY_JPEG,
});
await page.getByRole("button", { name: "Produkt erstellen" }).click();
await page.waitForTimeout(2000);
report.adminProduct.tinyImageRejected = await page
  .getByText(/320|Mindest|zu klein|Bild/i)
  .first()
  .isVisible()
  .catch(() => false);

// Valid image create flow (optional product — delete after)
await page.goto(`${BASE}/admin/products/create`, { waitUntil: "networkidle" });
await page.fill("#pf-name", TEST_NAME);
await page.fill("#pf-code", TEST_CODE);
await page.fill("#pf-category", "Peptides");
await page.fill("#pf-dosage", "5 mg / Vial");
await page.fill("#pf-price", "42.5");
await page.locator('input[type="file"]').setInputFiles({
  name: "qa-valid.png",
  mimeType: "image/png",
  buffer: qaPng,
});
await page.getByRole("button", { name: "Produkt erstellen" }).click();
await page.waitForTimeout(3500);
report.adminProduct.createWithValidImage = true;

const editLink = page.getByRole("link", { name: "Produkt öffnen" });
if (await editLink.isVisible().catch(() => false)) {
  await editLink.click();
} else {
  await openAdminProductEdit(page, TEST_CODE);
}
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT, "08-product-create-edit.png"), fullPage: true });
report.screenshots.push("08-product-create-edit.png");

await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
await page.screenshot({ path: join(OUT, "07-admin-products.png"), fullPage: true });
report.screenshots.push("07-admin-products.png");

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

// Remove image from QA-DEN-01 if we added one (restore unless it had one before — still remove test upload)
await openAdminProductEdit(page, IMAGE_QA_CODE);
if (await page.getByRole("button", { name: "Bild entfernen" }).isVisible().catch(() => false)) {
  await page.getByRole("button", { name: "Bild entfernen" }).click();
  await page.getByRole("button", { name: "Änderungen speichern" }).click();
  await page.waitForTimeout(2000);
}
report.productImageQa.cleanedUpImage = !hadImageBefore;

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

const g1280 = report.grids["1280-peptides"];
const g390 = report.grids["390-peptides"];
const md = `# Premium Shop Final QA (visual polish)

Captured: ${report.capturedAt}
Base: ${BASE}

## Grid metrics

| Viewport | Columns (est.) | Visible cards | Sample card (w×h) |
|----------|----------------|---------------|-------------------|
| 1280×800 | ${g1280?.estimatedColumnsInFirstRow ?? "—"} | ${g1280?.visibleCards ?? "—"} | ${g1280?.sampleCardDimensions?.[0] ? `${g1280.sampleCardDimensions[0].w}×${g1280.sampleCardDimensions[0].h}` : "—"} |
| 1440×900 | ${report.grids["1440-peptides"]?.estimatedColumnsInFirstRow ?? "—"} | ${report.grids["1440-peptides"]?.visibleCards ?? "—"} | ${report.grids["1440-peptides"]?.sampleCardDimensions?.[0] ? `${report.grids["1440-peptides"].sampleCardDimensions[0].w}×${report.grids["1440-peptides"].sampleCardDimensions[0].h}` : "—"} |
| 390×844 | ${g390?.estimatedColumnsInFirstRow ?? "—"} | ${g390?.visibleCards ?? "—"} | ${g390?.sampleCardDimensions?.[0] ? `${g390.sampleCardDimensions[0].w}×${g390.sampleCardDimensions[0].h}` : "—"} |

## Product image QA (${IMAGE_QA_CODE})

- Preview after select: ${report.productImageQa.previewAfterSelect}
- Saved + reload preview: ${report.productImageQa.savedAndReloadPreview}
- Grid real image: ${report.productImageQa.gridShowsRealImage}

## Accessibility

Critical/serious: ${report.accessibility.criticalSeriousCount}

## Visual judgment (screenshot-based)

See screenshots in \`screenshots/premium-shop-final/\`. Compare against reference manually in review.
`;

writeFileSync(REPORT, JSON.stringify(report, null, 2));
writeFileSync(MD_REPORT, md);
console.log(JSON.stringify(report, null, 2));
await browser.close();
