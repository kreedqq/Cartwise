import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "src/research/cache/fetched");
const UA = "PeptixResearch/1.0 (scientific catalog; official APIs only)";

const LABELS = [
  { slug: "semaglutide", query: "semaglutide" },
  { slug: "tirzepatide", query: "tirzepatide" },
  { slug: "liraglutide", query: "liraglutide" },
  { slug: "tesamorelin", query: "tesamorelin" },
  { slug: "orforglipron", query: "orforglipron" },
  { slug: "somatropin", query: "somatropin" },
  { slug: "hcg", query: "chorionic gonadotropin" },
  { slug: "gonadorelin", query: "gonadorelin" },
  { slug: "sermorelin", query: "sermorelin" },
  { slug: "thymosin-alpha-1", query: "thymalfasin" },
];

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

function clip(value, max = 500) {
  if (typeof value !== "string") return Array.isArray(value) ? value[0]?.slice?.(0, max) ?? null : null;
  return value.slice(0, max);
}

for (const { slug, query } of LABELS) {
  const url = `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(`openfda.generic_name:"${query}"`)}&limit=3`;
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
  await writeFile(resolve(OUT, `${slug}.fda-label.json`), JSON.stringify({ name: slug, query, status: res.status, labels }, null, 2));
  console.log(slug, res.status, labels.map((l) => (l.brand || []).join("/")).join(" | ") || "(none)");
}

const ema = [
  ["semaglutide", "https://www.ema.europa.eu/en/medicines/human/EPAR/ozempic"],
  ["semaglutide-wegovy", "https://www.ema.europa.eu/en/medicines/human/EPAR/wegovy"],
  ["tirzepatide", "https://www.ema.europa.eu/en/medicines/human/EPAR/mounjaro"],
  ["liraglutide", "https://www.ema.europa.eu/en/medicines/human/EPAR/victoza"],
  ["liraglutide-saxenda", "https://www.ema.europa.eu/en/medicines/human/EPAR/saxenda"],
  ["orforglipron-foundayo", "https://www.ema.europa.eu/en/medicines/human/EPAR/foundayo"],
  ["somatropin-omnitrope", "https://www.ema.europa.eu/en/medicines/human/EPAR/omnitrope"],
  ["somatropin-norditropin", "https://www.ema.europa.eu/en/medicines/human/EPAR/norditropin"],
  ["hcg-ovitrelle", "https://www.ema.europa.eu/en/medicines/human/EPAR/ovitrelle"],
  ["gonadorelin-lutrelef", "https://www.ema.europa.eu/en/medicines/human/EPAR/lutrelef"],
];
const emaOut = [];
for (const [slug, url] of ema) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  emaOut.push({ slug, url, status: res.status, ok: res.ok });
  console.log("ema", slug, res.status);
}
await mkdir(OUT, { recursive: true });
await writeFile(resolve(OUT, "ema-check.json"), JSON.stringify(emaOut, null, 2));
