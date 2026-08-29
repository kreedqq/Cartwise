-- 0031_research_operations.sql
-- Block 4: durable research runs, connector health, community architecture.
-- Schema-only. Does not UPDATE/DELETE research science rows.
-- Does not insert sources, studies, claims, evidence, or community reports.
-- Does not touch shop/auth/cart/order tables.
-- Existing 0030 inventory must stay: 27 / 516 / 154 / 294 / 294 / 41 / 19 / 93
-- (plus Batch 03 104/36 already review-required).
-- Apply only after backup + local validation in Block 4.

-- ---------------------------------------------------------------------------
-- research_runs: engine statuses, trigger, scope, statistics
-- ---------------------------------------------------------------------------
alter table public.research_runs
  drop constraint if exists research_runs_status_check;

alter table public.research_runs
  add constraint research_runs_status_check
  check (status in ('queued', 'running', 'completed', 'partial', 'failed', 'cancelled'));

alter table public.research_runs
  add column if not exists trigger_kind text;

alter table public.research_runs
  drop constraint if exists research_runs_trigger_kind_check;

alter table public.research_runs
  add constraint research_runs_trigger_kind_check
  check (
    trigger_kind is null
    or trigger_kind in ('manual', 'scheduled', 'single-substance', 'single-connector', 'full')
  );

alter table public.research_runs
  add column if not exists substance_scope text[] not null default '{}';

alter table public.research_runs
  add column if not exists connector_scope text[] not null default '{}';

alter table public.research_runs
  add column if not exists statistics jsonb;

alter table public.research_runs
  add column if not exists error_summary text;

alter table public.research_runs
  add column if not exists progress jsonb;

alter table public.research_runs
  add column if not exists schedule_kind text;

alter table public.research_runs
  drop constraint if exists research_runs_schedule_kind_check;

alter table public.research_runs
  add constraint research_runs_schedule_kind_check
  check (
    schedule_kind is null
    or schedule_kind in ('manual', 'daily', 'weekly', 'monthly')
  );

alter table public.research_runs
  add column if not exists cancel_requested boolean not null default false;

alter table public.research_runs
  add column if not exists parent_run_id uuid references public.research_runs (id) on delete restrict;

comment on column public.research_runs.trigger_kind is
  'Engine trigger. scheduled must not run until cron is explicitly enabled.';
comment on column public.research_runs.statistics is
  'JSON counts: new/updated/unchanged/duplicate/rejected/review-required/errors. No secrets.';
comment on column public.research_runs.error_summary is
  'Connector error summary without API keys, tokens, or Authorization headers.';
comment on column public.research_runs.schedule_kind is
  'Architecture for daily/weekly/monthly. Cron stays disabled until explicitly enabled.';

create unique index if not exists research_runs_one_active_full
  on public.research_runs ((true))
  where status in ('queued', 'running') and trigger_kind = 'full';

create index if not exists research_runs_status_started_idx
  on public.research_runs (status, started_at desc);

create index if not exists research_runs_parent_run_id_idx
  on public.research_runs (parent_run_id);

-- ---------------------------------------------------------------------------
-- research_run_sources: retrieval log (source_id optional so rejected rows log)
-- ---------------------------------------------------------------------------
alter table public.research_run_sources
  alter column source_id drop not null;

alter table public.research_run_sources
  add column if not exists connector text;

alter table public.research_run_sources
  add column if not exists retrieval_status text;

alter table public.research_run_sources
  drop constraint if exists research_run_sources_retrieval_status_check;

alter table public.research_run_sources
  add constraint research_run_sources_retrieval_status_check
  check (
    retrieval_status is null
    or retrieval_status in ('ok', 'error', 'unavailable', 'excluded')
  );

alter table public.research_run_sources
  add column if not exists result_type text;

alter table public.research_run_sources
  drop constraint if exists research_run_sources_result_type_check;

alter table public.research_run_sources
  add constraint research_run_sources_result_type_check
  check (
    result_type is null
    or result_type in ('NEW', 'UPDATED', 'UNCHANGED', 'DUPLICATE', 'REVIEW_REQUIRED', 'REJECTED')
  );

alter table public.research_run_sources
  add column if not exists identifier text;

alter table public.research_run_sources
  add column if not exists substance_slug text;

alter table public.research_run_sources
  add column if not exists retrieved_at timestamptz;

alter table public.research_run_sources
  add column if not exists error_text text;

alter table public.research_run_sources
  add column if not exists previous_fields jsonb;

alter table public.research_run_sources
  add column if not exists current_fields jsonb;

