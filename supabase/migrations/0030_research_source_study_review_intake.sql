-- 0030_research_source_study_review_intake.sql
-- Phase 16: workflow review_status on sources/studies, distinct from
-- sources.status (lifecycle) and studies.status (ClinicalTrials.gov).
-- Existing rows are backfilled approved. New rows default to review-required
-- so an omitted review_status cannot become public.
-- Applied to cartwise-prod in Phase 17 (2026-08-29).
-- Previously MIGRATION_REQUIRED until that apply.
-- Batch 03 data is NOT inserted here. Import is a separate idempotent script.
-- Do not destroy research rows. No shop/auth/cart/order changes.

alter table public.sources
  add column if not exists review_status text;

update public.sources
  set review_status = 'approved'
  where review_status is null;

alter table public.sources
  alter column review_status set default 'review-required';

alter table public.sources
  alter column review_status set not null;

alter table public.sources
  drop constraint if exists sources_review_status_check;

alter table public.sources
  add constraint sources_review_status_check
  check (review_status in ('draft', 'review-required', 'approved', 'rejected'));

alter table public.sources
  add column if not exists connector text;

alter table public.studies
  add column if not exists review_status text;

update public.studies
  set review_status = 'approved'
  where review_status is null;

alter table public.studies
  alter column review_status set default 'review-required';

alter table public.studies
  alter column review_status set not null;

alter table public.studies
  drop constraint if exists studies_review_status_check;

alter table public.studies
  add constraint studies_review_status_check
  check (review_status in ('draft', 'review-required', 'approved', 'rejected'));

alter table public.studies
  add column if not exists intervention text;

alter table public.studies
  add column if not exists condition text;

create index if not exists sources_review_status_idx on public.sources (review_status);
create index if not exists studies_review_status_idx on public.studies (review_status);

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
    'study'
  ));

revoke all on table public.sources from anon;
revoke all on table public.studies from anon;
revoke all on table public.source_substances from anon;
revoke all on table public.study_substances from anon;
revoke all on table public.study_sources from anon;
revoke all on table public.review_actions from anon;

drop policy if exists "sources_select_authenticated" on public.sources;

create policy "sources_select_authenticated"
  on public.sources for select to authenticated
  using (
    auth.uid() is not null and (
      public.has_role(auth.uid(), 'admin')
      or (status = 'active' and review_status = 'approved')
    )
  );

comment on policy "sources_select_authenticated" on public.sources is
  'Admins see all source review states. Other authenticated users only see active approved sources. Lifecycle status is not approval.';

drop policy if exists "studies_select_authenticated" on public.studies;

create policy "studies_select_authenticated"
  on public.studies for select to authenticated
  using (
    auth.uid() is not null and (
      public.has_role(auth.uid(), 'admin')
      or review_status = 'approved'
    )
  );

comment on policy "studies_select_authenticated" on public.studies is
  'Admins see all study review states. Other authenticated users only see approved studies. ClinicalTrials.gov status is not approval.';

drop policy if exists "source_substances_select_authenticated" on public.source_substances;

create policy "source_substances_select_authenticated"
  on public.source_substances for select to authenticated
  using (
    auth.uid() is not null and (
      public.has_role(auth.uid(), 'admin')
      or exists (
        select 1
        from public.sources s
        where s.id = source_id
          and s.status = 'active'
          and s.review_status = 'approved'
      )
    )
  );

drop policy if exists "study_substances_select_authenticated" on public.study_substances;

create policy "study_substances_select_authenticated"
  on public.study_substances for select to authenticated
  using (
    auth.uid() is not null and (
      public.has_role(auth.uid(), 'admin')
      or exists (
        select 1
        from public.studies st
        where st.id = study_id
          and st.review_status = 'approved'
      )
    )
  );

drop policy if exists "study_sources_select_authenticated" on public.study_sources;

create policy "study_sources_select_authenticated"
  on public.study_sources for select to authenticated
  using (
    auth.uid() is not null and (
      public.has_role(auth.uid(), 'admin')
      or (
        exists (
          select 1 from public.studies st
          where st.id = study_id and st.review_status = 'approved'
        )
        and exists (
          select 1 from public.sources s
          where s.id = source_id and s.status = 'active' and s.review_status = 'approved'
        )
      )
    )
  );

comment on column public.sources.review_status is
  'Workflow review status. Distinct from sources.status (lifecycle active/superseded/unavailable/rejected). New rows default to review-required.';

comment on column public.studies.review_status is
  'Workflow review status. Distinct from studies.status (ClinicalTrials.gov overall status). New rows default to review-required.';
