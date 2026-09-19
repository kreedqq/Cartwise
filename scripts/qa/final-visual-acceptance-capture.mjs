/**
 * Mandatory 12 screenshots for final visual acceptance (localhost only).
 * Requires: npm run qa:seed, local Supabase, dev server at PEPTIX_DEV_URL.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

import {
  ACCOUNTS_PATH,
  GENERATED_DIR,
  getQaBase,
  loadAccount,
  login,
  requireQaAccounts,
} from "./browser-helpers.mjs";
import { startQaDevServer, waitForHttpOk } from "./qa-dev-server.mjs";

requireQaAccounts();

let viteChild = null;
const baseFromEnv = process.env.PEPTIX_DEV_URL?.replace(/\/$/, "");
let base = baseFromEnv ?? "";
if (process.env.PEPTIX_MANAGE_QA_VITE !== "0") {
  let needsStart = !base;
  if (base) {
    try {
      await waitForHttpOk(base, 5_000);
    } catch {
      needsStart = true;
    }
  }
  if (needsStart) {
    const started = await startQaDevServer(ACCOUNTS_PATH, Number(process.env.PEPTIX_BROWSER_DEV_PORT ?? 5190));
    process.env.PEPTIX_DEV_URL = started.base;
    viteChild = started.child;
    base = started.base;
  }
}
if (!base) base = getQaBase();
await waitForHttpOk(`${base}/login`, 120_000);
await new Promise((r) => setTimeout(r, 2000));

const OUT = resolve(GENERATED_DIR, "screenshots/final-visual-acceptance");
mkdirSync(OUT, { recursive: true });

const admin = loadAccount("admin");
const groupBuy = loadAccount("groupBuy");

async function capture(page, file, path, account, vp) {
  await page.setViewportSize(vp);
  await login(page, account.email, account.password);
  await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(OUT, file), fullPage: vp.width >= 768 });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const shots = [
  ["01-shop-hub-1440.png", "/shop", admin, { width: 1440, height: 900 }],
  ["02-shop-hub-390.png", "/shop", admin, { width: 390, height: 844 }],
  ["03-group-buy-1-1440.png", "/shop/group-buy-1", groupBuy, { width: 1440, height: 900 }],
  ["04-group-buy-1-390.png", "/shop/group-buy-1", groupBuy, { width: 390, height: 844 }],
  ["05-category-hub-1440.png", "/shop/group-buy-1", groupBuy, { width: 1440, height: 900 }],
  ["06-category-hub-390.png", "/shop/group-buy-1", groupBuy, { width: 390, height: 844 }],
  ["07-product-grid-1440.png", "/shop/group-buy-1?category=peptides", groupBuy, { width: 1440, height: 900 }],
  ["08-product-grid-390.png", "/shop/group-buy-1?category=peptides", groupBuy, { width: 390, height: 844 }],
  ["09-design-studio-1440.png", "/admin/design-studio", admin, { width: 1440, height: 900 }],
  ["10-portal-library-1440.png", "/admin/design-studio/portals", admin, { width: 1440, height: 900 }],
  ["11-vial-library-1440.png", "/admin/design-studio/vials", admin, { width: 1440, height: 900 }],
  ["12-portal-preview-1440.png", "/admin/design-studio/portals", admin, { width: 1440, height: 900 }],
];

for (const [file, path, account, vp] of shots) {
  await capture(page, file, path, account, vp);
  if (file === "05-category-hub-1440.png" || file === "07-product-grid-1440.png") {
    await page.waitForSelector('[data-testid="shop-product-card"], [data-testid="shop-category-portal"]', {
      timeout: 60_000,
    }).catch(() => {});
    await page.screenshot({ path: join(OUT, file), fullPage: false });
  }
}

const metrics = await page.evaluate(() => {
  const portals = document.querySelectorAll(".peptix-portal-asset");
  const imgs = [...portals].map((img) => ({
    src: img.getAttribute("src") ?? "",
    w: img.getBoundingClientRect().width,
    h: img.getBoundingClientRect().height,
  }));
  return { portalImages: imgs, consoleErrors: window.__peptixQaErrors ?? [] };
});

writeFileSync(
  join(OUT, "capture-meta.json"),
  JSON.stringify({ base, capturedAt: new Date().toISOString(), metrics, files: shots.map((s) => s[0]) }, null, 2),
);

await browser.close();
if (viteChild && !viteChild.killed) viteChild.kill("SIGTERM");
console.log(`Final visual acceptance screenshots → ${OUT}`);
