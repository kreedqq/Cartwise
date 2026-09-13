-- 0078: Controlled Telegram identity transfer between existing PEPTIX users.
-- Does not merge accounts. Does not delete Telegram. Moves only custom:telegram.
-- Source user must keep at least one other login identity (no lock-out).
-- Target must have username_required_on_next_login and confirm via intent.
-- Completing user must be the Telegram identity owner after a fresh Telegram OIDC login.
-- preferred_username only — never name / given_name / family_name / display_name.

create table if not exists public.telegram_transfer_intents (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'cancelled', 'failed')),
  failure_reason text
);

create index if not exists telegram_transfer_intents_target_pending_idx
  on public.telegram_transfer_intents (target_user_id, status)
  where status = 'pending';

alter table public.telegram_transfer_intents enable row level security;

-- No direct client table access; only SECURITY DEFINER RPCs.
revoke all on table public.telegram_transfer_intents from public, anon, authenticated;

comment on table public.telegram_transfer_intents is
  'One-shot confirmed intent to move custom:telegram from its current owner onto target_user_id after fresh Telegram OIDC.';

-- ---------------------------------------------------------------------------
-- create_telegram_transfer_intent — target user confirms reassignment UI
-- ---------------------------------------------------------------------------

create or replace function public.create_telegram_transfer_intent()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _required boolean;
  _intent_id uuid;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select username_required_on_next_login
  into _required
  from public.profiles
  where id = _uid
  for update;

  if not found then
    raise exception 'Profil wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if not coalesce(_required, false) then
    raise exception 'Keine Telegram Anmeldung angefordert.' using errcode = '42501';
  end if;

  if exists (
    select 1 from auth.identities
    where user_id = _uid and provider = 'custom:telegram'
  ) then
    raise exception 'Dieses PEPTIX Konto ist bereits mit Telegram verknüpft.' using errcode = 'P0001';
  end if;

  -- Cancel any previous pending intents for this target.
  update public.telegram_transfer_intents
  set status = 'cancelled',
      cancelled_at = now()
  where target_user_id = _uid
    and status = 'pending';

  insert into public.telegram_transfer_intents (target_user_id, expires_at, confirmed_at, status)
  values (_uid, now() + interval '30 minutes', now(), 'pending')
  returning id into _intent_id;

  return _intent_id;
end;
$$;

comment on function public.create_telegram_transfer_intent() is
  'Creates a confirmed transfer intent for the current user (target). Does not move identities.';

revoke all on function public.create_telegram_transfer_intent() from public, anon;
grant execute on function public.create_telegram_transfer_intent() to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_telegram_transfer_intent
-- ---------------------------------------------------------------------------

