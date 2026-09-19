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
import {
  InfrastructureBlockedError,
  assertViteResponsive,
  matrixLog,
  probeViteHttp,
} from "./qa-vite-watchdog.mjs";

export const MATRIX_VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "390", width: 390, height: 844 },
  { name: "412", width: 412, height: 915 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
];

function resolveViewportsForRun() {
  const only = process.env.PEPTIX_MATRIX_VIEWPORT?.trim();
  if (!only) return MATRIX_VIEWPORTS;
  const picked = MATRIX_VIEWPORTS.filter((v) => v.name === only);
  if (!picked.length) {
    throw new Error(`PEPTIX_MATRIX_VIEWPORT unknown: ${only}`);
  }
  return picked;
}

function shouldRunRetailFilter() {
  const only = process.env.PEPTIX_MATRIX_VIEWPORT?.trim();
  if (!only) return process.env.PEPTIX_MATRIX_INCLUDE_RETAIL !== "0";
  return process.env.PEPTIX_MATRIX_INCLUDE_RETAIL === "1";
}

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

const NAV_TIMEOUT_MS = 60_000;
const GLOBAL_MATRIX_MS = Number(process.env.PEPTIX_MATRIX_GLOBAL_TIMEOUT_MS ?? 50 * 60 * 1000);

function createMatrixState() {
  return {
    phase: "init",
    viewport: null,
    route: null,
    role: null,
    lastSuccess: null,
    startedAt: Date.now(),
  };
}

function assertGlobalDeadline(state) {
  const elapsed = Date.now() - state.startedAt;
  if (elapsed <= GLOBAL_MATRIX_MS) return;
  throw new InfrastructureBlockedError("MATRIX_GLOBAL_TIMEOUT", {
    elapsedMs: elapsed,
    limitMs: GLOBAL_MATRIX_MS,
    phase: state.phase,
    viewport: state.viewport,
    route: state.route,
    role: state.role,
    lastSuccess: state.lastSuccess,
    viteHealth: null,
  });
}

async function assertGlobalDeadlineWithHealth(state) {
  try {
    assertGlobalDeadline(state);
  } catch (err) {
    if (err instanceof InfrastructureBlockedError) {
      err.detail.viteHealth = await probeViteHttp(BASE, 8_000);
    }
    throw err;
  }
}

function matrixResultsPath() {
  const tag = process.env.PEPTIX_MATRIX_RESULTS_TAG?.trim();
  const file = tag ? `browser-matrix-results-${tag}.json` : "browser-matrix-results.json";
  return resolve(GENERATED_DIR, file);
}

