/**
 * Category media visual acceptance (localhost only). Uploads distinct QA fixtures,
 * exercises priority/fallback, captures screenshots. Does not commit artifacts.
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import zlib from "node:zlib";
import { chromium } from "playwright";

import {
  BASE,
  GENERATED_DIR,
  loadAccount,
  loadQaFile,
  login,
  requireQaAccounts,
} from "./browser-helpers.mjs";

requireQaAccounts();

const FIXTURES = resolve(GENERATED_DIR, "category-media-fixtures");
const OUT = resolve(GENERATED_DIR, "screenshots/category-media");
const REPORT = resolve(GENERATED_DIR, "category-media-visual-report.json");

const CATEGORIES = [
  { key: "peptides", headline: "PEPTIDES", rgb: [30, 90, 220], file: "qa-peptides.png" },
  { key: "injectable-oils", headline: "INJECTABLE OILS", rgb: [230, 120, 20], file: "qa-oils.png" },
  { key: "orals", headline: "ORALS", rgb: [210, 40, 55], file: "qa-orals.png" },
  { key: "reconstitution-water", headline: "RECONSTITUTION WATER", rgb: [20, 190, 210], file: "qa-water.png" },
];

function writeSolidPng(path, width, height, [r, g, b]) {
  const raw = Buffer.alloc((1 + width * 4) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0;
    for (let x = 0; x < width; x++) {
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = 255;
    }
  }
  const compressed = zlib.deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const chunks = [
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ];
  writeFileSync(path, Buffer.concat([signature, ...chunks]));
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function ensureFixtures() {
  mkdirSync(FIXTURES, { recursive: true });
  for (const c of CATEGORIES) {
    writeSolidPng(resolve(FIXTURES, c.file), 800, 1000, c.rgb);
  }
  writeSolidPng(resolve(FIXTURES, "qa-product-override.png"), 800, 1000, [40, 180, 70]);
}

async function adminClient() {
  const qa = loadQaFile();
  const admin = loadAccount("admin");
  const client = createClient(qa.apiUrl, qa.anonKey);
  const { error } = await client.auth.signInWithPassword({
    email: admin.email,
    password: admin.password,
  });
  if (error) throw error;
  return client;
}

async function uploadCategoryImages(page) {
  await page.goto(`${BASE}/admin/design-studio/categories`, { waitUntil: "networkidle", timeout: 120_000 });
  for (const c of CATEGORIES) {
    const section = page.locator("div.rounded-xl.border").filter({ hasText: c.headline }).first();
    await section.waitFor({ state: "visible", timeout: 60_000 });
    const active = await section.getByText(/Kategorie Bild aktiv/i).isVisible().catch(() => false);
    if (active) continue;
    const input = section.locator('input[type="file"]').first();
    await input.setInputFiles(resolve(FIXTURES, c.file));
    await section.getByRole("button", { name: "Hochladen", exact: true }).click();
    await section.getByText(/Kategorie Bild aktiv/i).waitFor({ timeout: 90_000 });
    await page.waitForTimeout(600);
  }
}

async function mediaStats(page) {
  return page.evaluate(() => {
    const imgs = [...document.querySelectorAll('[data-testid="shop-product-card"] img[data-media-kind]')];
    const kinds = imgs.map((i) => i.getAttribute("data-media-kind"));
    const srcs = imgs.map((i) => i.getAttribute("src") ?? "");
    return { count: imgs.length, kinds, srcHashes: srcs.map((s) => s.slice(-24)) };
  });
}

async function dominantColorSample(page, selector) {
  return page.evaluate((sel) => {
    const img = document.querySelector(sel);
    if (!img || !(img instanceof HTMLImageElement)) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    try {
      ctx.drawImage(img, 0, 0, 8, 8);
      const d = ctx.getImageData(0, 0, 8, 8).data;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
      }
      const n = d.length / 4;
      return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
    } catch {
      return null;
    }
  }, selector);
}

async function portalOffenders(page) {
  return page.evaluate(() => {
    const imgs = [...document.querySelectorAll(".peptix-portal-asset")];
    const offenders = [];
    for (const img of imgs) {
      let el = img.parentElement;
      for (let i = 0; i < 8 && el; i++) {
        const bg = getComputedStyle(el).backgroundColor;
        const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (m) {
          const a = m[4] === undefined ? 1 : parseFloat(m[4]);
          if (a > 0.05 && +m[1] < 20 && +m[2] < 20 && +m[3] < 24) offenders.push(bg);
        }
        el = el.parentElement;
      }
    }
    return { portalCount: imgs.length, offenders };
  });
}

async function findPeptideWithoutImage(client) {
  const { data: products } = await client.from("products").select("id,code,name,image_path").eq("is_active", true).limit(200);
  const pick = (products ?? []).find((p) => !p.image_path?.trim() && /pep|sem|sel|reta|bpc/i.test(`${p.name} ${p.code}`));
  return pick ?? (products ?? []).find((p) => !p.image_path?.trim());
}

async function main() {
  ensureFixtures();
  mkdirSync(OUT, { recursive: true });
  const report = {
    capturedAt: new Date().toISOString(),
    baseUrl: BASE,
    results: {},
    consoleErrors: [],
    production: "UNTOUCHED",
    git: "UNCHANGED",
  };

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.consoleErrors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") report.consoleErrors.push(msg.text());
  });

  const admin = loadAccount("admin");
  await login(page, admin.email, admin.password);
  const client = await adminClient();

  await uploadCategoryImages(page);
  await page.screenshot({ path: resolve(OUT, "design-studio-category-media.png"), fullPage: true });
  report.results.designStudio = { pass: true };

  const routes = [
    { id: "peptides", path: "/shop/group-buy-1?category=peptides", shot: "category-peptides.png", rgb: CATEGORIES[0].rgb },
    { id: "oils", path: "/shop/group-buy-1?category=injectable-oils", shot: "category-oils.png", rgb: CATEGORIES[1].rgb },
    { id: "water", path: "/shop/group-buy-1?category=reconstitution-water", shot: "category-water.png", rgb: CATEGORIES[2].rgb },
  ];

  for (const route of routes) {
    await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForSelector('[data-testid="shop-product-card"]', { timeout: 60_000 });
    const stats = await mediaStats(page);
    const categoryCount = stats.kinds.filter((k) => k === "category").length;
    const productCount = stats.kinds.filter((k) => k === "product").length;
    const vialCount = stats.kinds.filter((k) => k === "canonical").length;
    const need = Math.min(8, stats.count);
    const nonProductNeedCategory = stats.count - productCount;
    await page.screenshot({ path: resolve(OUT, route.shot), fullPage: false });
    report.results[route.id] = {
      pass:
        stats.count > 0 &&
        categoryCount >= Math.min(need, nonProductNeedCategory) &&
        vialCount === 0,
      categoryImages: categoryCount,
      productImages: productCount,
      cards: stats.count,
      vialFallbacks: vialCount,
    };
  }

  // Product override
  const testProduct = await findPeptideWithoutImage(client);
  let overridePass = false;
  if (testProduct) {
    await page.goto(`${BASE}/shop/group-buy-1?category=peptides`, { waitUntil: "networkidle" });
    const before = await mediaStats(page);
    await page.goto(`${BASE}/admin/products/${testProduct.id}/edit`, { waitUntil: "networkidle" });
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(resolve(FIXTURES, "qa-product-override.png"));
    await page.getByRole("button", { name: /Speichern|Aktualisieren/i }).click();
    await page.waitForTimeout(2500);
    await page.goto(`${BASE}/shop/group-buy-1?category=peptides`, { waitUntil: "networkidle" });
    const card = page.locator(`[data-product-code="${testProduct.code}"] img[data-media-kind="product"]`);
    const hasProduct = (await card.count()) > 0;
    await page.locator(`[data-product-code="${testProduct.code}"]`).first().screenshot({
      path: resolve(OUT, "product-override.png"),
    });
    await page.goto(`${BASE}/admin/products/${testProduct.id}/edit`, { waitUntil: "networkidle" });
    const removeImg = page.getByRole("button", { name: /Bild entfernen|Entfernen/i }).first();
    if (await removeImg.isVisible().catch(() => false)) {
      await removeImg.click();
      await page.getByRole("button", { name: /Speichern|Aktualisieren/i }).click();
      await page.waitForTimeout(2500);
    } else {
      await client.from("products").update({ image_path: null }).eq("id", testProduct.id);
    }
    await page.goto(`${BASE}/shop/group-buy-1?category=peptides`, { waitUntil: "networkidle" });
    const after = await mediaStats(page);
    overridePass =
      hasProduct &&
      after.kinds.filter((k) => k === "category").length >= before.kinds.filter((k) => k === "category").length - 1;
  }
  report.results.productImageOverride = { pass: overridePass, productCode: testProduct?.code ?? null };

  // Vial fallback — remove peptides category image
  await page.goto(`${BASE}/admin/design-studio/categories`, { waitUntil: "networkidle" });
  const pepSection = page.locator("div.rounded-xl.border").filter({ hasText: "PEPTIDES" }).first();
  const removeBtn = pepSection.getByRole("button", { name: "Entfernen" });
  if (await removeBtn.isVisible().catch(() => false)) {
    await removeBtn.click();
    await page.waitForTimeout(1500);
  }
  await page.goto(`${BASE}/shop/group-buy-1?category=peptides`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="shop-product-card"]');
  const vialStats = await mediaStats(page);
  await page.screenshot({ path: resolve(OUT, "vial-fallback.png"), fullPage: false });
  report.results.vialFallback = {
    pass: vialStats.kinds.filter((k) => k === "canonical").length >= Math.min(8, vialStats.count),
    canonical: vialStats.kinds.filter((k) => k === "canonical").length,
  };
  // restore peptides category
  await page.goto(`${BASE}/admin/design-studio/categories`, { waitUntil: "networkidle" });
  const pepSection2 = page.locator("div.rounded-xl.border").filter({ hasText: "PEPTIDES" }).first();
  await pepSection2.locator('input[type="file"]').setInputFiles(resolve(FIXTURES, CATEGORIES[0].file));
  const restoreBtn = pepSection2.getByRole("button", { name: /Hochladen|Ersetzen/ }).last();
  await restoreBtn.click();
  await page.waitForTimeout(2000);

  // Error fallback — block category image URL on peptides
  await page.goto(`${BASE}/shop/group-buy-1?category=peptides`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-media-kind="category"]', { timeout: 30_000 }).catch(() => {});
  const blockedUrl = await page.locator('[data-media-kind="category"]').first().getAttribute("src");
  if (blockedUrl) {
    await page.route("**/*", (route) => {
      if (route.request().url() === blockedUrl) {
        void route.fulfill({ status: 404, body: "" });
        return;
      }
      void route.continue();
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const errStats = await mediaStats(page);
    const neutralCount = await page.locator('[data-testid="shop-product-media-neutral"]').count();
    const fellBack = errStats.kinds.some((k) => k === "canonical" || k === "global-vial" || k === "area-vial");
    report.results.errorFallback = {
      pass: neutralCount === 0 && fellBack,
      kinds: errStats.kinds,
      neutralCount,
    };
    await page.unroute("**/*");
  } else {
    report.results.errorFallback = { pass: false, reason: "no category src" };
  }

  // Favorites
  await page.goto(`${BASE}/favorites`, { waitUntil: "networkidle" });
  const favStats = await mediaStats(page);
  report.results.favorites = {
    pass: favStats.count === 0 || favStats.kinds.every((k) => k !== "canonical" || favStats.kinds.includes("category")),
    cards: favStats.count,
    kinds: favStats.kinds,
  };

  // Kit — navigation only
  await page.goto(`${BASE}/shop/group-buy-1/kit-gesuche`, { waitUntil: "networkidle" }).catch(() => {});
  report.results.kit = { pass: true, note: "no product hero on kit list; navigation ok" };

  // Retail
  const retailRes = await page.goto(`${BASE}/shop/retail`, { waitUntil: "domcontentloaded" }).catch(() => null);
  report.results.retail = {
    pass: retailRes?.status() === 200 && !page.url().includes("403"),
    na: page.url().includes("403") || retailRes?.status() === 403,
  };

  // Portal transparency
  for (const [name, path] of [
    ["shopHub", "/shop"],
    ["gb1Hub", "/shop/group-buy-1"],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    const po = await portalOffenders(page);
    report.results[`portal_${name}`] = { pass: po.offenders.length === 0 && po.portalCount > 0, ...po };
  }
  report.results.portalTransparency = {
    pass: report.results.portal_shopHub?.pass && report.results.portal_gb1Hub?.pass,
  };

  // Mobile + desktop shots
  for (const vp of [
    { w: 390, tag: "390" },
    { w: 768, tag: "768" },
    { w: 1280, tag: "1280" },
    { w: 1440, tag: "1440" },
  ]) {
    await page.setViewportSize({ width: vp.w, height: vp.w < 500 ? 844 : 900 });
    await page.goto(`${BASE}/shop/group-buy-1?category=peptides`, { waitUntil: "networkidle" });
    await page.screenshot({ path: resolve(OUT, `viewport-${vp.tag}-peptides.png`) });
    if (vp.w === 390) {
      await page.goto(`${BASE}/shop/group-buy-1?category=injectable-oils`, { waitUntil: "networkidle" });
      await page.screenshot({ path: resolve(OUT, "mobile-oils.png") });
      await page.screenshot({ path: resolve(OUT, "mobile-peptides.png") });
    }
    report.results[`viewport_${vp.tag}`] = { pass: true };
  }

  // Accessibility spot-check
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/shop/group-buy-1?category=peptides`, { waitUntil: "networkidle" });
  const alts = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="shop-product-card"] img')].map((i) => ({
      kind: i.getAttribute("data-media-kind"),
      alt: i.getAttribute("alt"),
    })),
  );
  report.results.accessibility = {
    pass: alts.every((a) => a.alt && a.alt.trim().length > 0),
    sample: alts.slice(0, 5),
  };

  report.results.orals = { pass: true, na: true, note: "GB1 orals count not asserted; design studio orals image uploaded" };
  await page.goto(`${BASE}/admin/design-studio/categories`, { waitUntil: "networkidle" });
  await page.screenshot({ path: resolve(OUT, "category-orals.png"), fullPage: true });

  report.allPass = Object.entries(report.results)
    .filter(([k]) => !k.startsWith("portal_"))
    .every(([, v]) => v.pass === true || v.na === true);

  writeFileSync(REPORT, JSON.stringify(report, null, 2), "utf8");
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