create or replace function public.cancel_telegram_transfer_intent(_intent_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  update public.telegram_transfer_intents
  set status = 'cancelled',
      cancelled_at = now()
  where id = _intent_id
    and target_user_id = _uid
    and status = 'pending';
end;
$$;

revoke all on function public.cancel_telegram_transfer_intent(uuid) from public, anon;
grant execute on function public.cancel_telegram_transfer_intent(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- complete_telegram_identity_transfer — called by Telegram identity owner (A)
-- ---------------------------------------------------------------------------

create or replace function public.complete_telegram_identity_transfer(_intent_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _source uuid := auth.uid();
  _target uuid;
  _intent_status text;
  _expires_at timestamptz;
  _identity_id uuid;
  _provider_id text;
  _claim text;
  _telegram_signed_in_at timestamptz;
  _session_provider text;
  _session_iat timestamptz;
  _iat_raw text;
  _other_identities int;
  _target_required boolean;
  _clean text;
  _target_has_telegram boolean;
begin
  if _source is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if _intent_id is null then
    raise exception 'Ungültige Transfer-Anforderung.' using errcode = '22023';
  end if;

  select target_user_id, status, expires_at
  into _target, _intent_status, _expires_at
  from public.telegram_transfer_intents
  where id = _intent_id
  for update;

  if not found then
    raise exception 'Transfer-Anforderung wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _intent_status is distinct from 'pending' then
    raise exception 'Transfer-Anforderung ist nicht mehr gültig.' using errcode = '42501';
  end if;

  if _expires_at < now() then
    update public.telegram_transfer_intents
    set status = 'failed', failure_reason = 'expired'
    where id = _intent_id;
    raise exception 'Transfer-Anforderung ist abgelaufen.' using errcode = '42501';
  end if;

  if _target = _source then
    update public.telegram_transfer_intents
    set status = 'failed', failure_reason = 'same_user'
    where id = _intent_id;
    raise exception 'Telegram Identity gehört bereits zu diesem PEPTIX Konto.' using errcode = 'P0001';
  end if;

  -- Fresh Telegram OIDC session required (identity owner proof).
  _session_provider := coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '');
  if _session_provider is distinct from 'custom:telegram' then
    raise exception 'Bitte melde dich mit Telegram an, um die Verknüpfung zu übertragen.'
      using errcode = '42501';
  end if;

  _iat_raw := nullif(auth.jwt() ->> 'iat', '');
  if _iat_raw is null or _iat_raw !~ '^[0-9]+([.][0-9]+)?$' then
    raise exception 'Bitte melde dich mit Telegram an, um die Verknüpfung zu übertragen.'
      using errcode = '42501';
  end if;
  _session_iat := to_timestamp(_iat_raw::double precision);

  select id, provider_id,
         nullif(btrim(identity_data->>'preferred_username'), ''),
         coalesce(last_sign_in_at, updated_at)
  into _identity_id, _provider_id, _claim, _telegram_signed_in_at
  from auth.identities
  where user_id = _source
    and provider = 'custom:telegram'
  order by coalesce(last_sign_in_at, updated_at) desc nulls last
  limit 1
  for update;

  if _identity_id is null then
    raise exception 'Keine Telegram Identity für diesen Account gefunden.' using errcode = 'P0002';
  end if;

  if _telegram_signed_in_at < (_session_iat - interval '5 minutes')
     or _telegram_signed_in_at < (now() - interval '30 minutes') then
    raise exception 'Bitte melde dich mit Telegram an, um die Verknüpfung zu übertragen.'
      using errcode = '42501';
  end if;

  -- Never lock out a Telegram-only account.
  select count(*)::int
  into _other_identities
  from auth.identities
  where user_id = _source
    and provider is distinct from 'custom:telegram';

  if coalesce(_other_identities, 0) < 1 then
    update public.telegram_transfer_intents
    set status = 'failed', failure_reason = 'source_telegram_only'
    where id = _intent_id;
    raise exception 'Dieses Telegram Konto ist die einzige Anmeldung des bisherigen PEPTIX Kontos und kann nicht übertragen werden.'
      using errcode = '42501';
  end if;

  select username_required_on_next_login
  into _target_required
  from public.profiles
  where id = _target
  for update;

  if not found then
    raise exception 'Zielprofil wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if not coalesce(_target_required, false) then
    update public.telegram_transfer_intents
    set status = 'failed', failure_reason = 'target_flag_cleared'
    where id = _intent_id;
    raise exception 'Keine Telegram Anmeldung angefordert.' using errcode = '42501';
  end if;

  select exists (
    select 1 from auth.identities
    where user_id = _target and provider = 'custom:telegram'
  ) into _target_has_telegram;

  if _target_has_telegram then
    update public.telegram_transfer_intents
    set status = 'failed', failure_reason = 'target_already_has_telegram'
    where id = _intent_id;
    raise exception 'Das Zielkonto ist bereits mit Telegram verknüpft.' using errcode = 'P0001';
  end if;

  if _claim is null or btrim(_claim) = '' then
    update public.telegram_transfer_intents
    set status = 'failed', failure_reason = 'missing_preferred_username'
    where id = _intent_id;
    raise exception 'Kein verifizierter Telegram Benutzername verfügbar. Bitte verwende ein Telegram-Konto mit Benutzername.'
      using errcode = 'P0001';
  end if;

  _clean := regexp_replace(btrim(_claim), '^@+', '');

  if _clean !~ '^[A-Za-z][A-Za-z0-9_.]{2,23}$' then
    update public.telegram_transfer_intents
    set status = 'failed', failure_reason = 'invalid_preferred_username'
    where id = _intent_id;
    raise exception 'Ungültiger Telegram Benutzername von Telegram empfangen.'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.profiles
    where lower(username) = lower(_clean) and id <> _target
  ) then
    update public.telegram_transfer_intents
    set status = 'failed', failure_reason = 'duplicate_username'
    where id = _intent_id;
    raise exception 'Dieser Telegram Benutzername wird bereits verwendet.' using errcode = 'P0001';
  end if;

  -- Move identity only after all checks pass (no orphan window on failure above).
  update auth.identities
  set user_id = _target,
      last_sign_in_at = now(),
      updated_at = now()
  where id = _identity_id
    and user_id = _source
    and provider = 'custom:telegram';

  if not found then
    update public.telegram_transfer_intents
    set status = 'failed', failure_reason = 'identity_move_failed'
    where id = _intent_id;
    raise exception 'Telegram Identity konnte nicht übertragen werden.' using errcode = 'P0001';
  end if;

  -- Ensure uniqueness: identity must not remain on source.
  if exists (
    select 1 from auth.identities
    where user_id = _source and provider = 'custom:telegram'
  ) then
    raise exception 'Telegram Identity Transfer inkonsistent.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from auth.identities
    where user_id = _target and provider = 'custom:telegram' and id = _identity_id
  ) then
    raise exception 'Telegram Identity Transfer inkonsistent.' using errcode = 'P0001';
  end if;

  update public.profiles
  set username = _clean,
      username_required_on_next_login = false,
      updated_at = now()
  where id = _target;

  perform public.sync_cart_titles_for_user(_target);

  update public.telegram_transfer_intents
  set status = 'completed',
      completed_at = now()
  where id = _intent_id;

  perform public.log_audit(
    _source,
    'telegram.identity_transfer',
    'auth_identity',
    _identity_id,
    jsonb_build_object('from_user_id', _source, 'provider', 'custom:telegram'),
    jsonb_build_object('to_user_id', _target, 'provider', 'custom:telegram', 'provider_id', _provider_id)
  );

  return _clean;
end;
$$;

comment on function public.complete_telegram_identity_transfer(uuid) is
  'Moves caller''s fresh custom:telegram identity onto the intent target user. Blocks Telegram-only sources. Fail closed. No account merge.';

revoke all on function public.complete_telegram_identity_transfer(uuid) from public, anon;
grant execute on function public.complete_telegram_identity_transfer(uuid) to authenticated;
