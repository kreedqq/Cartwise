#!/usr/bin/env node
/**
 * Full local visual acceptance: QA Vite, portal assign (Admin UI), captures, vial acceptance, restore, tests.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { ACCOUNTS_PATH, GENERATED_DIR, requireQaAccounts } from "./browser-helpers.mjs";
import { startQaDevServer, stopQaViteChild } from "./qa-dev-server.mjs";
import { assertViteResponsive } from "./qa-vite-watchdog.mjs";

requireQaAccounts();

const ROOT = resolve(process.cwd());
const OUT = resolve(GENERATED_DIR, "screenshots/final-visual-acceptance");
const PORT = Number(process.env.PEPTIX_BROWSER_DEV_PORT ?? 5190);

function runNode(script, env = {}) {
  const child = spawnSync(process.execPath, [resolve(ROOT, "scripts/qa", script)], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (child.status !== 0) process.exit(child.status ?? 1);
}

function runNpm(script) {
  const child = spawnSync("npm", ["run", script], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  if (child.status !== 0) process.exit(child.status ?? 1);
}

let base;
let viteChild = null;

async function refreshQaVite(label) {
  await stopQaViteChild(viteChild);
  viteChild = null;
  await new Promise((r) => setTimeout(r, 1500));
  const started = await startQaDevServer(ACCOUNTS_PATH, PORT);
  base = started.base;
  viteChild = started.child;
  await assertViteResponsive(base);
  console.log(`QA Vite ${label} at ${base}`);
}

await refreshQaVite("ready");

function qaEnv(extra = {}) {
  return {
    PEPTIX_DEV_URL: base,
    PEPTIX_MANAGE_QA_VITE: "0",
    PEPTIX_PORTAL_QA_SKIP_RESTORE: "1",
    ...extra,
  };
}

try {
  runNode("apply-portal-qa-via-admin.mjs", qaEnv());
  runNode("final-visual-acceptance-capture.mjs", qaEnv());
  runNode("portal-vial-acceptance.mjs", qaEnv());

  await refreshQaVite("before portal fallback QA");
  runNode("apply-portal-qa-via-admin.mjs", qaEnv({
    PEPTIX_PORTAL_QA_SKIP_BACKUP: "1",
    PEPTIX_PORTAL_FALLBACK_TEST: "1",
  }));

  await refreshQaVite("before portal restore");
  runNode("apply-portal-qa-via-admin.mjs", qaEnv({
    PEPTIX_PORTAL_QA_RESTORE_ONLY: "1",
  }));

  const named = [
    ["10-portal-library-1440.png", "PORTAL-LIBRARY.png"],
    ["11-vial-library-1440.png", "VIAL-LIBRARY.png"],
    ["09-design-studio-1440.png", "DESIGN-STUDIO.png"],
    ["12-portal-preview-1440.png", "PORTAL-PREVIEW.png"],
  ];
  for (const [src, dest] of named) {
    const from = join(OUT, src);
    if (existsSync(from)) copyFileSync(from, join(OUT, dest));
  }
} finally {
  await stopQaViteChild(viteChild);
}

runNpm("validate:portals");
runNpm("typecheck");
console.log("\nVisual acceptance orchestration done. Run npm test / test:qa / test:browser separately if not yet run.\n");
