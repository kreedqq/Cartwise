#!/usr/bin/env node

/** Runs local browser QA suite — never targets production. */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { MATRIX_VIEWPORTS } from "./browser-matrix.mjs";

import { assertSafeLocalQaTarget } from "./productionGuard.mjs";
import { startQaDevServer, stopQaViteChild, waitForHttpOk } from "./qa-dev-server.mjs";
import { assertViteResponsive } from "./qa-vite-watchdog.mjs";

const ROOT = resolve(process.cwd());
const ACCOUNTS_PATH = resolve(ROOT, "supabase/qa/.generated/qa-accounts.local.json");
const DEFAULT_QA_DEV_PORT = 5190;

const ALL_STEPS = [
  "browser-customer-flow.mjs",
  "browser-kit-flow.mjs",
  "browser-admin-flow.mjs",
  "browser-accessibility.mjs",
  "browser-matrix.mjs",
];

function resolveSteps() {
  const raw = process.env.PEPTIX_BROWSER_STEPS?.trim();
  if (!raw) return ALL_STEPS;
  const wanted = new Set(raw.split(/[,;\s]+/).filter(Boolean));
  const picked = ALL_STEPS.filter((s) => wanted.has(s.replace(".mjs", "")) || wanted.has(s));
  if (!picked.length) throw new Error(`PEPTIX_BROWSER_STEPS matched no scripts: ${raw}`);
  return picked;
}

function loadQaAccounts() {
  if (!existsSync(ACCOUNTS_PATH)) {
    throw new Error("Run npm run test:qa seed first (qa-accounts.local.json missing)");
  }
  const accounts = JSON.parse(readFileSync(ACCOUNTS_PATH, "utf8"));
  assertSafeLocalQaTarget({ supabaseUrl: accounts.apiUrl });
  return accounts;
}

const GENERATED_DIR = resolve(ROOT, "supabase/qa/.generated");

function spawnMatrixStep(script, childEnv) {
  return spawnSync(process.execPath, [resolve(ROOT, "scripts/qa", script)], {
    cwd: ROOT,
    stdio: "inherit",
    env: childEnv,
  });
}

async function restartQaVite(accountsPath, preferredPort) {
  await new Promise((r) => setTimeout(r, 1500));
  const restarted = await startQaDevServer(accountsPath, preferredPort);
  await assertViteResponsive(restarted.base);
  return restarted;
}

function readMatrixChunkResults(tag) {
  const path = resolve(GENERATED_DIR, `browser-matrix-results-${tag}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeMergedMatrixResults(chunks) {
  mkdirSync(GENERATED_DIR, { recursive: true });
  const results = chunks.flatMap((c) => c.results ?? []);
  const failed = results.filter((r) => !r.pass);
  const infra = chunks.find((c) => c.outcome === "INFRASTRUCTURE_BLOCKED");
  const payload = {
    generatedAt: new Date().toISOString(),
    base: chunks[0]?.base ?? null,
    outcome: infra ? "INFRASTRUCTURE_BLOCKED" : failed.length ? "TEST_FAILURE" : "PASS",
    chunks: chunks.map((c) => ({ tag: c.tag, outcome: c.outcome })),
    results,
    error: infra?.error ?? null,
    matrixState: infra?.matrixState ?? null,
    viteHealth: infra?.viteHealth ?? null,
  };
  const outPath = resolve(GENERATED_DIR, "browser-matrix-results.json");
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Results: ${outPath}`);
  return payload;
}

