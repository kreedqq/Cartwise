# Portal assets (reference sheet required)

Built-in portals are **eight separate PNGs** split from the official 2×4 reference sheet.

## Install real artwork

1. Save the reference image as `reference-sheet.jpg` in this folder.
2. Run from repo root:

   ```bash
   node scripts/split-portal-assets.mjs public/shop/portals/reference-sheet.jpg
   node scripts/validate-portal-assets.mjs
   ```

Do **not** use `scripts/generate-portal-placeholders.mjs` for production or visual acceptance — it creates SVG placeholders only.
