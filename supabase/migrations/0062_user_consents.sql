-- 0062_user_consents.sql
-- Versioned research-terms consent. Users write only their own rows.

create table if not exists public.user_consents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  consent_type    text not null,
  consent_version integer not null,
  accepted_at     timestamptz not null default now(),
  constraint user_consents_type_check check (consent_type = 'research_terms'),
  constraint user_consents_version_check check (consent_version > 0),
  constraint user_consents_unique unique (user_id, consent_type, consent_version)
);

comment on table public.user_consents is
  'Versioned user consents. Current required research_terms version is 1.';

create index if not exists user_consents_user_id_idx on public.user_consents (user_id);

alter table public.user_consents enable row level security;

drop policy if exists user_consents_select_own on public.user_consents;
create policy user_consents_select_own
  on public.user_consents for select
  to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists user_consents_insert_own on public.user_consents;
create policy user_consents_insert_own
  on public.user_consents for insert
  to authenticated
  with check (user_id = auth.uid());

-- No UPDATE/DELETE policies: consents are append-only.

create or replace function public.required_research_consent_version()
returns integer
language sql
immutable
as $$
  select 1;
$$;

revoke all on function public.required_research_consent_version() from public;
grant execute on function public.required_research_consent_version() to anon, authenticated;

create or replace function public.has_current_research_consent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_consents c
    where c.user_id = auth.uid()
      and c.consent_type = 'research_terms'
      and c.consent_version = public.required_research_consent_version()
  );
$$;

revoke all on function public.has_current_research_consent() from public, anon;
grant execute on function public.has_current_research_consent() to authenticated;

create or replace function public.accept_research_consent()
returns public.user_consents
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _ver integer := public.required_research_consent_version();
  _row public.user_consents;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  insert into public.user_consents (user_id, consent_type, consent_version)
  values (_uid, 'research_terms', _ver)
  on conflict (user_id, consent_type, consent_version) do update
    set accepted_at = public.user_consents.accepted_at
  returning * into _row;

  return _row;
end;
$$;

revoke all on function public.accept_research_consent() from public, anon;
grant execute on function public.accept_research_consent() to authenticated;