/** Fresh Vite per viewport so long sweeps cannot stall a single dev server. */
async function runBrowserMatrixChunked({
  childEnv,
  accountsPath,
  preferredPort,
  getViteChild,
  setViteChild,
  setBase,
}) {
  const chunkPayloads = [];

  for (let i = 0; i < MATRIX_VIEWPORTS.length; i += 1) {
    const vp = MATRIX_VIEWPORTS[i].name;
    console.log(`\n--- Matrix chunk viewport=${vp} (${i + 1}/${MATRIX_VIEWPORTS.length}) ---\n`);

    let viteChild = getViteChild();
    if (process.env.PEPTIX_BROWSER_USE_EXISTING_DEV !== "1") {
      await stopQaViteChild(viteChild);
      setViteChild(null);
      const restarted = await restartQaVite(accountsPath, preferredPort);
      setBase(restarted.base);
      setViteChild(restarted.child);
      childEnv.PEPTIX_DEV_URL = restarted.base;
    }

    await waitForHttpOk(childEnv.PEPTIX_DEV_URL, 120_000);
    await assertViteResponsive(childEnv.PEPTIX_DEV_URL);
    console.log("MATRIX START (Vite HTTP verified)");

    const chunkEnv = {
      ...childEnv,
      PEPTIX_MATRIX_VIEWPORT: vp,
      PEPTIX_MATRIX_RESULTS_TAG: vp,
      PEPTIX_MATRIX_INCLUDE_RETAIL: i === 0 ? "1" : "0",
    };

    let attempt = 0;
    let chunk = null;
    while (attempt < 2) {
      const child = spawnMatrixStep("browser-matrix.mjs", chunkEnv);
      chunk = readMatrixChunkResults(vp);
      if (child.status === 0 && chunk?.outcome === "PASS") break;

      const infra = child.status === 2 || chunk?.outcome === "INFRASTRUCTURE_BLOCKED";
      if (infra && attempt === 0 && process.env.PEPTIX_BROWSER_USE_EXISTING_DEV !== "1") {
        attempt += 1;
        console.error(`\nMatrix chunk viewport=${vp} INFRASTRUCTURE_BLOCKED — restarting Vite once…\n`);
        await stopQaViteChild(getViteChild());
        setViteChild(null);
        const restarted = await restartQaVite(accountsPath, preferredPort);
        setBase(restarted.base);
        setViteChild(restarted.child);
        childEnv.PEPTIX_DEV_URL = restarted.base;
        chunkEnv.PEPTIX_DEV_URL = restarted.base;
        continue;
      }

      chunkPayloads.push({ tag: vp, ...(chunk ?? { outcome: "ERROR", results: [] }) });
      const merged = writeMergedMatrixResults(chunkPayloads);
      if (infra || child.status === 2) {
        console.error("\nBrowser step failed: INFRASTRUCTURE_BLOCKED (see matrix logs / browser-matrix-results.json)\n");
        process.exit(2);
      }
      console.error(`Matrix chunk viewport=${vp} failed`);
      process.exit(child.status ?? 1);
    }

    chunkPayloads.push({ tag: vp, ...chunk });
  }

  const merged = writeMergedMatrixResults(chunkPayloads);
  const failed = (merged.results ?? []).filter((r) => !r.pass);
  if (failed.length) {
    console.error(failed.slice(0, 15));
    process.exit(1);
  }
  console.log("BROWSER MATRIX PASS");
}

async function main() {
  loadQaAccounts();

  let viteChild = null;
  let base;

  if (process.env.PEPTIX_BROWSER_USE_EXISTING_DEV === "1") {
    base = process.env.PEPTIX_DEV_URL ?? "http://localhost:5173";
    if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(base)) {
      throw new Error(`PEPTIX_DEV_URL must be localhost (got ${base})`);
    }
    console.log(`Using existing dev server at ${base}`);
    await waitForHttpOk(base);
  } else {
    const port = Number(process.env.PEPTIX_BROWSER_DEV_PORT ?? DEFAULT_QA_DEV_PORT);
    console.log(`Starting QA Vite (preferred port ${port})…`);
    const started = await startQaDevServer(ACCOUNTS_PATH, port);
    base = started.base;
    viteChild = started.child;
    console.log(`QA Vite ready at ${base}`);
  }

  const cleanup = async () => {
    await stopQaViteChild(viteChild);
  };
  process.on("SIGINT", () => {
    void cleanup().finally(() => process.exit(130));
  });

  const childEnv = {
    ...process.env,
    PEPTIX_DEV_URL: base,
    PEPTIX_QA_ACCOUNTS_PATH: ACCOUNTS_PATH,
    PEPTIX_MANAGE_QA_VITE: "0",
  };

  const preferredPort = Number(process.env.PEPTIX_BROWSER_DEV_PORT ?? DEFAULT_QA_DEV_PORT);

  const STEPS = resolveSteps();
  for (const script of STEPS) {
    console.log(`\n=== ${script} ===\n`);
    if (script === "browser-matrix.mjs" && process.env.PEPTIX_BROWSER_USE_EXISTING_DEV !== "1") {
      console.log("Restarting QA Vite before browser-matrix (long prior steps can stall dev server)…");
      await stopQaViteChild(viteChild);
      viteChild = null;
      await new Promise((r) => setTimeout(r, 1500));
      const restarted = await startQaDevServer(ACCOUNTS_PATH, preferredPort);
      base = restarted.base;
      viteChild = restarted.child;
      childEnv.PEPTIX_DEV_URL = base;
      console.log(`QA Vite restarted at ${base}`);
    }
    if (script === "browser-matrix.mjs" || script === "browser-accessibility.mjs") {
      await waitForHttpOk(base, 120_000);
      await assertViteResponsive(base);
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (script === "browser-matrix.mjs") {
      await runBrowserMatrixChunked({
        childEnv,
        accountsPath: ACCOUNTS_PATH,
        preferredPort,
        getViteChild: () => viteChild,
        setViteChild: (c) => {
          viteChild = c;
        },
        setBase: (b) => {
          base = b;
        },
      });
      continue;
    }

    const child = spawnMatrixStep(script, childEnv);
    if (child.status !== 0) {
      await cleanup();
      if (child.status === 2) {
        console.error("\nBrowser step failed: INFRASTRUCTURE_BLOCKED\n");
      }
      process.exit(child.status ?? 1);
    }
  }

  await cleanup();
  console.log("\nALL BROWSER QA STEPS PASS\n");
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
