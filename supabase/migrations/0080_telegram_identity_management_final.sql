-- 0080: Telegram identity management finalization
-- 1) apply_telegram_reauth_username: keep existing profiles.username; only adopt preferred when unset
-- 2) complete_telegram_identity_transfer: keep target username when already set
-- 3) admin_remove_telegram_identity: admin can detach custom:telegram if not sole login
-- Does not modify 0070/0078 files; additive REPLACE of functions only.

-- ---------------------------------------------------------------------------
-- 1. apply_telegram_reauth_username
-- ---------------------------------------------------------------------------
create or replace function public.apply_telegram_reauth_username()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _clean text;
  _current text;
  _required boolean;
  _claim text;
  _telegram_signed_in_at timestamptz;
  _session_provider text;
  _session_iat timestamptz;
  _iat_raw text;
  _fresh_telegram_jwt boolean := false;
  _fresh_linked_identity boolean := false;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select nullif(btrim(username), ''), username_required_on_next_login
  into _current, _required
  from public.profiles
  where id = _uid
  for update;

  if not found then
    raise exception 'Profil wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if not coalesce(_required, false) then
    raise exception 'Keine Telegram Anmeldung angefordert.' using errcode = '42501';
  end if;

  _session_provider := coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '');

  _iat_raw := nullif(auth.jwt() ->> 'iat', '');
  if _iat_raw is null or _iat_raw !~ '^[0-9]+([.][0-9]+)?$' then
    raise exception 'Bitte melde dich mit Telegram an, damit dein Telegram Benutzername aktualisiert werden kann.'
      using errcode = '42501';
  end if;
  _session_iat := to_timestamp(_iat_raw::double precision);

  select
    nullif(btrim(identity_data->>'preferred_username'), ''),
    coalesce(last_sign_in_at, updated_at)
  into _claim, _telegram_signed_in_at
  from auth.identities
  where user_id = _uid
    and provider = 'custom:telegram'
  order by coalesce(last_sign_in_at, updated_at) desc nulls last
  limit 1;

  if _telegram_signed_in_at is null then
    raise exception 'Bitte melde dich mit Telegram an, damit dein Telegram Benutzername aktualisiert werden kann.'
      using errcode = '42501';
  end if;

  if _telegram_signed_in_at < (now() - interval '30 minutes') then
    raise exception 'Bitte melde dich mit Telegram an, damit dein Telegram Benutzername aktualisiert werden kann.'
      using errcode = '42501';
  end if;

  if _session_provider = 'custom:telegram'
     and _telegram_signed_in_at >= (_session_iat - interval '5 minutes') then
    _fresh_telegram_jwt := true;
  end if;

  if _telegram_signed_in_at >= (_session_iat - interval '5 seconds') then
    _fresh_linked_identity := true;
  end if;

  if not (_fresh_telegram_jwt or _fresh_linked_identity) then
    raise exception 'Bitte melde dich mit Telegram an, damit dein Telegram Benutzername aktualisiert werden kann.'
      using errcode = '42501';
  end if;

  -- Existing PEPTIX username wins. Linking must not overwrite it with preferred_username.
  if _current is not null then
    update public.profiles
    set username_required_on_next_login = false,
        updated_at = now()
    where id = _uid;
    return _current;
  end if;

  -- Initial claim only: adopt preferred_username.
  if _claim is null or btrim(_claim) = '' then
    raise exception 'Kein verifizierter Telegram Benutzername verfügbar. Bitte verwende ein Telegram-Konto mit Benutzername.'
      using errcode = 'P0001';
  end if;

  _clean := regexp_replace(btrim(_claim), '^@+', '');

  if _clean !~ '^[A-Za-z][A-Za-z0-9_.]{2,23}$' then
    raise exception 'Ungültiger Telegram Benutzername von Telegram empfangen.'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.profiles
    where lower(username) = lower(_clean) and id <> _uid
  ) then
    raise exception 'Dieser Telegram Benutzername wird bereits verwendet.' using errcode = 'P0001';
  end if;

  update public.profiles
  set
    username = _clean,
    username_required_on_next_login = false,
    updated_at = now()
  where id = _uid;

  perform public.sync_cart_titles_for_user(_uid);
  return _clean;
end;
$$;

comment on function public.apply_telegram_reauth_username() is
  'After fresh custom:telegram link: consume username_required_on_next_login. Keeps existing profiles.username; adopts preferred_username only when username is unset.';

revoke all on function public.apply_telegram_reauth_username() from public, anon;
grant execute on function public.apply_telegram_reauth_username() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. complete_telegram_identity_transfer — keep target username when set
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

  -- Move identity first (ownership proof already checked).
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
    jsonb_build_object('from_user_id', _source, 'provider', 'custom:telegram'),
    jsonb_build_object('to_user_id', _target, 'provider', 'custom:telegram', 'provider_id', _provider_id)
  );

  return _clean;
end;
$$;

comment on function public.complete_telegram_identity_transfer(uuid) is
  'Moves custom:telegram from source (caller) to target intent user. Keeps target profiles.username when set; adopts preferred_username only when unset. Blocks telegram-only sources.';

revoke all on function public.complete_telegram_identity_transfer(uuid) from public, anon;
grant execute on function public.complete_telegram_identity_transfer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. admin_remove_telegram_identity
-- ---------------------------------------------------------------------------
create or replace function public.admin_remove_telegram_identity(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _other int;
  _telegram_count int;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen diese Aktion ausführen.' using errcode = '42501';
  end if;
  if _user_id is null then
    raise exception 'user_id fehlt.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = _user_id) then
    raise exception 'Benutzer wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  select count(*)::int into _telegram_count
  from auth.identities
  where user_id = _user_id and provider = 'custom:telegram';

  if coalesce(_telegram_count, 0) < 1 then
    raise exception 'Dieses Konto hat keine Telegram Verknüpfung.' using errcode = 'P0002';
  end if;

  select count(*)::int into _other
  from auth.identities
  where user_id = _user_id
    and provider is distinct from 'custom:telegram';

  if coalesce(_other, 0) < 1 then
    raise exception 'Die Telegram Zuordnung kann nicht entfernt werden, solange sie die einzige Anmeldemethode dieses Kontos ist.'
      using errcode = '42501';
  end if;

  delete from auth.identities
  where user_id = _user_id
    and provider = 'custom:telegram';

  -- Do not clear profiles.username — PEPTIX handle stays.
  update public.profiles
  set username_required_on_next_login = false,
      updated_at = now()
  where id = _user_id
    and username_required_on_next_login = true;

  perform public.log_audit(
    auth.uid(),
    'user.telegram_identity.remove',
    'profile',
    _user_id,
    jsonb_build_object('provider', 'custom:telegram'),
    null
  );
end;
$$;

comment on function public.admin_remove_telegram_identity(uuid) is
  'Admin-only: delete custom:telegram identity when the user has another login method. Never locks out telegram-only accounts. Does not delete profiles.username.';

revoke all on function public.admin_remove_telegram_identity(uuid) from public, anon;
grant execute on function public.admin_remove_telegram_identity(uuid) to authenticated;