comment on column public.research_run_sources.error_text is
  'Retrieval error without API keys, tokens, or Authorization headers.';
comment on column public.research_run_sources.previous_fields is
  'Diff before-state for UPDATED (title/date/status). No secrets.';
comment on column public.research_run_sources.current_fields is
  'Diff after-state for UPDATED. No secrets.';

create index if not exists research_run_sources_run_retrieved_idx
  on public.research_run_sources (research_run_id, retrieved_at);

-- ---------------------------------------------------------------------------
-- connector health (no secrets)
-- ---------------------------------------------------------------------------
create table if not exists public.research_connector_health (
  id uuid primary key default gen_random_uuid(),
  connector text not null unique,
  kind text not null check (kind in ('scientific', 'community')),
  availability text not null check (availability in ('available', 'unavailable')),
  last_successful_run_id uuid references public.research_runs (id) on delete restrict,
  last_error text,
  last_checked_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.research_connector_health is
  'Connector availability for admin. last_error must never contain secrets.';

create index if not exists research_connector_health_last_run_idx
  on public.research_connector_health (last_successful_run_id);

alter table public.research_connector_health enable row level security;

drop policy if exists "research_connector_health_select_admin" on public.research_connector_health;
create policy "research_connector_health_select_admin"
  on public.research_connector_health for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "research_connector_health_write_admin" on public.research_connector_health;
create policy "research_connector_health_write_admin"
  on public.research_connector_health for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "research_connector_health_update_admin" on public.research_connector_health;
create policy "research_connector_health_update_admin"
  on public.research_connector_health for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

revoke all on table public.research_connector_health from anon, authenticated;
grant select, insert, update on table public.research_connector_health to authenticated;

-- ---------------------------------------------------------------------------
-- community_reports: separate experience layer. Never scientific evidence.
-- ---------------------------------------------------------------------------
create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  substance_id uuid not null references public.substances (id) on delete restrict,
  kind text not null check (kind in ('reddit', 'forum', 'blog', 'user-report')),
  title text not null check (char_length(trim(title)) >= 1),
  content_summary text,
  source_url text,
  author_identifier text,
  published_at timestamptz,
  retrieved_at timestamptz,
  review_status text not null default 'review-required'
    check (review_status in ('draft', 'review-required', 'approved', 'rejected')),
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.community_reports is
  'Community/experience layer. review-required by default. Cannot raise scientific evidence A–F, claims, or regulatory status. No scraping. No private PII.';
comment on column public.community_reports.author_identifier is
  'Optional public handle only. No emails, private IDs, or secrets.';
comment on column public.community_reports.source_metadata is
  'Public metadata only. Never store API keys or private personal data.';

create index if not exists community_reports_substance_idx
  on public.community_reports (substance_id, review_status);

create index if not exists community_reports_kind_idx
  on public.community_reports (kind, review_status);

drop trigger if exists community_reports_set_updated_at on public.community_reports;
create trigger community_reports_set_updated_at
  before update on public.community_reports
  for each row execute function public.set_updated_at();

alter table public.community_reports enable row level security;

drop policy if exists "community_reports_select_authenticated" on public.community_reports;
create policy "community_reports_select_authenticated"
  on public.community_reports for select to authenticated
  using (
    auth.uid() is not null and (
      public.has_role(auth.uid(), 'admin')
      or review_status = 'approved'
    )
  );

drop policy if exists "community_reports_write_admin" on public.community_reports;
create policy "community_reports_write_admin"
  on public.community_reports for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "community_reports_update_admin" on public.community_reports;
create policy "community_reports_update_admin"
  on public.community_reports for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

revoke all on table public.community_reports from anon, authenticated;
grant select, insert, update on table public.community_reports to authenticated;

-- ---------------------------------------------------------------------------
-- review_actions: community_report entity (append-only remains)
-- ---------------------------------------------------------------------------
alter table public.review_actions
  drop constraint if exists review_actions_entity_type_check;

alter table public.review_actions
  add constraint review_actions_entity_type_check
  check (entity_type in (
    'claim',
    'evidence_assessment',
    'regulatory_record',
    'research_update',
    'substance',
    'source',
    'study',
    'community_report'
  ));

-- Run history is admin operations data, not public science.
drop policy if exists "research_runs_select_authenticated" on public.research_runs;
create policy "research_runs_select_admin"
  on public.research_runs for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "research_run_sources_select_authenticated" on public.research_run_sources;
create policy "research_run_sources_select_admin"
  on public.research_run_sources for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
