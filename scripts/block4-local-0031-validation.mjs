/**
 * Block 4: restore the local 0023 dump in isolated Docker Postgres,
 * apply 0024–0031, import Batch 03, validate. Never touches production.
 */
import { createHash } from "node:crypto";
import { execFileSync, execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "vite";

const EXPECTED_SHA = "dae0ef581968cdd7a33eb5dc34c44064a0ff8fbfaa89a666b6e25d5897cb973a";
const DUMP = "C:\\Users\\PolatMehmetErkan\\Documents\\cartwise-prod-backup\\cartwise-prod-0023-2026-08-28-full.sql";
const ROOT = process.cwd();
const MIGRATIONS = resolve(ROOT, "supabase/migrations");
const SNAPSHOT_DIR = resolve(ROOT, "docs/snapshots");
const REPORT_JSON = join(SNAPSHOT_DIR, "2026-08-29-block4-local.json");
const RESTORE_LOG = join(SNAPSHOT_DIR, "2026-08-29-block4-restore.log");

const MIGRATION_FILES = [
  "0024_research_identity_and_product_mapping.sql",
  "0025_research_sources_studies_runs.sql",
  "0026_research_claims_and_evidence.sql",
  "0027_research_regulatory_and_review.sql",
  "0028_research_evidence_assessments_select_approved.sql",
  "0029_research_explicit_product_mappings.sql",
  "0030_research_source_study_review_intake.sql",
  "0031_research_operations.sql",
];

const EXPECTED_0029 = {
  substances: 27,
  sources: 412,
  studies: 118,
  claims: 294,
  evidence: 294,
  regulatory: 41,
  review_actions: 19,
  mappings: 93,
  products: 320,
  orders: 0,
  users: 2,
};

const COUNTS_SQL = `
select json_build_object(
  'products', (select count(*) from public.products),
  'carts', (select count(*) from public.carts),
  'orders', (select count(*) from public.orders),
  'users', (select count(*) from auth.users),
  'price_sum', (select coalesce(sum(price_usd),0) from public.products),
  'product_fp', (select md5(string_agg(code || ':' || price_usd::text, '|' order by code)) from public.products),
  'cart_fp', (select md5(string_agg(id::text, '|' order by id)) from public.carts),
  'user_fp', (select md5(string_agg(id::text, '|' order by id)) from auth.users)
);
`;

const RESEARCH_SQL = `
select json_build_object(
  'substances', (select count(*) from public.substances),
  'sources', (select count(*) from public.sources),
  'studies', (select count(*) from public.studies),
  'claims', (select count(*) from public.claims),
  'evidence', (select count(*) from public.evidence_assessments),
  'regulatory', (select count(*) from public.regulatory_records),
  'review_actions', (select count(*) from public.review_actions),
  'mappings', (select count(*) from public.product_substances),
  'products', (select count(*) from public.products),
  'orders', (select count(*) from public.orders),
  'users', (select count(*) from auth.users)
);
`;

function dockerExecFile(name, sql, { stop = 1 } = {}) {
  const tmp = join(tmpdir(), `peptix-16a-${process.pid}-${Math.random().toString(16).slice(2)}.sql`);
  writeFileSync(tmp, sql, "utf8");
  execSync(`docker cp "${tmp}" ${name}:/tmp/peptix.sql`);
  try {
    return execFileSync(
      "docker",
      ["exec", name, "psql", "-U", "postgres", "-v", `ON_ERROR_STOP=${stop}`, "-A", "-t", "-f", "/tmp/peptix.sql"],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
  } catch (err) {
    const mixed = `${err.stdout ?? ""}\n${err.stderr ?? ""}\n${err.message}`;
    const wrapped = new Error(mixed);
    wrapped.stdout = err.stdout;
    wrapped.stderr = err.stderr;
    throw wrapped;
  }
}

function jsonQuery(name, sql, opts) {
  const out = dockerExecFile(name, sql, opts).trim();
  const line = out.split(/\r?\n/).filter((l) => l.startsWith("{")).pop();
  if (!line) throw new Error(`No JSON in psql output:\n${out.slice(0, 2000)}`);
  return JSON.parse(line);
}

async function writeBatch03Sql(outPath) {
  const vite = await createServer({
    root: ROOT,
    server: { middlewareMode: true },
    appType: "custom",
  });
  try {
    const intake = await vite.ssrLoadModule("/src/lib/peptide/research/batch03Intake.ts");
    const persist = await vite.ssrLoadModule("/src/lib/peptide/research/batch03Persist.ts");
    const analysis = JSON.parse(
      readFileSync(resolve(ROOT, "src/research/cache/fetched/batch03/analysis.json"), "utf8"),
    );
    const sql = persist.renderBatch03IntakeSql(intake.buildBatch03IntakePlan(analysis));
    writeFileSync(outPath, sql, "utf8");
    return sql.length;
  } finally {
    await vite.close();
  }
}

function classifyRestore(text) {
  const errorLines = text.split(/\r?\n/).filter((l) => /ERROR:/.test(l));
  const unique = [...new Set(errorLines)];
  const pick = (re) => {
    const out = [];
    for (const m of text.matchAll(re)) out.push(m[1]);
    return [...new Set(out)];
  };
  return {
    errorCount: errorLines.length,
    uniqueErrors: unique.slice(0, 80),
    missingRoles: pick(/role "([^"]+)" does not exist/g),
    missingExtensions: pick(/extension "([^"]+)" does not exist/gi),
    missingSchemas: pick(/schema "([^"]+)" does not exist/gi),
    permissionDenied: unique.filter((l) => /permission denied/i.test(l)).slice(0, 40),
    maintainPrivilege: unique.filter((l) => /unrecognized privilege type "maintain"/i.test(l)).length,
    transactionTimeout: unique.filter((l) => /transaction_timeout/i.test(l)).length,
  };
}

