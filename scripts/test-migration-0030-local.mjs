/**
 * Local schema check for 0030 against an ephemeral Postgres.
 * Does not touch production. Requires Docker.
 */
import { execSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const MIGRATION = resolve(process.cwd(), "supabase/migrations/0030_research_source_study_review_intake.sql");

const STUB = `
create schema if not exists auth;
do $$ begin
  create role authenticated;
exception when duplicate_object then null;
end $$;
do $$ begin
  create role anon;
exception when duplicate_object then null;
end $$;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
create schema if not exists public;
create or replace function public.has_role(uid uuid, role_name text)
returns boolean language sql as $$ select false $$;
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  title text not null,
  publisher text,
  publication_date text,
  access_date text,
  url text not null,
  doi text,
  pmid text,
  nct_id text,
  status text not null default 'active',
  legacy_ids text[] not null default '{}'
);
create unique index sources_pmid_key on public.sources (pmid) where pmid is not null;
create unique index sources_nct_id_key on public.sources (nct_id) where nct_id is not null;
create table public.studies (
  id uuid primary key default gen_random_uuid(),
  nct_id text not null,
  title text not null,
  sponsor text,
  phase text,
  status text,
  source_url text not null
);
create unique index studies_nct_id_key on public.studies (nct_id);
create table public.source_substances (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id),
  substance_id uuid not null,
  legacy_source_id text not null,
  constraint source_substances_pair unique (source_id, substance_id)
);
create table public.study_substances (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id),
  substance_id uuid not null,
  constraint study_substances_pair unique (study_id, substance_id)
);
create table public.study_sources (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id),
  source_id uuid not null references public.sources(id),
  constraint study_sources_pair unique (study_id, source_id)
);
create table public.review_actions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in (
    'claim', 'evidence_assessment', 'regulatory_record', 'research_update', 'substance'
  )),
  entity_id uuid,
  entity_stable_key text,
  action text not null,
  previous_status text,
  new_status text,
  reason text,
  admin_user_id uuid,
  created_at timestamptz not null default now()
);
alter table public.sources enable row level security;
alter table public.studies enable row level security;
alter table public.source_substances enable row level security;
alter table public.study_substances enable row level security;
alter table public.study_sources enable row level security;
alter table public.review_actions enable row level security;
create policy "sources_select_authenticated" on public.sources for select to public using (true);
create policy "studies_select_authenticated" on public.studies for select to public using (true);
create policy "source_substances_select_authenticated" on public.source_substances for select to public using (true);
create policy "study_substances_select_authenticated" on public.study_substances for select to public using (true);
create policy "study_sources_select_authenticated" on public.study_sources for select to public using (true);
insert into public.sources (source_type, title, url, pmid, status)
  values ('pubmed', 'existing', 'https://example.test', '111', 'active');
insert into public.studies (nct_id, title, source_url, status)
  values ('NCT00000001', 'existing study', 'https://example.test', 'COMPLETED');
`;

const VERIFY = `
select column_name from information_schema.columns
  where table_schema='public' and table_name='sources' and column_name in ('review_status','connector')
  order by 1;
select column_name from information_schema.columns
  where table_schema='public' and table_name='studies' and column_name in ('review_status','intervention','condition')
  order by 1;
select review_status from public.sources;
select review_status from public.studies;
select column_default from information_schema.columns
  where table_schema='public' and table_name='sources' and column_name='review_status';
select conname from pg_constraint where conrelid='public.review_actions'::regclass and conname='review_actions_entity_type_check';
select indexname from pg_indexes where tablename in ('sources','studies') and indexname like '%review_status%' order by 1;
select polname from pg_policy where polrelid='public.sources'::regclass;
`;

function main() {
  execSync("docker info", { stdio: "ignore" });
  const name = `peptix-0030-${Date.now()}`;
  execSync(`docker run -d --rm --name ${name} -e POSTGRES_PASSWORD=postgres postgres:16`, { stdio: "inherit" });
  try {
    execSync(`docker exec ${name} bash -lc "until pg_isready -U postgres; do sleep 1; done"`, {
      stdio: "inherit",
      timeout: 60_000,
    });
    const sqlPath = join(tmpdir(), "peptix-0030-local.sql");
    writeFileSync(sqlPath, `${STUB}\n${readFileSync(MIGRATION, "utf8")}\n${VERIFY}\n`);
    execSync(`docker cp "${sqlPath}" ${name}:/tmp/0030.sql`);
    const output = execSync(`docker exec ${name} psql -U postgres -v ON_ERROR_STOP=1 -f /tmp/0030.sql`, {
      encoding: "utf8",
    });
    console.log(output);
    if (!output.includes("review_status") || !output.includes("review-required")) {
      throw new Error("0030 local schema verification failed");
    }
    if (!output.includes("approved")) {
      throw new Error("existing rows were not backfilled to approved");
    }
    console.log("LOCAL_0030_SCHEMA_PASS");
  } finally {
    execSync(`docker rm -f ${name}`, { stdio: "ignore" });
  }
}

main();
