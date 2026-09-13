-- 0077: Telegram account linking (not reauth-only username sync).
-- Extends apply_telegram_reauth_username so a fresh custom:telegram identity
-- linked via linkIdentity onto an existing Email/Discord session can consume
-- username_required_on_next_login — without requiring JWT provider=custom:telegram.
--
-- Does not modify 0076. Additive REPLACE of the RPC only.
--
-- Freshness (fail closed against Email/Discord bypass):
-- A) Classic Telegram session: JWT app_metadata.provider = custom:telegram
--    AND identity last_sign_in_at >= JWT iat - 5 minutes
--    AND absolute 30-minute ceiling
-- B) Link-while-signed-in: identity last_sign_in_at >= JWT iat - 5 seconds
--    (Telegram auth happened in/after this session) AND 30-minute ceiling
--
-- Never merges by username/email/name. Never clears the requirement on failure.
-- preferred_username only — never name / given_name / family_name / display_name.

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

  -- Absolute ceiling: reject very old identity timestamps.
  if _telegram_signed_in_at < (now() - interval '30 minutes') then
    raise exception 'Bitte melde dich mit Telegram an, damit dein Telegram Benutzername aktualisiert werden kann.'
      using errcode = '42501';
  end if;

  -- Path A: full Telegram JWT session (0076).
  if _session_provider = 'custom:telegram'
     and _telegram_signed_in_at >= (_session_iat - interval '5 minutes') then
    _fresh_telegram_jwt := true;
  end if;

  -- Path B: linkIdentity while Email/Discord session — identity must be at/after JWT iat
  -- (tight skew). Blocks Email login shortly after an older Telegram sign-in.
  if _telegram_signed_in_at >= (_session_iat - interval '5 seconds') then
    _fresh_linked_identity := true;
  end if;

  if not (_fresh_telegram_jwt or _fresh_linked_identity) then
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
  'Consumes username_required_on_next_login by copying preferred_username from the caller''s fresh custom:telegram identity (JWT Telegram session or linkIdentity onto current user). Never uses display names. Fail closed. Does not create users.';

revoke all on function public.apply_telegram_reauth_username() from public, anon;
grant execute on function public.apply_telegram_reauth_username() to authenticated;

comment on column public.profiles.username_required_on_next_login is
  'Admin-set one-shot Telegram identity linking request. Cleared atomically by apply_telegram_reauth_username / admin_set_username / initial set_username. Client shows gate only after the next successful SIGNED_IN (sessionStorage).';
