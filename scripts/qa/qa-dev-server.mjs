#!/usr/bin/env node
/** Start Vite for local QA with supabase/qa account env (never production .env.local). */
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";

import { assertSafeLocalQaTarget } from "./productionGuard.mjs";
import { assertViteResponsive } from "./qa-vite-watchdog.mjs";

const ROOT = resolve(process.cwd());
const DEFAULT_PORT = 5190;

export async function waitForHttpOk(url, timeoutMs = 120_000) {
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

function loadQaAccounts(path) {
  const accounts = JSON.parse(readFileSync(path, "utf8"));
  assertSafeLocalQaTarget({ supabaseUrl: accounts.apiUrl });
  return accounts;
}

function spawnQaVite(accounts, port) {
  const nodeOpts = [process.env.NODE_OPTIONS, "--max-old-space-size=8192"].filter(Boolean).join(" ").trim();
  const env = {
    ...process.env,
    VITE_SUPABASE_URL: accounts.apiUrl,
    VITE_SUPABASE_ANON_KEY: accounts.anonKey,
  };
  if (nodeOpts) env.NODE_OPTIONS = nodeOpts;
  delete env.SUPABASE_URL;
  delete env.SUPABASE_SERVICE_ROLE_KEY;

  const viteBin = resolve(ROOT, "node_modules/vite/bin/vite.js");
  return spawn(process.execPath, [viteBin, "--port", String(port), "--strictPort"], {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Stop QA Vite and wait for exit so strictPort can be reused (Windows-safe). */
export async function stopQaViteChild(child) {
  if (!child || child.killed || child.exitCode != null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const force = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // already gone
      }
      resolve();
    }, 5000);
    child.once("exit", () => {
      clearTimeout(force);
      resolve();
    });
  });
}

function isPortBusyError(message) {
  return /PORT_IN_USE|already in use|Vite exited/i.test(String(message));
}

async function waitForViteReady(child, port, timeoutMs = 90_000) {
  let log = "";
  child.stdout?.on("data", (c) => {
    log += c.toString();
  });
  child.stderr?.on("data", (c) => {
    log += c.toString();
  });

  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Vite timeout on :${port}\n${log.slice(-2000)}`));
    }, timeoutMs);

    const done = (url, err) => {
      clearTimeout(timer);
      if (err) reject(err);
      else resolvePromise(url);
    };

    child.once("exit", (code) => {
      if (code != null && code !== 0) done(null, new Error(`Vite exited ${code}`));
    });

    const onData = (chunk) => {
      const text = chunk.toString();
      if (/already in use/i.test(text)) {
        done(null, new Error("PORT_IN_USE"));
        return;
      }
      const m = text.match(/Local:\s+(https?:\/\/[^\s]+)/);
      if (m) done(m[1].replace(/\/$/, ""), null);
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
  });
}

/**
 * @param {string} accountsPath
 * @param {number} [preferredPort]
 */
export async function startQaDevServer(accountsPath, preferredPort = DEFAULT_PORT) {
  if (!existsSync(accountsPath)) throw new Error(`Missing QA accounts: ${accountsPath}`);
  const accounts = loadQaAccounts(accountsPath);

  for (let port = preferredPort; port < preferredPort + 8; port += 1) {
    const child = spawnQaVite(accounts, port);
    try {
      const localUrl = await waitForViteReady(child, port);
      const base = localUrl.replace(/\/$/, "");
      await waitForHttpOk(base, 60_000);
      await assertViteResponsive(base);
      return { base, child, accounts };
    } catch (err) {
      await stopQaViteChild(child);
      if (isPortBusyError(err.message)) continue;
      throw err;
    }
  }
  throw new Error("Could not start QA Vite (ports busy)");
}
