#!/usr/bin/env node
/**
 * Local responsive browser matrix (localhost only).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  BASE,
  GENERATED_DIR,
  assertDevServer,
  acceptConsentIfNeeded,
  auditPrimaryTouchTargets,
  login,
  loadAccount,
  measureOverflow,
  requireQaAccounts,
} from "./browser-helpers.mjs";

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "390", width: 390, height: 844 },
  { name: "412", width: 412, height: 915 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
];

const MOBILE = new Set(["375", "390", "412"]);

const CUSTOMER_ROUTES = [
  "/login",
  "/dashboard",
  "/shop",
  "/shop/retail?category=peptides",
  "/shop/group-buy-1?category=peptides&search=QA",
  "/shop/group-buy-1/kit-gesuche",
  "/shop/group-buy-2",
  "/orders",
  "/profile",
];

const ADMIN_ROUTES = ["/admin", "/admin/kit-requests", "/admin/carts", "/admin/orders"];

async function main() {
  await assertDevServer();
  requireQaAccounts();

  const { chromium } = await import("playwright");
  const groupBuy = loadAccount("groupBuy");
  const admin = loadAccount("admin");

  const results = [];
  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    await login(page, groupBuy.email, groupBuy.password);
    await acceptConsentIfNeeded(page);
    for (const route of CUSTOMER_ROUTES) {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(800);
      const metrics = await measureOverflow(page);
      let touchFailures = [];
      if (MOBILE.has(vp.name)) {
        touchFailures = await auditPrimaryTouchTargets(page);
      }
      results.push({
        role: "customer",
        viewport: vp.name,
        route,
        ...metrics,
        touchFailures,
        pass: !metrics.overflow && touchFailures.length === 0,
      });
    }

    await context.close();

    const adminCtx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const adminPage = await adminCtx.newPage();
    await login(adminPage, admin.email, admin.password);
    await acceptConsentIfNeeded(adminPage);
    for (const route of ADMIN_ROUTES) {
      await adminPage.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
      await adminPage.waitForTimeout(800);
      const metrics = await measureOverflow(adminPage);
      let hasHealth = null;
      if (route === "/admin") {
        const health = adminPage.getByText("Systemstatus");
        await health.waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
        await health.scrollIntoViewIfNeeded().catch(() => {});
        hasHealth = await health.isVisible().catch(() => false);
      }
      let touchFailures = [];
      if (MOBILE.has(vp.name)) {
        touchFailures = await auditPrimaryTouchTargets(adminPage);
      }
      results.push({
        role: "admin",
        viewport: vp.name,
        route,
        ...metrics,
        touchFailures,
        systemHealthVisible: hasHealth,
        pass: !metrics.overflow && touchFailures.length === 0 && (route !== "/admin" || hasHealth === true),
      });
    }
    await adminCtx.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await login(page, groupBuy.email, groupBuy.password);
    await acceptConsentIfNeeded(page);
    const filterUrl = `${BASE}/shop/retail?category=peptides&search=QA`;
    await page.goto(filterUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    const afterReload = page.url();
    results.push({
      role: "customer",
      viewport: "1280",
      route: "url-filter-reload",
      pass: afterReload.includes("category=peptides") && afterReload.includes("search=QA"),
      overflow: false,
    });
    await page.waitForTimeout(2000);
    const eurText = await page.locator('[data-currency="eur"]').first().textContent().catch(() => "");
    const eurOk = eurText && !eurText.startsWith("—") && (eurText.includes("€") || eurText.includes("…"));
    results.push({
      role: "customer",
      viewport: "1280",
      route: "retail-eur-display",
      pass: Boolean(eurOk),
      eurSample: eurText?.trim().slice(0, 24),
    });
    await context.close();
  }

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  const outPath = resolve(GENERATED_DIR, "browser-matrix-results.json");
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, results }, null, 2));

  console.log(`Browser matrix: ${results.length} checks, ${failed.length} failed`);
  console.log(`Results: ${outPath}`);
  if (failed.length) {
    console.error(failed.slice(0, 15));
    process.exit(1);
  }
  console.log("BROWSER MATRIX PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
