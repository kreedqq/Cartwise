-- 0076: Telegram reauth replaces free-text next-login username change.
-- Reuses profiles.username_required_on_next_login (admin flag only).
-- Self-service set_username: initial claim only (no username yet).
-- One-shot admin reauth: apply_telegram_reauth_username reads preferred_username
-- from the caller's linked custom:telegram identity after a fresh Telegram sign-in.
-- Never uses name / given_name / family_name / display_name.
--
-- Freshness (Email/Discord bypass prevention):
-- 1) JWT app_metadata.provider must be custom:telegram (current session provider).
-- 2) Telegram identity last_sign_in_at must be >= JWT iat - 5 minutes
--    (blocks a stale linked Telegram identity after Email/Discord login).
-- 3) Absolute 30-minute ceiling as defense in depth.

-- ---------------------------------------------------------------------------
-- 1. set_username — initial claim only (locked once set; no free-text reauth)
-- ---------------------------------------------------------------------------

create or replace function public.set_username(_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _clean text;
  _current text;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select nullif(btrim(username), '')
  into _current
  from public.profiles
  where id = _uid
  for update;

  if not found then
    raise exception 'Profil wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  -- Locked once set. Admin-requested updates go through apply_telegram_reauth_username.
  if _current is not null then
    raise exception 'Dein Telegram Benutzername ist gesperrt und kann nicht selbst geändert werden.'
      using errcode = '42501';
  end if;

  _clean := trim(both from coalesce(_username, ''));
  _clean := regexp_replace(_clean, '^@+', '');

  if _clean !~ '^[A-Za-z][A-Za-z0-9_.]{2,23}$' then
    raise exception 'Ungültiger Telegram Benutzername. Erlaubt: 3-24 Zeichen, beginnend mit einem Buchstaben, danach Buchstaben, Zahlen, "_" oder ".".'
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

comment on function public.set_username(text) is
  'Self-service Telegram handle: initial claim only. Locked after set. Admin reauth uses apply_telegram_reauth_username.';

revoke all on function public.set_username(text) from public, anon;
grant execute on function public.set_username(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. apply_telegram_reauth_username — OIDC preferred_username only
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

  -- Current session must be Telegram OIDC — not Email/Discord with a linked Telegram identity.
  _session_provider := coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '');
  if _session_provider is distinct from 'custom:telegram' then
    raise exception 'Bitte melde dich mit Telegram an, damit dein Telegram Benutzername aktualisiert werden kann.'
      using errcode = '42501';
  end if;

  _iat_raw := nullif(auth.jwt() ->> 'iat', '');
  if _iat_raw is null or _iat_raw !~ '^[0-9]+([.][0-9]+)?$' then
    raise exception 'Bitte melde dich mit Telegram an, damit dein Telegram Benutzername aktualisiert werden kann.'
      using errcode = '42501';
  end if;
  _session_iat := to_timestamp(_iat_raw::double precision);

  -- Identity must belong to this auth user (no username/email/name matching).
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

  -- Telegram identity sign-in must belong to this JWT session (not an older linked login).
  if _telegram_signed_in_at < (_session_iat - interval '5 minutes') then
    raise exception 'Bitte melde dich mit Telegram an, damit dein Telegram Benutzername aktualisiert werden kann.'
      using errcode = '42501';
  end if;

  -- Absolute ceiling: reject very old identity timestamps even if clock/JWT skew is odd.
  if _telegram_signed_in_at < (now() - interval '30 minutes') then
    raise exception 'Bitte melde dich mit Telegram an, damit dein Telegram Benutzername aktualisiert werden kann.'
      using errcode = '42501';
  end if;

  -- Fail closed: never fall back to name / given_name / family_name / display_name.
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
  'Consumes username_required_on_next_login by copying preferred_username from the caller''s fresh custom:telegram identity. Requires JWT provider custom:telegram and identity last_sign_in_at aligned with JWT iat. Never uses display names. Fail closed.';

revoke all on function public.apply_telegram_reauth_username() from public, anon;
grant execute on function public.apply_telegram_reauth_username() to authenticated;

comment on column public.profiles.username_required_on_next_login is
  'Admin-set one-shot Telegram reauthentication request. Cleared atomically by apply_telegram_reauth_username / admin_set_username / initial set_username. Client shows gate only after the next successful SIGNED_IN (sessionStorage).';
