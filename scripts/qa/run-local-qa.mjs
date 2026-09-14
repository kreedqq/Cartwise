/**
 * Local QA runner: guard → ensure supabase → seed → vitest qa suite.
 * Never targets production.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { assertSafeLocalQaTarget } from "./productionGuard.mjs";

const ROOT = resolve(process.cwd());
const ACCOUNTS = join(ROOT, "supabase/qa/.generated/qa-accounts.local.json");

function runSupabase(args) {
  if (process.platform === "win32") {
    return execFileSync("cmd.exe", ["/c", "supabase", ...args], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
  return execFileSync("supabase", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function statusEnv() {
  const raw = runSupabase(["status", "-o", "env"]);
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[m[1]] = value;
  }
  return env;
}

function main() {
  let status;
  try {
    status = statusEnv();
  } catch (err) {
    console.error("Local Supabase is not running. Start it with: supabase start");
    console.error(err?.stderr || err?.message || err);
    process.exit(1);
  }

  const apiUrl = status.API_URL || status.SUPABASE_URL;
  assertSafeLocalQaTarget({
    supabaseUrl: apiUrl,
    databaseUrl: status.DB_URL,
    extra: [status.STUDIO_URL, process.env.VITE_SUPABASE_URL, process.env.SUPABASE_URL],
  });

  console.log("Seeding local QA…");
  const seed = spawnSync(process.execPath, [join(ROOT, "scripts/qa/seed-local-qa.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (seed.status !== 0) process.exit(seed.status ?? 1);

  if (!existsSync(ACCOUNTS)) {
    console.error(`Missing ${ACCOUNTS}`);
    process.exit(1);
  }

  const accounts = JSON.parse(readFileSync(ACCOUNTS, "utf8"));
  assertSafeLocalQaTarget({ supabaseUrl: accounts.apiUrl });

  const env = {
    ...process.env,
    PEPTIX_QA_LOCAL: "1",
    VITE_SUPABASE_URL: accounts.apiUrl,
    VITE_SUPABASE_ANON_KEY: accounts.anonKey,
    PEPTIX_QA_ACCOUNTS_PATH: ACCOUNTS,
  };

  delete env.SUPABASE_URL;
  delete env.SUPABASE_SERVICE_ROLE_KEY;

  console.log(`Running local QA against ${accounts.apiUrl}`);
  const vitest = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["vitest", "run", "--config", "vitest.qa.config.ts"],
    { cwd: ROOT, encoding: "utf8", stdio: "inherit", env, shell: process.platform === "win32" },
  );
  process.exit(vitest.status ?? 1);
}

main();
