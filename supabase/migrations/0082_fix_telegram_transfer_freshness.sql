-- 0082: Fix complete_telegram_identity_transfer freshness for multi-identity owners
-- Root cause (prod): after Telegram OAuth, users with email+discord+telegram often keep
--   auth.users.raw_app_meta_data.provider = 'email'.
-- 0078/0080 required jwt app_metadata.provider = 'custom:telegram' and raised WITHOUT
-- marking the intent failed → intents stuck in pending, identity never moved.
-- Fix: prove fresh Telegram ownership via auth.identities.last_sign_in_at vs JWT iat
-- (same pattern as apply_telegram_reauth_username). Keep target username when set.

create or replace function public.complete_telegram_identity_transfer(_intent_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _source uuid := auth.uid();
  _target uuid;
  _intent public.telegram_transfer_intents%rowtype;
  _identity_id uuid;
  _provider_id text;
  _claim text;
  _clean text;
  _telegram_signed_in_at timestamptz;
  _session_provider text;
  _session_iat timestamptz;
  _iat_raw text;
  _other_identities int;
  _target_required boolean;
  _target_has_telegram boolean;
  _target_username text;
  _fresh_telegram_jwt boolean := false;
  _fresh_telegram_identity boolean := false;
begin
  if _source is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if _intent_id is null then
    raise exception 'intent_id fehlt.' using errcode = '22023';
  end if;

  select *
  into _intent
  from public.telegram_transfer_intents
  where id = _intent_id
  for update;

  if not found then
    raise exception 'Transfer Intent wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _intent.status is distinct from 'pending' then
    raise exception 'Transfer Intent ist nicht mehr gültig.' using errcode = 'P0001';
  end if;

  if _intent.expires_at < now() then
    update public.telegram_transfer_intents
    set status = 'failed', failure_reason = 'expired'
    where id = _intent_id;
    raise exception 'Transfer Intent ist abgelaufen.' using errcode = 'P0001';
  end if;

  _target := _intent.target_user_id;

  if _target = _source then
    update public.telegram_transfer_intents
    set status = 'failed', failure_reason = 'same_user'
    where id = _intent_id;
    raise exception 'Telegram Identity gehört bereits zu diesem PEPTIX Konto.' using errcode = 'P0001';
  end if;

  _session_provider := coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '');

  _iat_raw := nullif(auth.jwt() ->> 'iat', '');
  if _iat_raw is null or _iat_raw !~ '^[0-9]+([.][0-9]+)?$' then
    update public.telegram_transfer_intents
    set status = 'failed', failure_reason = 'missing_jwt_iat'
    where id = _intent_id;
    raise exception 'Bitte melde dich mit Telegram an, um die Verknüpfung zu übertragen.'
      using errcode = '42501';
  end if;
  _session_iat := to_timestamp(_iat_raw::double precision);

  -- Identity owner = auth.uid() after fresh Telegram OIDC (signInWithOAuth transfer).
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
    update public.telegram_transfer_intents
    set status = 'failed', failure_reason = 'no_telegram_identity_on_source'
    where id = _intent_id;
    raise exception 'Keine Telegram Identity für diesen Account gefunden.' using errcode = 'P0002';
  end if;

  if _telegram_signed_in_at < (now() - interval '30 minutes') then
    update public.telegram_transfer_intents
    set status = 'failed', failure_reason = 'stale_telegram_identity'
    where id = _intent_id;
    raise exception 'Bitte melde dich mit Telegram an, um die Verknüpfung zu übertragen.'
      using errcode = '42501';
  end if;

  -- Multi-identity users often keep app_metadata.provider = 'email' after Telegram OAuth.
  -- Accept either a Telegram-primary JWT or a freshly signed-in custom:telegram identity.
  if _session_provider = 'custom:telegram'
     and _telegram_signed_in_at >= (_session_iat - interval '5 minutes') then
    _fresh_telegram_jwt := true;
  end if;

  if _telegram_signed_in_at >= (_session_iat - interval '5 minutes') then
    _fresh_telegram_identity := true;
  end if;

  if not (_fresh_telegram_jwt or _fresh_telegram_identity) then
    update public.telegram_transfer_intents
    set status = 'failed', failure_reason = 'stale_telegram_session'
    where id = _intent_id;
    raise exception 'Bitte melde dich mit Telegram an, um die Verknüpfung zu übertragen.'
      using errcode = '42501';
  end if;

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

  select username_required_on_next_login, nullif(btrim(username), '')
  into _target_required, _target_username
  from public.profiles
  where id = _target
  for update;

  if not found then
    update public.telegram_transfer_intents
    set status = 'failed', failure_reason = 'target_profile_missing'
    where id = _intent_id;
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

  -- Move identity first (same row / provider_id). Transaction rolls back on later raise.
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

  -- Keep existing target username. Adopt preferred only when target has none.
  if _target_username is null then
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

    update public.profiles
    set username = _clean,
        username_required_on_next_login = false,
        updated_at = now()
    where id = _target;

    perform public.sync_cart_titles_for_user(_target);
  else
    _clean := _target_username;
    update public.profiles
    set username_required_on_next_login = false,
        updated_at = now()
    where id = _target;
  end if;

  update public.telegram_transfer_intents
  set status = 'completed',
      completed_at = now()
  where id = _intent_id;

  perform public.log_audit(
    _source,
    'telegram.identity_transfer',
    'auth_identity',
    _identity_id,
    jsonb_build_object(
      'from_user_id', _source,
      'provider', 'custom:telegram',
      'session_provider', _session_provider,
      'fresh_telegram_jwt', _fresh_telegram_jwt,
      'fresh_telegram_identity', _fresh_telegram_identity
    ),
    jsonb_build_object(
      'to_user_id', _target,
      'provider', 'custom:telegram',
      'provider_id', _provider_id
    )
  );

  return _clean;
end;
$$;

comment on function public.complete_telegram_identity_transfer(uuid) is
  'Moves custom:telegram from source (caller / identity owner) to intent target. Freshness via identity last_sign_in vs JWT iat — does not require app_metadata.provider=custom:telegram. Keeps target username when set. Blocks telegram-only sources.';

revoke all on function public.complete_telegram_identity_transfer(uuid) from public, anon;
grant execute on function public.complete_telegram_identity_transfer(uuid) to authenticated;
