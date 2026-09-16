#!/usr/bin/env node
/** Admin global sync idempotency (UI click, localhost only). */
import {
  BASE,
  assertDevServer,
  failAndExit,
  login,
  loadAccount,
  requireQaAccounts,
  writeJson,
  GENERATED_DIR,
} from "./browser-helpers.mjs";

async function runGlobalSync(page) {
  await page.goto(`${BASE}/admin/orders`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape").catch(() => {});
  const syncBtn = page.getByRole("button", { name: "Bestellungen & Warenkörbe synchronisieren" });
  await syncBtn.scrollIntoViewIfNeeded();
  await syncBtn.click({ timeout: 60_000 });
  await page.getByRole("dialog").getByText("Synchronisierung abgeschlossen").waitFor({ timeout: 120_000 });
  const dialogText = await page.getByRole("dialog").textContent();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  return dialogText ?? "";
}

async function main() {
  await assertDevServer();
  requireQaAccounts();
  const admin = loadAccount("admin");
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  try {
    await login(page, admin.email, admin.password);
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await page.getByText("Systemstatus").waitFor({ timeout: 30_000 });

    const first = await runGlobalSync(page);
    const second = await runGlobalSync(page);
    if (!first.includes("Synchronisierung") || !second.includes("Synchronisierung")) {
      failAndExit("ADMIN SYNC", "Dialog missing expected content");
    }

    writeJson(`${GENERATED_DIR}/browser-admin-flow.json`, { pass: true, firstSnippet: first.slice(0, 200) });
    console.log("ADMIN BROWSER QA PASS");
  } catch (err) {
    failAndExit("ADMIN BROWSER QA", err);
  } finally {
    await browser.close();
  }
}

main();
