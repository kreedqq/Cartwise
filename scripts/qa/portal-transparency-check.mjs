/**
 * Portal transparency acceptance: corners inside portal img bbox must not match
 * uniform near-black (container fill). Compares to a site-background sample away from portals.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import zlib from "node:zlib";
import { chromium } from "playwright";

import { BASE, GENERATED_DIR, loadAccount, login, requireQaAccounts } from "./browser-helpers.mjs";

requireQaAccounts();

const OUT = resolve(GENERATED_DIR, "portal-transparency-check.json");
const ROUTES = [
  { id: "shop-hub", path: "/shop", portalTestId: "shop-area-portal" },
  { id: "dashboard-portals", path: "/dashboard", portalTestId: "shop-area-portal" },
  { id: "gb1-hub", path: "/shop/group-buy-1", portalTestId: "shop-category-portal" },
];

function isNearBlack([r, g, b]) {
  return r < 12 && g < 12 && b < 14;
}

/** First pixel RGB from a Playwright PNG screenshot (RGBA, 8-bit). */
function pngFirstPixelRgb(buf) {
  let pos = 8;
  let width = 0;
  let colorType = 0;
  const idatChunks = [];
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = 1 + width * bytesPerPixel;
  const px = 1;
  return [raw[px], raw[px + 1], raw[px + 2]];
}

async function pixelRgb(page, x, y) {
  const vp = page.viewportSize();
  if (!vp || vp.width < 2 || vp.height < 2) {
    throw new Error("invalid viewport");
  }
  const px = Math.min(vp.width - 1, Math.max(0, Math.floor(x)));
  const py = Math.min(vp.height - 1, Math.max(0, Math.floor(y)));
  const buf = await page.screenshot({ type: "png" });
  let pos = 8;
  let width = 0;
  let colorType = 0;
  const idatChunks = [];
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const scale = width / vp.width;
  const sx = Math.min(width - 1, Math.floor(px * scale));
  const sy = Math.min(Math.floor(raw.length / (1 + width * bytesPerPixel)) - 1, Math.floor(py * scale));
  const stride = 1 + width * bytesPerPixel;
  const i = sy * stride + 1 + sx * bytesPerPixel;
  return [raw[i], raw[i + 1], raw[i + 2]];
}

async function checkRoute(page, route) {
  await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page
    .waitForSelector(`[data-testid="${route.portalTestId}"]`, { timeout: 60_000 })
    .catch(() => {});

  const portals = page.locator(".peptix-portal-asset");
  const count = await portals.count();
  if (count === 0) {
    return { route: route.id, pass: false, reason: "no portal images" };
  }

  const refY = 40;
  const refX = 24;
  const refRgb = await pixelRgb(page, refX, refY);

  const failures = [];
  for (let i = 0; i < Math.min(count, 4); i++) {
    const img = portals.nth(i);
    const box = await img.boundingBox();
    if (!box) continue;
    const corners = [
      { name: "tl", x: box.x + 2, y: box.y + 2 },
      { name: "tr", x: box.x + box.width - 3, y: box.y + 2 },
      { name: "bl", x: box.x + 2, y: box.y + box.height - 3 },
      { name: "br", x: box.x + box.width - 3, y: box.y + box.height - 3 },
    ];
    for (const c of corners) {
      const rgb = await pixelRgb(page, c.x, c.y);
      if (isNearBlack(rgb) && !isNearBlack(refRgb)) {
        failures.push({ portalIndex: i, corner: c.name, rgb, refRgb });
      }
    }
  }

  return {
    route: route.id,
    pass: failures.length === 0,
    portalCount: count,
    refRgb,
    failures,
  };
}

async function main() {
  mkdirSync(GENERATED_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const admin = loadAccount("admin");
  await login(page, admin.email, admin.password);

  const results = [];
  for (const route of ROUTES) {
    try {
      results.push(await checkRoute(page, route));
    } catch (e) {
      results.push({ route: route.id, pass: false, error: String(e) });
    }
  }

  await browser.close();
  const allPass = results.every((r) => r.pass);
  const payload = { capturedAt: new Date().toISOString(), baseUrl: BASE, allPass, results };
  writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.log(JSON.stringify(payload, null, 2));
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
