/**
 * Batch 03 extra regulatory HTTP checks (official URLs only).
 * Does not scrape HTML for claims. Does not overwrite Batch 01/02 ema-check.json.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "src/research/cache/fetched/batch03");
const UA = "PeptixResearch/1.0 (scientific catalog; official APIs only)";

const EMA = [
  ["semaglutide-ozempic", "https://www.ema.europa.eu/en/medicines/human/EPAR/ozempic"],
  ["semaglutide-wegovy", "https://www.ema.europa.eu/en/medicines/human/EPAR/wegovy"],
  ["tirzepatide-mounjaro", "https://www.ema.europa.eu/en/medicines/human/EPAR/mounjaro"],
  ["liraglutide-victoza", "https://www.ema.europa.eu/en/medicines/human/EPAR/victoza"],
  ["liraglutide-saxenda", "https://www.ema.europa.eu/en/medicines/human/EPAR/saxenda"],
  ["orforglipron-foundayo", "https://www.ema.europa.eu/en/medicines/human/EPAR/foundayo"],
  ["orforglipron", "https://www.ema.europa.eu/en/medicines/human/EPAR/orforglipron"],
  ["retatrutide", "https://www.ema.europa.eu/en/medicines/human/EPAR/retatrutide"],
  ["mazdutide", "https://www.ema.europa.eu/en/medicines/human/EPAR/mazdutide"],
  ["tesamorelin-egrifta", "https://www.ema.europa.eu/en/medicines/human/EPAR/egrifta"],
  ["somatropin-omnitrope", "https://www.ema.europa.eu/en/medicines/human/EPAR/omnitrope"],
  ["hcg-ovitrelle", "https://www.ema.europa.eu/en/medicines/human/EPAR/ovitrelle"],
  ["gonadorelin-lutrelef", "https://www.ema.europa.eu/en/medicines/human/EPAR/lutrelef"],
];

async function check(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  return { status: res.status, ok: res.ok, finalUrl: res.url };
}

await mkdir(OUT, { recursive: true });
const startedAt = new Date().toISOString();
const emaOut = [];
for (const [slug, url] of EMA) {
  const res = await check(url);
  emaOut.push({ slug, url, ...res });
  console.log("ema", slug, res.status);
}

const fda = [];
for (const query of ["retatrutide", "orforglipron", "mazdutide", "semaglutide"]) {
  const url = `https://api.fda.gov/drug/drugsfda.json?search=${encodeURIComponent(`openfda.generic_name:"${query}"`)}&limit=3`;
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
  const body = await res.json().catch(() => null);
  const found = Array.isArray(body?.results) && body.results.length > 0;
  const applications = found
    ? body.results.flatMap((row) => row.products ?? []).slice(0, 6).map((p) => p.brand_name).filter(Boolean)
    : [];
  fda.push({
    query,
    httpStatus: res.status,
    found,
    message: body?.error?.message ?? null,
    brands: applications,
  });
  console.log("fda", query, res.status, found);
}

await writeFile(
  resolve(OUT, "regulatory-check.json"),
  JSON.stringify(
    {
      accessDate: startedAt.slice(0, 10),
      startedAt,
      completedAt: new Date().toISOString(),
      connectors: ["ema-epar-http", "openfda-drugsfda"],
      bfarm: { status: "unavailable", note: "No supported BfArM API configured; no HTML scrape." },
      mhra: { status: "unavailable", note: "No supported MHRA product API configured; no HTML scrape." },
      nmpa: { status: "unavailable", note: "No supported NMPA English API configured; Mazdutide stays review-required." },
      ema: emaOut,
      fda,
    },
    null,
    2,
  ),
);
console.log("wrote batch03/regulatory-check.json");
