#!/usr/bin/env node
/**
 * axe + keyboard smoke (critical/serious must be 0), localhost only.
 */
import { existsSync, readFileSync } from "node:fs";
import {
  BASE,
  FLOW_STATE_PATH,
  assertDevServer,
  failAndExit,
  login,
  loadAccount,
  pathFromFlowUrl,
  requireQaAccounts,
  writeJson,
  GENERATED_DIR,
} from "./browser-helpers.mjs";

function loadFlowState() {
  if (!existsSync(FLOW_STATE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(FLOW_STATE_PATH, "utf8"));
  } catch {
    return {};
  }
}

async function scanPage(page, axeBuilder, label) {
  const results = await axeBuilder.analyze();
  const violations = results.violations.filter((v) => ["critical", "serious"].includes(v.impact));
  const moderate = results.violations.filter((v) => v.impact === "moderate");
  return { label, url: page.url(), violations, moderateCount: moderate.length };
}

async function keyboardSmoke(page) {
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { tag: el.tagName, name: el.getAttribute("aria-label") || el.textContent?.slice(0, 40) };
  });
  return focused;
}

async function main() {
  await assertDevServer();
  requireQaAccounts();
  let AxeBuilder;
  try {
    ({ AxeBuilder } = await import("@axe-core/playwright"));
  } catch {
    failAndExit("ACCESSIBILITY", "Install @axe-core/playwright (devDependency)");
  }

  const state = loadFlowState();
  const groupBuy = loadAccount("groupBuy");
  const admin = loadAccount("admin");
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const routes = [
    { label: "login", path: "/login", auth: false },
    { label: "shop-hub", path: "/shop", auth: true, account: groupBuy },
    { label: "shop-retail", path: "/shop/retail?category=peptides", auth: true, account: groupBuy },
    { label: "group-buy", path: "/shop/group-buy-1?category=peptides", auth: true, account: groupBuy },
    { label: "kit-gesuche", path: "/shop/group-buy-1/kit-gesuche", auth: true, account: groupBuy },
    { label: "cart", path: state.retailOrderUrl ? null : "/shop/retail", auth: true, account: groupBuy, setup: "cart" },
    { label: "orders", path: "/orders", auth: true, account: groupBuy },
    {
      label: "order-detail",
      path: pathFromFlowUrl(state.retailOrderUrl),
      auth: true,
      account: groupBuy,
    },
    { label: "admin-dashboard", path: "/admin", auth: true, account: admin },
    { label: "admin-kits", path: "/admin/kit-requests", auth: true, account: admin },
    { label: "admin-carts", path: "/admin/carts", auth: true, account: admin },
    { label: "admin-orders", path: "/admin/orders", auth: true, account: admin },
  ];

  const scans = [];
  const keyboard = [];

  try {
    let signedInEmail = null;
    for (const route of routes) {
      if (!route.path) continue;
      if (route.auth) {
        if (signedInEmail !== route.account.email) {
          await login(page, route.account.email, route.account.password);
          signedInEmail = route.account.email;
        }
        await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle" });
      } else {
        signedInEmail = null;
        await page.context().clearCookies();
        await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" }).catch(() => {});
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
        await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle" });
      }
      if (route.setup === "cart") {
        await page.getByRole("button", { name: "Zum Warenkorb" }).first().click().catch(() => {});
        await page.waitForTimeout(1500);
        await page.getByRole("button", { name: /Aktiver Warenkorb/i }).click();
        await page.waitForURL(/\/carts\//, { timeout: 20_000 }).catch(() => {});
      }
      await page.waitForTimeout(800);

      if (route.label === "kit-gesuche") {
        await page.getByRole("button", { name: "Gesuch erstellen" }).first().click().catch(() => {});
        await page.waitForTimeout(600);
        await new AxeBuilder({ page }).include('[role="dialog"]').analyze().then((r) => {
          scans.push({
            label: "kit-create-dialog",
            url: page.url(),
            violations: r.violations.filter((v) => ["critical", "serious"].includes(v.impact)),
            moderateCount: r.violations.filter((v) => v.impact === "moderate").length,
          });
        });
        await page.keyboard.press("Escape");
      }

      const axeBuilder = new AxeBuilder({ page });
      scans.push(await scanPage(page, axeBuilder, route.label));
      if (["login", "shop-retail", "kit-gesuche", "admin-dashboard"].includes(route.label)) {
        keyboard.push({ route: route.label, focus: await keyboardSmoke(page) });
      }
    }

    const failed = scans.filter((s) => s.violations.length > 0);
    writeJson(`${GENERATED_DIR}/browser-accessibility.json`, { scans, keyboard, failedCount: failed.length });

    if (failed.length) {
      console.error(JSON.stringify(failed, null, 2));
      failAndExit("ACCESSIBILITY", `${failed.length} route(s) with critical/serious axe violations`);
    }
    console.log("ACCESSIBILITY PASS (critical/serious = 0)");
  } catch (err) {
    failAndExit("ACCESSIBILITY", err);
  } finally {
    await browser.close();
  }
}

main();
