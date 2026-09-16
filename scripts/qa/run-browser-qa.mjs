#!/usr/bin/env node

/** Runs local browser QA suite — never targets production. */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { assertSafeLocalQaTarget } from "./productionGuard.mjs";

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

async function waitForHttpOk(url, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev server not ready at ${url}`);
}

function spawnQaVite(accounts, port) {
  const env = {
    ...process.env,
    VITE_SUPABASE_URL: accounts.apiUrl,
    VITE_SUPABASE_ANON_KEY: accounts.anonKey,
  };
  delete env.SUPABASE_URL;
  delete env.SUPABASE_SERVICE_ROLE_KEY;

  const viteBin = resolve(ROOT, "node_modules/vite/bin/vite.js");
  const child = spawn(process.execPath, [viteBin, "--port", String(port), "--strictPort"], {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let log = "";
  child.stdout?.on("data", (chunk) => {
    log += chunk.toString();
    process.stdout.write(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    log += chunk.toString();
    process.stderr.write(chunk);
  });

  return { child, log: () => log };
}

async function waitForViteReady(child, getLog, port, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Vite did not become ready on port ${port}\n${getLog().slice(-3000)}`));
    }, timeoutMs);

    const finish = (result, err) => {
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(result);
    };

    child.once("exit", (code) => {
      if (code != null && code !== 0) {
        finish(null, new Error(`Vite exited (${code}) on port ${port}:\n${getLog().slice(-3000)}`));
      }
    });

    const onData = (chunk) => {
      const text = chunk.toString();
      if (/already in use/i.test(text)) {
        child.stdout?.off("data", onData);
        child.stderr?.off("data", onData);
        finish(null, new Error("PORT_IN_USE"));
        return;
      }
      const m = text.match(/Local:\s+(https?:\/\/[^\s]+)/);
      if (m) {
        child.stdout?.off("data", onData);
        child.stderr?.off("data", onData);
        finish(m[1].replace(/\/$/, ""), null);
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
  });
}

async function startLocalQaDevServer(accounts, preferredPort) {
  let lastError = null;
  for (let port = preferredPort; port < preferredPort + 8; port += 1) {
    const { child, log } = spawnQaVite(accounts, port);
    try {
      const localUrl = await waitForViteReady(child, log, port);
      const base = localUrl.replace(/\/$/, "");
      await waitForHttpOk(base, 30_000);
      return { base, child };
    } catch (err) {
      child.kill("SIGTERM");
      lastError = err;
      if (/already in use|PORT_IN_USE|Vite exited/i.test(String(err.message))) continue;
    }
  }
  throw lastError ?? new Error("Could not start QA Vite dev server");
}

async function main() {
  const accounts = loadQaAccounts();

  let viteChild = null;
  let base;

  if (process.env.PEPTIX_BROWSER_USE_EXISTING_DEV === "1") {
    base = process.env.PEPTIX_DEV_URL ?? "http://localhost:5173";
    if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(base)) {
      throw new Error(`PEPTIX_DEV_URL must be localhost (got ${base})`);
    }
    console.log(`Using existing dev server at ${base} (expect local Supabase ${accounts.apiUrl})`);
    await waitForHttpOk(base);
  } else {
    const port = Number(process.env.PEPTIX_BROWSER_DEV_PORT ?? DEFAULT_QA_DEV_PORT);
    console.log(`Starting QA Vite on 127.0.0.1:${port} → ${accounts.apiUrl}`);
    const started = await startLocalQaDevServer(accounts, port);
    base = started.base;
    viteChild = started.child;
  }

  const cleanup = () => {
    if (viteChild && !viteChild.killed) {
      viteChild.kill("SIGTERM");
    }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  const childEnv = {
    ...process.env,
    PEPTIX_DEV_URL: base,
    VITE_SUPABASE_URL: accounts.apiUrl,
    VITE_SUPABASE_ANON_KEY: accounts.anonKey,
    PEPTIX_QA_ACCOUNTS_PATH: ACCOUNTS_PATH,
  };

  const STEPS = resolveSteps();
  for (const script of STEPS) {
    console.log(`\n=== ${script} ===\n`);
    if (script === "browser-matrix.mjs" || script === "browser-accessibility.mjs") {
      await waitForHttpOk(base, 120_000);
      await new Promise((r) => setTimeout(r, 1500));
    }
    const child = spawnSync(process.execPath, [resolve(ROOT, "scripts/qa", script)], {
      cwd: ROOT,
      stdio: "inherit",
      env: childEnv,
    });
    if (child.status !== 0) {
      cleanup();
      process.exit(child.status ?? 1);
    }
  }

  cleanup();
  console.log("\nALL BROWSER QA STEPS PASS\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
