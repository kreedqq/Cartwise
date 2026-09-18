/**
 * Validates eight built-in portal PNGs under public/shop/portals/.
 * Fails if assets are missing, lack alpha, or are known SVG placeholders (512×512 + no manifest).
 *
 * Usage: node scripts/validate-portal-assets.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const portalDir = path.join(root, "public/shop/portals");
const manifestPath = path.join(portalDir, ".portal-asset-manifest.json");

const ids = [
  "portal_blue",
  "portal_purple",
  "portal_green",
  "portal_red",
  "portal_orange",
  "portal_gold",
  "portal_pink",
  "portal_cyan",
];

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("Install sharp: npm install sharp --no-save");
  process.exit(1);
}

const errors = [];
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : null;

for (const id of ids) {
  const filePath = path.join(portalDir, `${id}.png`);
  if (!fs.existsSync(filePath)) {
    errors.push(`${id}: missing file`);
    continue;
  }
  const stats = fs.statSync(filePath);
  const meta = await sharp(filePath).metadata();
  if (meta.format !== "png") errors.push(`${id}: not PNG (${meta.format})`);
  if (!meta.hasAlpha) errors.push(`${id}: missing alpha channel`);
  if (!meta.width || !meta.height) errors.push(`${id}: invalid dimensions`);
  if (meta.width !== meta.height) {
    errors.push(`${id}: expected square crop, got ${meta.width}x${meta.height}`);
  }
  if ((meta.width ?? 0) < 200) errors.push(`${id}: dimensions too small (${meta.width}x${meta.height})`);

  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparentEdge = 0;
  const w = info.width;
  const h = info.height;
  const channels = info.channels;
  const sample = (x, y) => data[(y * w + x) * channels + (channels - 1)];
  for (let x = 0; x < w; x += 1) {
    if (sample(x, 0) < 16 || sample(x, h - 1) < 16) transparentEdge += 1;
  }
  for (let y = 0; y < h; y += 1) {
    if (sample(0, y) < 16 || sample(w - 1, y) < 16) transparentEdge += 1;
  }
  if (transparentEdge < 8) {
    errors.push(`${id}: outer edge may be opaque (expected transparent halo)`);
  }

  if (meta.width === 512 && meta.height === 512 && stats.size < 80000 && manifest?.source !== "reference-sheet") {
    errors.push(
      `${id}: 512×512 placeholder detected — run split-portal-assets.mjs on the reference sheet and commit manifest`,
    );
  }
}

const validSource =
  manifest &&
  (manifest.source === "reference-sheet" || manifest.source === "authoritative-direct");
if (!validSource) {
  errors.push(
    "Missing or invalid .portal-asset-manifest.json (source must be reference-sheet or authoritative-direct).",
  );
}

if (errors.length) {
  console.error("Portal asset validation FAILED:\n");
  for (const e of errors) console.error(" -", e);
  console.error("\nPlace reference sheet at public/shop/portals/reference-sheet.jpg then:");
  console.error("  node scripts/split-portal-assets.mjs public/shop/portals/reference-sheet.jpg");
  process.exit(1);
}

console.log("Portal asset validation OK (8 reference PNGs).");
