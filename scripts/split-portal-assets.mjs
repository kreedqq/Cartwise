/**
 * Splits the 2×4 portal reference sheet into eight transparent PNGs.
 * Usage: node scripts/split-portal-assets.mjs [path-to-sheet.jpg]
 *
 * Only the checkerboard/paper background is keyed to alpha. Portal pixels
 * keep original RGB. Cells follow detected gutters so portals are not cropped.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public/shop/portals");
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

const defaultSrc = path.join(outDir, "reference-sheet.jpg");
const src = process.argv[2] ? path.resolve(process.argv[2]) : defaultSrc;

if (!fs.existsSync(src)) {
  console.error("Sheet missing:", src);
  process.exit(1);
}

const sharp = (await import("sharp")).default;

function satLum(r, g, b) {
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  return { sat: maxC - minC, lum: (r + g + b) / 3 };
}

function isCheckerBackground(r, g, b) {
  const { sat, lum } = satLum(r, g, b);
  return sat < 28 && lum >= 148;
}

function floodKeyBackground(data, width, height) {
  const visited = new Uint8Array(width * height);
  const stack = [];
  const pushIfBg = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * 4;
    if (!isCheckerBackground(data[i], data[i + 1], data[i + 2])) return;
    visited[idx] = 1;
    stack.push(idx);
  };

  for (let x = 0; x < width; x += 1) {
    pushIfBg(x, 0);
    pushIfBg(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    pushIfBg(0, y);
    pushIfBg(width - 1, y);
  }

  while (stack.length) {
    const idx = stack.pop();
    const x = idx % width;
    const y = (idx - x) / width;
    data[idx * 4 + 3] = 0;
    pushIfBg(x - 1, y);
    pushIfBg(x + 1, y);
    pushIfBg(x, y - 1);
    pushIfBg(x, y + 1);
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      const { sat, lum } = satLum(data[i], data[i + 1], data[i + 2]);
      if (sat >= 40 || lum < 140) continue;
      let nextToClear = false;
      for (let dy = -1; dy <= 1 && !nextToClear; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (data[(ny * width + nx) * 4 + 3] === 0) {
            nextToClear = true;
            break;
          }
        }
      }
      if (!nextToClear) continue;
      data[i + 3] = Math.round(255 * Math.min(1, sat / 40));
    }
  }
}

function opaqueBounds(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

function foregroundBands(values, threshold) {
  const bands = [];
  let start = -1;
  for (let i = 0; i <= values.length; i += 1) {
    const on = i < values.length && values[i] > threshold;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      bands.push({ start, end: i });
      start = -1;
    }
  }
  return bands;
}

function deepestInteriorMinima(values, count, minSeparation) {
  const lo = Math.floor(values.length * 0.08);
  const hi = Math.ceil(values.length * 0.92);
  const minima = [];
  for (let i = lo; i < hi; i += 1) {
    if (values[i] <= values[i - 1] && values[i] <= values[i + 1]) {
      minima.push({ i, v: values[i] });
    }
  }
  minima.sort((a, b) => a.v - b.v || a.i - b.i);
  const picked = [];
  for (const m of minima) {
    if (picked.some((p) => Math.abs(p.i - m.i) < minSeparation)) continue;
    picked.push(m);
    if (picked.length === count) break;
  }
  if (picked.length !== count) return null;
  return picked.map((p) => p.i).sort((a, b) => a - b);
}

function detectCells(data, width, height) {
  const rowFg = new Array(height).fill(0);
  const colFg = new Array(width).fill(0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (isCheckerBackground(data[i], data[i + 1], data[i + 2])) continue;
      rowFg[y] += 1;
      colFg[x] += 1;
    }
  }
  const rowBands = foregroundBands(rowFg, 40).filter((b) => b.end - b.start > 80);
  const colSplits = deepestInteriorMinima(colFg, 3, 80);
  if (rowBands.length !== 2 || !colSplits) return null;
  const pad = 10;
  const y0 = Math.max(0, rowBands[0].start - pad);
  const yMid = Math.floor((rowBands[0].end + rowBands[1].start) / 2);
  const y1 = Math.min(height, rowBands[1].end + pad);
  const xs = [0, ...colSplits, width];
  const cells = [];
  for (let r = 0; r < 2; r += 1) {
    const top = r === 0 ? y0 : yMid;
    const bottom = r === 0 ? yMid : y1;
    for (let c = 0; c < 4; c += 1) {
      cells.push({
        left: xs[c],
        top,
        width: xs[c + 1] - xs[c],
        height: bottom - top,
      });
    }
  }
  return cells;
}

function fallbackCells(width, height) {
  const cols = 4;
  const rows = 2;
  const cellW = Math.floor(width / cols);
  const cellH = Math.floor(height / rows);
  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const left = c * cellW;
      const top = r * cellH;
      cells.push({
        left,
        top,
        width: c === cols - 1 ? width - left : cellW,
        height: r === rows - 1 ? height - top : cellH,
      });
    }
  }
  return cells;
}

function extractCell(srcData, srcW, srcH, cell) {
  const { left, top, width, height } = cell;
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = left + x;
      const sy = top + y;
      const di = (y * width + x) * 4;
      if (sx < 0 || sy < 0 || sx >= srcW || sy >= srcH) {
        out[di + 3] = 0;
        continue;
      }
      const si = (sy * srcW + sx) * 4;
      out[di] = srcData[si];
      out[di + 1] = srcData[si + 1];
      out[di + 2] = srcData[si + 2];
      out[di + 3] = 255;
    }
  }
  return { data: out, width, height };
}

function portalToSquarePng(cellData, width, height) {
  floodKeyBackground(cellData, width, height);
  const { minX, minY, maxX, maxY } = opaqueBounds(cellData, width, height);
  if (maxX < 0) throw new Error("No portal pixels found in cell");
  const pad = 8;
  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  const side = Math.max(boxW, boxH) + pad * 2;
  const cropped = Buffer.alloc(side * side * 4);
  const destX = Math.floor((side - boxW) / 2);
  const destY = Math.floor((side - boxH) / 2);
  for (let y = 0; y < boxH; y += 1) {
    for (let x = 0; x < boxW; x += 1) {
      const si = ((minY + y) * width + (minX + x)) * 4;
      const di = ((destY + y) * side + (destX + x)) * 4;
      cropped[di] = cellData[si];
      cropped[di + 1] = cellData[si + 1];
      cropped[di + 2] = cellData[si + 2];
      cropped[di + 3] = cellData[si + 3];
    }
  }
  return { buffer: cropped, side, boxW, boxH };
}

fs.mkdirSync(outDir, { recursive: true });
const { data: sheet, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const detected = detectCells(sheet, info.width, info.height);
const cells = detected ?? fallbackCells(info.width, info.height);
console.log(detected ? "Using detected gutters" : "Using equal 4×2 grid");

for (let i = 0; i < ids.length; i += 1) {
  const cell = cells[i];
  const extracted = extractCell(sheet, info.width, info.height, cell);
  const pngRaw = portalToSquarePng(extracted.data, extracted.width, extracted.height);
  const dest = path.join(outDir, `${ids[i]}.png`);
  const png = await sharp(pngRaw.buffer, {
    raw: { width: pngRaw.side, height: pngRaw.side, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await fs.promises.writeFile(dest, png);
  const outMeta = await sharp(png).metadata();
  console.log(
    "OK",
    dest,
    `${outMeta.width}x${outMeta.height}`,
    `portal=${pngRaw.boxW}x${pngRaw.boxH}`,
    `alpha=${outMeta.hasAlpha}`,
    `cell=${cell.left},${cell.top} ${cell.width}x${cell.height}`,
  );
}

fs.writeFileSync(
  path.join(outDir, ".portal-asset-manifest.json"),
  JSON.stringify(
    {
      source: "reference-sheet",
      splitAt: new Date().toISOString(),
      input: path.basename(src),
      ids,
      gutterDetection: Boolean(detected),
    },
    null,
    2,
  ),
);
console.log("Manifest written — run: node scripts/validate-portal-assets.mjs");