function writeMatrixResults(payload) {
  const outPath = matrixResultsPath();
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Results: ${outPath}`);
}

async function matrixNavigate(page, state, { viewport, route, role, waitUntil = "domcontentloaded" }) {
  state.phase = "navigation";
  state.viewport = viewport;
  state.route = route;
  state.role = role;
  await assertGlobalDeadlineWithHealth(state);
  await assertViteResponsive(BASE, { ...state });

  const url = `${BASE}${route}`;
  matrixLog(viewport, route, "navigation=start", { url, role });

  try {
    await page.goto(url, { waitUntil, timeout: NAV_TIMEOUT_MS });
    matrixLog(viewport, route, "navigation=success", { role });
    state.lastSuccess = { viewport, route, role, url, at: new Date().toISOString() };
  } catch (err) {
    const viteHealth = await probeViteHttp(BASE, 8_000);
    matrixLog(viewport, route, "navigation=TIMEOUT", {
      role,
      url,
      error: err instanceof Error ? err.message : String(err),
      viteHealth,
      lastSuccess: state.lastSuccess,
    });
    if (!viteHealth.ok) {
      throw new InfrastructureBlockedError("VITE_UNRESPONSIVE", {
        during: "navigation",
        viewport,
        route,
        role,
        url,
        viteHealth,
        lastSuccess: state.lastSuccess,
      });
    }
    throw err;
  }
}

async function matrixLogin(page, state, { viewport, role, email, password }) {
  state.phase = `login-${role}`;
  state.viewport = viewport;
  state.route = "/login";
  state.role = role;
  matrixLog(viewport, "/login", `login-${role}=start`);
  await assertGlobalDeadlineWithHealth(state);
  await assertViteResponsive(BASE, { ...state });
  await login(page, email, password);
  matrixLog(viewport, "/login", `login-${role}=success`);
  state.lastSuccess = { viewport, route: "/login", role, phase: state.phase, at: new Date().toISOString() };
}

/** Retail filter/reload — run before heavy viewport matrix (dev server still fresh). */
async function runRetailFilterChecks(browser, results, state) {
  state.phase = "retail-filter";
  matrixLog("1280", "url-filter-reload", "phase=start");
  await assertViteResponsive(BASE, { ...state });

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const groupBuy = loadAccount("groupBuy");
  try {
    await matrixLogin(page, state, {
      viewport: "1280",
      role: "customer",
      email: groupBuy.email,
      password: groupBuy.password,
    });
    await acceptConsentIfNeeded(page);

    const filterUrl = `${BASE}/shop/retail?category=peptides&search=QA`;
    matrixLog("1280", "url-filter-reload", "navigation=start", { url: filterUrl });
    await assertViteResponsive(BASE, { ...state });
    await page.goto(filterUrl, { waitUntil: "networkidle", timeout: 120_000 });
    await page
      .getByRole("list", { name: "Produktkatalog" })
      .locator("article")
      .first()
      .waitFor({ timeout: 60_000 });
    matrixLog("1280", "url-filter-reload", "navigation=success");
    state.lastSuccess = { viewport: "1280", route: "url-filter-reload", url: filterUrl };

    matrixLog("1280", "url-filter-reload", "reload=start");
    await assertViteResponsive(BASE, { ...state });
    await page.reload({ waitUntil: "networkidle", timeout: 120_000 });
    matrixLog("1280", "url-filter-reload", "reload=success");

    const afterReload = page.url();
    results.push({
      role: "customer",
      viewport: "1280",
      route: "url-filter-reload",
      pass: afterReload.includes("category=peptides") && afterReload.includes("search=QA"),
      overflow: false,
    });
    await page.waitForTimeout(500);
    const eurText = await page.locator('[data-currency="eur"]').first().textContent().catch(() => "");
    const eurOk = eurText && !eurText.startsWith("—") && (eurText.includes("€") || eurText.includes("…"));
    results.push({
      role: "customer",
      viewport: "1280",
      route: "retail-eur-display",
      pass: Boolean(eurOk),
      eurSample: eurText?.trim().slice(0, 24),
    });
    matrixLog("1280", "url-filter-reload", "phase=PASS");
  } finally {
    await context.close();
  }
}

async function main() {
  await assertDevServer();
  requireQaAccounts();
  await assertViteResponsive(BASE);
  console.log("MATRIX START (Vite HTTP OK)");

  const state = createMatrixState();
  const { chromium } = await import("playwright");
  const groupBuy = loadAccount("groupBuy");
  const admin = loadAccount("admin");

  const results = [];
  let browser = null;

  try {
    browser = await chromium.launch({ headless: true });

    const viewportsToRun = resolveViewportsForRun();
    if (shouldRunRetailFilter()) {
      console.log("Browser matrix: retail filter/reload (fresh dev server)…");
      await runRetailFilterChecks(browser, results, state);
    } else {
      console.log("Browser matrix: retail filter/reload skipped (chunk mode)");
    }
    console.log(
      `Browser matrix: viewport sweep (${viewportsToRun.map((v) => v.name).join(", ")})…`,
    );
    state.phase = "viewport-sweep";

    for (const vp of viewportsToRun) {
      matrixLog(vp.name, "-", "viewport-sweep=start");
      await assertGlobalDeadlineWithHealth(state);
      await assertViteResponsive(BASE, { ...state });

      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      try {
        await matrixLogin(page, state, {
          viewport: vp.name,
          role: "customer",
          email: groupBuy.email,
          password: groupBuy.password,
        });
        await acceptConsentIfNeeded(page);

        for (const route of CUSTOMER_ROUTES) {
          try {
            await matrixNavigate(page, state, { viewport: vp.name, route, role: "customer" });
          } catch (e) {
            if (e instanceof InfrastructureBlockedError) throw e;
          }
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
      } finally {
        await context.close();
      }

      const adminCtx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const adminPage = await adminCtx.newPage();
      try {
        await matrixLogin(adminPage, state, {
          viewport: vp.name,
          role: "admin",
          email: admin.email,
          password: admin.password,
        });
        await acceptConsentIfNeeded(adminPage);

        for (const route of ADMIN_ROUTES) {
          try {
            await matrixNavigate(adminPage, state, { viewport: vp.name, route, role: "admin" });
          } catch (e) {
            if (e instanceof InfrastructureBlockedError) throw e;
          }
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
      } finally {
        await adminCtx.close();
      }
      matrixLog(vp.name, "-", "viewport-sweep=done");
    }

    await browser.close();
    browser = null;

    const failed = results.filter((r) => !r.pass);
    writeMatrixResults({
      generatedAt: new Date().toISOString(),
      base: BASE,
      outcome: failed.length ? "TEST_FAILURE" : "PASS",
      results,
    });

    console.log(`Browser matrix: ${results.length} checks, ${failed.length} failed`);
    if (failed.length) {
      console.error(failed.slice(0, 15));
      process.exit(1);
    }
    console.log("BROWSER MATRIX PASS");
  } catch (err) {
    if (browser) {
      await browser.close().catch(() => {});
    }
    const viteHealth = await probeViteHttp(BASE, 8_000);
    writeMatrixResults({
      generatedAt: new Date().toISOString(),
      base: BASE,
      outcome: err instanceof InfrastructureBlockedError ? "INFRASTRUCTURE_BLOCKED" : "ERROR",
      error: err instanceof Error ? err.message : String(err),
      matrixState: state,
      viteHealth,
      results,
    });
    if (err instanceof InfrastructureBlockedError) {
      console.error(err.message);
      process.exit(2);
    }
    throw err;
  }
}

import { pathToFileURL } from "node:url";

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
