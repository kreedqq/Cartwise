/**
 * Copies the eight individual authoritative portal PNGs from Cursor assets
 * into public/shop/portals/portal_{color}.png (no sprite split).
 *
 * Usage: node scripts/import-authoritative-portal-assets.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.join(
  process.env.USERPROFILE ?? "",
  ".cursor/projects/c-Users-PolatMehmetErkan-Documents-Cartwise/assets",
);
const portalDir = path.join(root, "public/shop/portals");

/** Filename fragment → logical id */
const MAP = [
  ["portal_blue", "portal_blue"],
  ["portal_purple", "portal_purple"],
  ["portal_green", "portal_green"],
  ["portal_red", "portal_red"],
  ["portal_orange", "portal_orange"],
  ["portal_gold", "portal_gold"],
  ["portal_pink", "portal_pink"],
  ["portal_cyan", "portal_cyan"],
];

if (!fs.existsSync(assetsDir)) {
  console.error("Assets folder missing:", assetsDir);
  process.exit(1);
}

const names = fs.readdirSync(assetsDir);
fs.mkdirSync(portalDir, { recursive: true });

const copied = [];
for (const [fragment, id] of MAP) {
  const match = names.find((n) => n.includes(fragment));
  if (!match) {
    console.error(`Missing asset for ${id} (fragment ${fragment})`);
    process.exit(1);
  }
  const dest = path.join(portalDir, `${id}.png`);
  fs.copyFileSync(path.join(assetsDir, match), dest);
  copied.push(id);
  console.log(`${id} ← ${match}`);
}

const vialRef = names.find((n) => n.includes("Codex-Bild") || n.includes("peptix-vial"));
if (vialRef) {
  const vialOut = path.join(root, "docs/reference/peptix-vial-world-reference.jpg");
  fs.mkdirSync(path.dirname(vialOut), { recursive: true });
  fs.copyFileSync(path.join(assetsDir, vialRef), vialOut);
  console.log("Vial reference →", vialOut);
}

const manifest = {
  source: "authoritative-direct",
  importedAt: new Date().toISOString(),
  ids: copied,
  note: "Individual portal PNGs supplied directly (not split from sheet).",
};
fs.writeFileSync(path.join(portalDir, ".portal-asset-manifest.json"), JSON.stringify(manifest, null, 2));
console.log("Manifest updated.");
console.log("Run: npm run validate:portals");