const result = {
  startedAt: new Date().toISOString(),
  dump: { path: DUMP, exists: false, bytes: 0, sha256: "", hashMatch: false },
  container: null,
  restore: {},
  migrations: {},
  counts: {},
  schema: {},
  intake: {},
  rls: { jwtSigned: "NOT TESTED", hasRoleFunction: "NOT TESTED", gucRls: "NOT TESTED" },
  identity: {},
  publicLexicon: {},
  admin: {},
  approvalPath: {},
  shop: {},
  auth: {},
  verdictNotes: [],
};

async function main() {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  if (!existsSync(DUMP)) throw new Error(`Dump missing: ${DUMP}`);
  const buf = readFileSync(DUMP);
  result.dump.exists = true;
  result.dump.bytes = buf.length;
  result.dump.sha256 = createHash("sha256").update(buf).digest("hex");
  result.dump.hashMatch = result.dump.sha256 === EXPECTED_SHA;
  if (!result.dump.hashMatch) {
    result.verdictNotes.push("STOP: SHA-256 mismatch");
    writeFileSync(REPORT_JSON, JSON.stringify(result, null, 2));
    throw new Error(`SHA-256 mismatch: ${result.dump.sha256}`);
  }

  execSync("docker info", { stdio: "ignore" });
  execSync("docker pull postgres:17", { stdio: "inherit" });
  const name = `peptix-b4-${Date.now()}`;
  result.container = name;
  execSync(`docker run -d --name ${name} -e POSTGRES_PASSWORD=postgres postgres:17`);
  for (let i = 0; i < 60; i++) {
    const ready = spawnSync("docker", ["exec", name, "pg_isready", "-U", "postgres"], { encoding: "utf8" });
    if (ready.status === 0) break;
    if (i === 59) throw new Error(`postgres not ready: ${ready.stdout} ${ready.stderr}`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
  try {
    dockerExecFile(
      name,
      `
do $$ begin create role supabase_admin login superuser password 'postgres'; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_auth_admin nologin; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_storage_admin nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
do $$ begin create role authenticator login password 'postgres' noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role dashboard_user nologin; exception when duplicate_object then null; end $$;
grant supabase_auth_admin to postgres;
grant supabase_storage_admin to postgres;
grant authenticated to authenticator;
grant anon to authenticator;
`,
    );

    execSync(`docker cp "${DUMP}" ${name}:/tmp/dump.sql`);
    const restoreProc = spawnSync(
      "docker",
      ["exec", name, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=0", "-f", "/tmp/dump.sql"],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
    const restoreOut = `${restoreProc.stdout ?? ""}\n${restoreProc.stderr ?? ""}`;
    writeFileSync(RESTORE_LOG, restoreOut);
    result.restore = {
      ...classifyRestore(restoreOut),
      psqlExit: restoreProc.status,
      image: "postgres:17",
    };

    dockerExecFile(
      name,
      `
grant usage on schema auth to authenticated, anon, postgres;
grant execute on function auth.uid() to authenticated, anon, postgres;
grant execute on function auth.role() to authenticated, anon, postgres;
grant execute on function auth.jwt() to authenticated, anon, postgres;
grant execute on function auth.email() to authenticated, anon, postgres;
`,
      { stop: 0 },
    );

    const afterRestore = jsonQuery(name, COUNTS_SQL, { stop: 0 });
    result.shop.afterRestore = afterRestore;
    result.auth.afterRestore = { users: afterRestore.users, user_fp: afterRestore.user_fp };
    if (afterRestore.products !== 320 || afterRestore.orders !== 0 || afterRestore.users !== 2) {
      result.verdictNotes.push(
        `STOP: restore counts products=${afterRestore.products} orders=${afterRestore.orders} users=${afterRestore.users}`,
      );
      writeFileSync(REPORT_JSON, JSON.stringify(result, null, 2));
      throw new Error("Restore baseline mismatch");
    }

    for (const file of MIGRATION_FILES) {
      execSync(`docker cp "${join(MIGRATIONS, file)}" ${name}:/tmp/mig.sql`);
      const out = execFileSync(
        "docker",
        ["exec", name, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-f", "/tmp/mig.sql"],
        { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
      );
      const key = file.slice(0, 4);
      const tables = jsonQuery(
        name,
        `select json_build_object(
           'tables', coalesce((
             select json_agg(tablename order by tablename)
             from pg_tables where schemaname='public' and tablename in (
               'substances','sources','studies','claims','evidence_assessments',
               'regulatory_records','review_actions','product_substances',
               'community_reports','research_connector_health'
             )
           ), '[]'::json)
         );`,
      );
      result.migrations[key] = { ok: true, errorCount: (out.match(/^ERROR:/gm) ?? []).length, tables: tables.tables };
      if (key === "0029") {
        result.counts.after0029 = jsonQuery(name, RESEARCH_SQL);
      }
    }
    for (const [k, v] of Object.entries(EXPECTED_0029)) {
      if (result.counts.after0029[k] !== v) {
        result.verdictNotes.push(`STOP: after 0029 ${k}=${result.counts.after0029[k]} expected ${v}`);
        writeFileSync(REPORT_JSON, JSON.stringify(result, null, 2));
        throw new Error(`Baseline mismatch ${k}`);
      }
    }

    result.schema.after0030 = jsonQuery(
      name,
      `
select json_build_object(
  'source_review_status', (select column_default from information_schema.columns where table_schema='public' and table_name='sources' and column_name='review_status'),
  'study_review_status', (select column_default from information_schema.columns where table_schema='public' and table_name='studies' and column_name='review_status'),
  'source_connector', exists(select 1 from information_schema.columns where table_schema='public' and table_name='sources' and column_name='connector'),
  'study_intervention', exists(select 1 from information_schema.columns where table_schema='public' and table_name='studies' and column_name='intervention'),
  'study_condition', exists(select 1 from information_schema.columns where table_schema='public' and table_name='studies' and column_name='condition'),
  'indexes', (select coalesce(json_agg(indexname order by indexname),'[]'::json) from pg_indexes where schemaname='public' and tablename in ('sources','studies') and indexname like '%review_status%'),
  'source_policies', (select coalesce(json_agg(polname order by polname),'[]'::json) from pg_policy where polrelid='public.sources'::regclass),
  'study_policies', (select coalesce(json_agg(polname order by polname),'[]'::json) from pg_policy where polrelid='public.studies'::regclass),
  'review_entity_check', (select pg_get_constraintdef(oid) from pg_constraint where conname='review_actions_entity_type_check'),
  'anon_sources_privs', (select coalesce(string_agg(privilege_type, ',' order by privilege_type),'none') from information_schema.role_table_grants where table_schema='public' and table_name='sources' and grantee='anon'),
  'triggers', (select coalesce(json_agg(tgname order by tgname),'[]'::json) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('sources','studies') and not t.tgisinternal),
  'fks', (select count(*) from information_schema.table_constraints where table_schema='public' and table_name in ('sources','studies','source_substances','study_substances','study_sources') and constraint_type='FOREIGN KEY'),
  'src_approved', (select count(*) from public.sources where review_status='approved'),
  'src_rr', (select count(*) from public.sources where review_status='review-required'),
  'stu_approved', (select count(*) from public.studies where review_status='approved'),
  'stu_rr', (select count(*) from public.studies where review_status='review-required'),
  'src_n', (select count(*) from public.sources),
  'stu_n', (select count(*) from public.studies)
);
`,
    );
    result.counts.after0030 = {
      sources: result.schema.after0030.src_n,
      studies: result.schema.after0030.stu_n,
      sourcesApproved: result.schema.after0030.src_approved,
      sourcesReviewRequired: result.schema.after0030.src_rr,
      studiesApproved: result.schema.after0030.stu_approved,
      studiesReviewRequired: result.schema.after0030.stu_rr,
    };

    result.schema.after0031 = jsonQuery(
      name,
      `
select json_build_object(
  'community_reports', exists(select 1 from information_schema.tables where table_schema='public' and table_name='community_reports'),
  'connector_health', exists(select 1 from information_schema.tables where table_schema='public' and table_name='research_connector_health'),
  'trigger_kind', exists(select 1 from information_schema.columns where table_schema='public' and table_name='research_runs' and column_name='trigger_kind'),
  'community_rows', (select count(*) from public.community_reports),
  'one_active_full', exists(select 1 from pg_indexes where schemaname='public' and indexname='research_runs_one_active_full'),
  'run_select_admin', exists(select 1 from pg_policy where polrelid='public.research_runs'::regclass and polname='research_runs_select_admin'),
  'community_default', (select column_default from information_schema.columns where table_schema='public' and table_name='community_reports' and column_name='review_status'),
  'src_n', (select count(*) from public.sources),
  'stu_n', (select count(*) from public.studies),
  'claims', (select count(*) from public.claims),
  'evidence', (select count(*) from public.evidence_assessments),
  'regulatory', (select count(*) from public.regulatory_records),
  'review_actions', (select count(*) from public.review_actions),
  'products', (select count(*) from public.products),
  'orders', (select count(*) from public.orders),
  'users', (select count(*) from auth.users)
);
`,
    );
    if (
      result.schema.after0031.src_n !== 412 ||
      result.schema.after0031.stu_n !== 118 ||
      result.schema.after0031.claims !== 294 ||
      result.schema.after0031.evidence !== 294 ||
      result.schema.after0031.regulatory !== 41 ||
      result.schema.after0031.review_actions !== 19 ||
      result.schema.after0031.products !== 320 ||
      result.schema.after0031.orders !== 0 ||
      result.schema.after0031.users !== 2 ||
      result.schema.after0031.community_rows !== 0
    ) {
      result.verdictNotes.push("STOP: 0031 mutated existing inventory");
      writeFileSync(REPORT_JSON, JSON.stringify(result, null, 2));
      throw new Error("0031 mutated existing inventory");
    }

    const sqlPath = join(tmpdir(), "batch03-review-intake-import.sql");
    result.intake.sqlBytes = await writeBatch03Sql(sqlPath);
    execSync(`docker cp "${sqlPath}" ${name}:/tmp/batch03.sql`);
    const beforeImport = jsonQuery(
      name,
      `select json_build_object('sources', (select count(*) from public.sources), 'studies', (select count(*) from public.studies));`,
    );
    execFileSync("docker", ["exec", name, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-f", "/tmp/batch03.sql"], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    const afterRun1 = jsonQuery(
      name,
      `select json_build_object('sources', (select count(*) from public.sources), 'studies', (select count(*) from public.studies));`,
    );
    execFileSync("docker", ["exec", name, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-f", "/tmp/batch03.sql"], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    const afterRun2 = jsonQuery(
      name,
      `
select json_build_object(
  'sources', (select count(*) from public.sources),
  'studies', (select count(*) from public.studies),
  'src_rr', (select count(*) from public.sources where review_status='review-required'),
  'src_ap', (select count(*) from public.sources where review_status='approved'),
  'stu_rr', (select count(*) from public.studies where review_status='review-required'),
  'stu_ap', (select count(*) from public.studies where review_status='approved'),
  'hudson_src', (select count(*) from public.sources where nct_id in ('NCT07487363','NCT07437560')),
  'hudson_stu', (select count(*) from public.studies where nct_id in ('NCT07487363','NCT07437560')),
  'pmid_rows', (select count(*) from public.sources where pmid in ('42578445','42419792','40353578','40544433')),
  'pmid_distinct', (select count(distinct pmid) from public.sources where pmid in ('42578445','42419792','40353578','40544433')),
  'claims', (select count(*) from public.claims),
  'evidence', (select count(*) from public.evidence_assessments),
  'ev_rr', (select count(*) from public.evidence_assessments where review_status='review-required'),
  'regulatory', (select count(*) from public.regulatory_records),
  'mappings', (select count(*) from public.product_substances),
  'review_actions', (select count(*) from public.review_actions)
);
`,
    );
    result.intake = {
      ...result.intake,
      before: beforeImport,
      afterRun1,
      afterRun2,
      newSourcesRun1: afterRun1.sources - beforeImport.sources,
      newStudiesRun1: afterRun1.studies - beforeImport.studies,
      newSourcesRun2: afterRun2.sources - afterRun1.sources,
      newStudiesRun2: afterRun2.studies - afterRun1.studies,
    };

    let rollbackErr = "";
    try {
      dockerExecFile(
        name,
        `
begin;
insert into public.sources (source_type, title, url, pmid, status, review_status)
values ('pubmed', 'rollback probe', 'https://example.test/rollback', '99999991', 'active', 'review-required');
insert into public.sources (source_type, title, url, pmid, status, review_status)
values ('pubmed', '', 'https://example.test/bad', '99999992', 'active', 'review-required');
commit;
`,
        { stop: 1 },
      );
    } catch (err) {
      rollbackErr = String(err.message ?? err);
    }
    result.intake.rollback = jsonQuery(
      name,
      `select json_build_object(
        'probe', (select count(*) from public.sources where pmid='99999991'),
        'bad', (select count(*) from public.sources where pmid='99999992'),
        'sources', (select count(*) from public.sources)
      );`,
    );
    result.intake.rollbackErrorSnippet = rollbackErr.slice(0, 1500);

    result.shop.afterImport = jsonQuery(name, COUNTS_SQL);
    result.auth.afterImport = { users: result.shop.afterImport.users, user_fp: result.shop.afterImport.user_fp };

    result.identity = jsonQuery(
      name,
      `
select json_build_object(
  'tb500', (select name from public.substances where slug='tb-500'),
  'tb4', (select name from public.substances where slug='thymosin-beta-4'),
  'ids_distinct', (select count(distinct id) from public.substances where slug in ('tb-500','thymosin-beta-4')),
  'melanotan', (select name from public.substances where slug='melanotan-ii'),
  'afamelanotide_alias', exists(select 1 from public.substance_aliases a join public.substances s on s.id=a.substance_id where s.slug='melanotan-ii' and lower(a.alias) like '%afamelanotide%'),
  'igf', (select name from public.substances where slug='igf-1-lr3'),
  'mecasermin_as_igf', exists(select 1 from public.substances where slug='igf-1-lr3' and lower(name) like '%mecasermin%'),
  'glow_type', (select molecule_type from public.substances where slug='glow-blend'),
  'glow_status', (select status from public.substances where slug='glow-blend')
);
`,
    );

    result.publicLexicon = jsonQuery(
      name,
      `
select json_build_object(
  'slugs', (
    select json_object_agg(sub.slug, json_build_object(
      'public_sources', (
        select count(*) from public.source_substances ss
        join public.sources s on s.id = ss.source_id
        where ss.substance_id = sub.id and s.status='active' and s.review_status='approved'
      ),
      'hidden_sources', (
        select count(*) from public.source_substances ss
        join public.sources s on s.id = ss.source_id
        where ss.substance_id = sub.id and s.review_status='review-required'
      ),
      'public_studies', (
        select count(*) from public.study_substances sts
        join public.studies st on st.id = sts.study_id
        where sts.substance_id = sub.id and st.review_status='approved'
      ),
      'hidden_studies', (
        select count(*) from public.study_substances sts
        join public.studies st on st.id = sts.study_id
        where sts.substance_id = sub.id and st.review_status='review-required'
      )
    ))
    from public.substances sub
    where sub.slug in ('retatrutide','tirzepatide','semaglutide','orforglipron','tb-500','thymosin-beta-4')
  ),
  'global', json_build_object(
    'approved_sources', (select count(*) from public.sources where status='active' and review_status='approved'),
    'rr_sources', (select count(*) from public.sources where review_status='review-required'),
    'approved_studies', (select count(*) from public.studies where review_status='approved'),
    'rr_studies', (select count(*) from public.studies where review_status='review-required')
  )
);
`,
    );

    result.admin = jsonQuery(
      name,
      `select json_build_object(
        'sources_rr', (select count(*) from public.sources where review_status='review-required'),
        'studies_rr', (select count(*) from public.studies where review_status='review-required'),
        'uuid_rr_sources', (select count(*) from public.sources where review_status='review-required' and id is not null)
      );`,
    );

    const roles = jsonQuery(
      name,
      `select json_build_object(
        'admin_id', (select user_id::text from public.user_roles where role='admin' limit 1),
        'user_id', (
          select ur.user_id::text
          from public.user_roles ur
          where ur.role='user'
            and not exists (
              select 1 from public.user_roles a
              where a.user_id = ur.user_id and a.role='admin'
            )
          limit 1
        ),
        'roles', (select coalesce(json_agg(json_build_object('role', role, 'user_id', user_id) order by role, user_id),'[]'::json) from public.user_roles)
      );`,
    );
    result.rls.userRoles = roles;

    if (roles.admin_id && roles.user_id) {
      const hasRole = jsonQuery(
        name,
        `select json_build_object(
          'admin_is_admin', public.has_role('${roles.admin_id}'::uuid,'admin'),
          'user_is_admin', public.has_role('${roles.user_id}'::uuid,'admin')
        );`,
      );
      result.rls.hasRoleFunction = hasRole.admin_is_admin === true && hasRole.user_is_admin === false ? "PASS" : hasRole;

      const gucSql = `
select json_build_object(
  'as_postgres_rr_sources', (select count(*) from public.sources where review_status='review-required')
);
`;
      const asPostgres = jsonQuery(name, gucSql);
      let authUser = null;
      let authAdmin = null;
      let anon = null;
      let nonAdminInsert = null;
      try {
        authUser = jsonQuery(
          name,
          `
set row_security = on;
set session authorization authenticated;
select set_config('request.jwt.claim.sub', '${roles.user_id}', false);
select set_config('request.jwt.claims', '{"sub":"${roles.user_id}","role":"authenticated"}', false);
select json_build_object(
  'rr_sources', (select count(*) from public.sources where review_status='review-required'),
  'ap_sources', (select count(*) from public.sources where review_status='approved'),
  'rr_studies', (select count(*) from public.studies where review_status='review-required'),
  'ap_studies', (select count(*) from public.studies where review_status='approved'),
  'rr_claims', (select count(*) from public.claims where status='review-required'),
  'rr_evidence', (select count(*) from public.evidence_assessments where review_status='review-required'),
  'rr_regulatory', (select count(*) from public.regulatory_records where review_status='review-required'),
  'review_actions', (select count(*) from public.review_actions),
  'community', (select count(*) from public.community_reports),
  'runs', (select count(*) from public.research_runs)
);
`,
        );
      } catch (err) {
        authUser = { error: String(err.message).slice(0, 2000) };
      }
      try {
        authAdmin = jsonQuery(
          name,
          `
set row_security = on;
set session authorization authenticated;
select set_config('request.jwt.claim.sub', '${roles.admin_id}', false);
select set_config('request.jwt.claims', '{"sub":"${roles.admin_id}","role":"authenticated"}', false);
select json_build_object(
  'rr_sources', (select count(*) from public.sources where review_status='review-required'),
  'rr_studies', (select count(*) from public.studies where review_status='review-required'),
  'review_actions', (select count(*) from public.review_actions),
  'community', (select count(*) from public.community_reports),
  'runs', (select count(*) from public.research_runs)
);
`,
        );
      } catch (err) {
        authAdmin = { error: String(err.message).slice(0, 2000) };
      }
      anon = jsonQuery(
        name,
        `select json_build_object(
          'select_sources', has_table_privilege('anon', 'public.sources', 'select'),
          'select_studies', has_table_privilege('anon', 'public.studies', 'select'),
          'select_claims', has_table_privilege('anon', 'public.claims', 'select'),
          'select_evidence', has_table_privilege('anon', 'public.evidence_assessments', 'select'),
          'select_review_actions', has_table_privilege('anon', 'public.review_actions', 'select'),
          'select_community', has_table_privilege('anon', 'public.community_reports', 'select'),
          'select_runs', has_table_privilege('anon', 'public.research_runs', 'select')
        );`,
      );
      try {
        dockerExecFile(
          name,
          `
begin;
set row_security = on;
set session authorization authenticated;
select set_config('request.jwt.claim.sub', '${roles.user_id}', false);
select set_config('request.jwt.claims', '{"sub":"${roles.user_id}","role":"authenticated"}', false);
insert into public.review_actions (entity_type, entity_stable_key, action, new_status, reason, admin_user_id)
values ('source', 'rls-probe', 'approve', 'approved', 'should fail', '${roles.user_id}'::uuid);
rollback;
`,
          { stop: 1 },
        );
        nonAdminInsert = "UNEXPECTED_SUCCESS";
      } catch (err) {
        nonAdminInsert = /new row violates row-level security|permission denied|violates row-level security/i.test(String(err.message))
          ? "DENIED"
          : String(err.message).slice(0, 800);
      }

      result.rls.gucRls = {
        method: "SET SESSION AUTHORIZATION authenticated + request.jwt.claim.sub GUC (PostgREST-equivalent claims; not a GoTrue-signed JWT)",
        asPostgres,
        authUser,
        authAdmin,
        anon,
        nonAdminInsert,
      };
      result.rls.jwtSigned = "NOT TESTED";
    }

    try {
      result.approvalPath = jsonQuery(
        name,
        `
begin;
insert into public.review_actions (entity_type, entity_id, entity_stable_key, action, previous_status, new_status, reason, admin_user_id)
select 'source', id, coalesce(pmid, nct_id), 'approve', review_status, 'approved', 'phase-16a local transaction probe', null
from public.sources where review_status='review-required' limit 1;
update public.sources set review_status='approved'
where id = (select entity_id from public.review_actions where reason='phase-16a local transaction probe' limit 1);
select json_build_object(
  'actions_in_tx', (select count(*) from public.review_actions where reason='phase-16a local transaction probe'),
  'src_rr_in_tx', (select count(*) from public.sources where review_status='review-required')
);
rollback;
`,
      );
    } catch (err) {
      result.approvalPath = { error: String(err.message).slice(0, 2000) };
    }
    result.approvalPath.afterRollback = jsonQuery(
      name,
      `select json_build_object(
        'probe_actions', (select count(*) from public.review_actions where reason='phase-16a local transaction probe'),
        'src_rr', (select count(*) from public.sources where review_status='review-required'),
        'review_actions', (select count(*) from public.review_actions)
      );`,
    );

    result.finishedAt = new Date().toISOString();
    writeFileSync(REPORT_JSON, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    console.log("BLOCK4_LOCAL_0031_RUN_COMPLETE");
  } finally {
    try {
      execSync(`docker rm -f ${name}`, { stdio: "ignore" });
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  result.fatal = String(err.stack ?? err);
  writeFileSync(REPORT_JSON, JSON.stringify(result, null, 2));
  console.error(result.fatal);
  process.exit(1);
});
