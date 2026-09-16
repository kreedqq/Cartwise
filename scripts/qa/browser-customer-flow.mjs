#!/usr/bin/env node
/**
 * Retail shop → cart → checkout → order (full UI, localhost only).
 */
import {
  BASE,
  assertDevServer,
  acceptConsentIfNeeded,
  auditPrimaryTouchTargets,
  failAndExit,
  fillCheckoutAndSubmit,
  login,
  loadAccount,
  mergeFlowState,
  openCartFromTopbar,
  requireQaAccounts,
  waitForEurSample,
  writeJson,
  GENERATED_DIR,
} from "./browser-helpers.mjs";

async function main() {
  await assertDevServer();
  requireQaAccounts();
  const kunde = loadAccount("kunde");
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const log = [];
  try {
    await login(page, kunde.email, kunde.password);
    await acceptConsentIfNeeded(page);
    log.push("login:ok");

    await page.goto(`${BASE}/shop/retail?category=peptides&search=QA`, { waitUntil: "networkidle" });
    await acceptConsentIfNeeded(page);
    if (!page.url().includes("/shop/")) {
      failAndExit("CUSTOMER E2E", `Expected shop URL, got ${page.url()}`);
    }
    log.push(`shop:${page.url()}`);
    await page.waitForTimeout(2800);
    await page.locator("table tbody tr, [class*='ShopProductsMobile']").first().waitFor({ timeout: 60_000 }).catch(async () => {
      const snippet = (await page.locator("body").innerText()).slice(0, 500);
      failAndExit("CUSTOMER E2E", `No product rows. Page: ${snippet}`);
    });
    const addBtn = page.getByRole("button", { name: /Zum Warenkorb|In den Warenkorb/ }).first();
    await addBtn.waitFor({ state: "visible", timeout: 60_000 });
    const eurBefore = await waitForEurSample(page);
    if (!eurBefore) failAndExit("CUSTOMER E2E", "EUR not visible on shop row");
    await addBtn.click();
    await page.waitForTimeout(2000);
    log.push("add-to-cart:ok");

    await openCartFromTopbar(page);
    log.push(`cart:${page.url()}`);

    const cartEur = page.locator('[data-currency="eur"]').first();
    const cartUsd = page.locator('[data-currency="usd"]').first();
    let eurText = "";
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await waitForEurSample(page).catch(() => false);
      eurText = (await cartEur.textContent())?.trim() ?? "";
      if (eurText.includes("€") && !eurText.startsWith("—") && eurText !== "…") break;
      await page.waitForTimeout(1000);
    }
    const usdText = (await cartUsd.textContent())?.trim() ?? "";
    if (!eurText.includes("€") || eurText.startsWith("—") || eurText === "…") {
      failAndExit("CUSTOMER E2E", `Cart EUR missing: ${eurText}`);
    }
    if (!usdText.includes("$") && !usdText.includes("USD")) {
      failAndExit("CUSTOMER E2E", `Cart USD missing: ${usdText}`);
    }
    log.push("cart-prices:ok");

    await page.getByRole("button", { name: "Bestellung prüfen" }).click();
    await page.waitForURL(/\/checkout/, { timeout: 30_000 });
    log.push("checkout-open:ok");

    await fillCheckoutAndSubmit(page);
    const orderUrl = page.url();
    log.push(`order-submitted:${orderUrl}`);

    if (!orderUrl.includes("/orders/")) {
      await page.goto(`${BASE}/orders`, { waitUntil: "networkidle" });
      await page.locator("button, a").filter({ hasText: /^[A-Z0-9-]+$/ }).first().click().catch(() => {});
    }
    await page.waitForURL(/\/orders\//, { timeout: 30_000 }).catch(() => {});
    const orderDetailUrl = page.url();
    const orderNumber = await page.locator("h1").first().textContent();
    log.push(`order-detail:${orderNumber?.trim()}`);

    await page.reload({ waitUntil: "networkidle" });
    const afterReload = await page.locator("h1").first().textContent();
    if (afterReload?.trim() !== orderNumber?.trim()) {
      failAndExit("CUSTOMER E2E", "Order detail changed after reload");
    }
    log.push("order-reload:ok");

    const touchFailures = await auditPrimaryTouchTargets(page);
    const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mobilePage = await mobileCtx.newPage();
    await login(mobilePage, kunde.email, kunde.password);
    await mobilePage.goto(`${BASE}/shop/retail?category=peptides&search=QA`, { waitUntil: "networkidle" });
    await mobilePage.waitForTimeout(1000);
    const mobileTouch = await auditPrimaryTouchTargets(mobilePage);
    await mobileCtx.close();

    const result = {
      pass: true,
      log,
      orderDetailUrl,
      orderNumber: orderNumber?.trim(),
      touchFailures: [...touchFailures, ...mobileTouch],
    };
    writeJson(`${GENERATED_DIR}/browser-customer-flow.json`, result);
    mergeFlowState({
      retailOrderId: orderDetailUrl.split("/orders/")[1]?.split("?")[0],
      retailOrderUrl: orderDetailUrl,
    });

    if (result.touchFailures.length) {
      failAndExit("CUSTOMER E2E TOUCH", result.touchFailures);
    }
    console.log("CUSTOMER BROWSER E2E PASS");
    console.log(result.log.join("\n"));
  } catch (err) {
    failAndExit("CUSTOMER E2E", err);
  } finally {
    await browser.close();
  }
}

main();
