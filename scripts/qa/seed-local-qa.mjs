/**
 * Seed local QA auth users + apply supabase/qa/seed_qa_catalog.sql.
 * Aborts if the target URL looks like production.
 * Never uses --linked / production project refs.
 */
import { execFileSync, execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { assertSafeLocalQaTarget } from "./productionGuard.mjs";

const ROOT = resolve(process.cwd());
const OUT_DIR = join(ROOT, "supabase/qa/.generated");
const ACCOUNTS_OUT = join(OUT_DIR, "qa-accounts.local.json");
const DB_CONTAINER = "supabase_db_shared-cart-app";

/** Local-only passwords. Never use on production. */
export const QA_ACCOUNTS = [
  {
    key: "admin",
    email: "qa-admin@local.test",
    password: "QaLocal-Admin-2026!",
    username: "qa_admin",
    displayName: "QA Admin",
    customerRole: "Group Buy",
    isAdmin: true,
  },
  {
    key: "groupBuy",
    email: "qa-group-buy@local.test",
    password: "QaLocal-GroupBuy-2026!",
    username: "qa_group_buy",
    displayName: "QA Group Buy",
    customerRole: "Group Buy",
    isAdmin: false,
  },
  {
    key: "neu",
    email: "qa-neu@local.test",
    password: "QaLocal-Neu-2026!",
    username: "qa_neu",
    displayName: "QA NEU",
    customerRole: "NEU",
    isAdmin: false,
  },
  {
    key: "kunde",
    email: "qa-kunde@local.test",
    password: "QaLocal-Kunde-2026!",
    username: "qa_kunde",
    displayName: "QA Kunde",
    customerRole: "Kunde",
    isAdmin: false,
  },
  {
    key: "stammkunde",
    email: "qa-stammkunde@local.test",
    password: "QaLocal-Stamm-2026!",
    username: "qa_stammkunde",
    displayName: "QA Stammkunde",
    customerRole: "Stammkunde",
    isAdmin: false,
  },
];

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

function readStatusEnv() {
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

function applySqlFile(relativePath) {
  const abs = resolve(ROOT, relativePath);
  // Prefer docker psql so we never need a host psql install and never touch --linked.
  execFileSync("docker", ["cp", abs, `${DB_CONTAINER}:/tmp/peptix-qa.sql`], {
    cwd: ROOT,
    encoding: "utf8",
  });
  execFileSync(
    "docker",
    ["exec", DB_CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-f", "/tmp/peptix-qa.sql"],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

function applySqlText(sql) {
  mkdirSync(OUT_DIR, { recursive: true });
  const tmp = join(OUT_DIR, `inline-${Date.now()}.sql`);
  writeFileSync(tmp, sql, "utf8");
  execFileSync("docker", ["cp", tmp, `${DB_CONTAINER}:/tmp/peptix-qa-inline.sql`], {
    cwd: ROOT,
    encoding: "utf8",
  });
  execFileSync(
    "docker",
    [
      "exec",
      DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      "/tmp/peptix-qa-inline.sql",
    ],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

async function ensureUser(admin, account) {
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listed.error) throw listed.error;
  const existing = listed.data.users.find(
    (u) => u.email?.toLowerCase() === account.email.toLowerCase(),
  );
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: account.password,
      email_confirm: true,
      user_metadata: { display_name: account.displayName },
    });
    if (error) throw error;
    return existing.id;
  }

  const created = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { display_name: account.displayName },
  });
  if (created.error) throw created.error;
  return created.data.user.id;
}

async function main() {
  const status = readStatusEnv();
  const apiUrl = status.API_URL || status.SUPABASE_URL;
  const serviceKey = status.SERVICE_ROLE_KEY || status.SECRET_KEY;
  const dbUrl = status.DB_URL;

  assertSafeLocalQaTarget({
    supabaseUrl: apiUrl,
    databaseUrl: dbUrl,
    extra: [status.STUDIO_URL, status.REST_URL],
  });

  if (!serviceKey) throw new Error("Missing local SERVICE_ROLE_KEY from supabase status");

  // Sanity: container must be the local project db
  const containers = execSync("docker ps --format {{.Names}}", { encoding: "utf8" });
  if (!containers.includes(DB_CONTAINER)) {
    throw new Error(`Local DB container missing: ${DB_CONTAINER}. Run supabase start.`);
  }

  applySqlFile("supabase/qa/seed_qa_catalog.sql");

  const admin = createClient(apiUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const ids = {};
  for (const account of QA_ACCOUNTS) {
    ids[account.key] = await ensureUser(admin, account);
  }

  const roleAssignSql = QA_ACCOUNTS.map((account) => {
    const uid = ids[account.key];
    const adminSql = account.isAdmin
      ? `insert into public.user_roles (user_id, role) values ('${uid}', 'admin') on conflict do nothing;`
      : `delete from public.user_roles where user_id = '${uid}' and role = 'admin';`;
    return `
      update public.profiles
      set display_name = '${account.displayName}',
          username = '${account.username}',
          username_required_on_next_login = false
      where id = '${uid}';

      insert into public.user_customer_roles (user_id, role_id)
      select '${uid}', r.id
      from public.customer_roles r
      where upper(trim(r.name)) = upper(trim('${account.customerRole}'))
      on conflict (user_id) do update set role_id = excluded.role_id;

      ${adminSql}
    `;
  }).join("\n");

  applySqlText(roleAssignSql);

  mkdirSync(OUT_DIR, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    apiUrl,
    anonKey: status.ANON_KEY || status.PUBLISHABLE_KEY,
    accounts: QA_ACCOUNTS.map((a) => ({
      key: a.key,
      email: a.email,
      password: a.password,
      username: a.username,
      customerRole: a.customerRole,
      isAdmin: a.isAdmin,
      userId: ids[a.key],
    })),
  };
  writeFileSync(ACCOUNTS_OUT, JSON.stringify(payload, null, 2), "utf8");
  console.log(`QA seed OK → ${ACCOUNTS_OUT}`);
  console.log(`Users: ${QA_ACCOUNTS.map((a) => a.username).join(", ")}`);
}

main().catch((err) => {
  console.error(err?.stderr || err?.message || err);
  process.exit(1);
});
