import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "src/research/cache/fetched");
const UA = "PeptixResearch/1.0 (scientific catalog; official APIs only)";

const NAMES = ["semaglutide", "tirzepatide", "liraglutide", "tesamorelin", "orforglipron"];

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

function clip(value, max = 500) {
  if (typeof value !== "string") return Array.isArray(value) ? value[0]?.slice?.(0, max) ?? null : null;
  return value.slice(0, max);
}

for (const name of NAMES) {
  const url = `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(`openfda.generic_name:"${name}"`)}&limit=3`;
  const res = await getJson(url);
  const results = Array.isArray(res.body?.results) ? res.body.results : [];
  const labels = results.map((row) => ({
    id: row.id ?? null,
    setId: row.set_id ?? null,
    effectiveTime: row.effective_time ?? null,
    brand: row.openfda?.brand_name ?? [],
    generic: row.openfda?.generic_name ?? [],
    manufacturer: row.openfda?.manufacturer_name ?? [],
    application: row.openfda?.application_number ?? [],
    route: row.openfda?.route ?? [],
    indications: clip(row.indications_and_usage?.[0]),
    boxedWarning: clip(row.boxed_warning?.[0], 400),
    contraindications: clip(row.contraindications?.[0], 400),
    warnings: clip(row.warnings_and_cautions?.[0] ?? row.warnings?.[0], 400),
    adverse: clip(row.adverse_reactions?.[0], 400),
    clinicalPharm: clip(row.clinical_pharmacology?.[0], 400),
    dosageAdmin: clip(row.dosage_and_administration?.[0], 300),
  }));
  await writeFile(resolve(OUT, `${name}.fda-label.json`), JSON.stringify({ name, status: res.status, labels }, null, 2));
  console.log(name, res.status, labels.map((l) => (l.brand || []).join("/")).join(" | "));
}

const ema = [
  ["semaglutide", "https://www.ema.europa.eu/en/medicines/human/EPAR/ozempic"],
  ["semaglutide-wegovy", "https://www.ema.europa.eu/en/medicines/human/EPAR/wegovy"],
  ["tirzepatide", "https://www.ema.europa.eu/en/medicines/human/EPAR/mounjaro"],
  ["liraglutide", "https://www.ema.europa.eu/en/medicines/human/EPAR/victoza"],
  ["liraglutide-saxenda", "https://www.ema.europa.eu/en/medicines/human/EPAR/saxenda"],
];
const emaOut = [];
for (const [slug, url] of ema) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  emaOut.push({ slug, url, status: res.status, ok: res.ok });
  console.log("ema", slug, res.status);
}
await mkdir(OUT, { recursive: true });
await writeFile(resolve(OUT, "ema-check.json"), JSON.stringify(emaOut, null, 2));
