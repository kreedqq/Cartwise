-- 0075: Telegram username lock + admin direct edit
-- Reuses profiles.username and profiles.username_required_on_next_login.
-- Self-service set_username: initial claim OR one-shot change when admin flag is set.
-- Direct client UPDATE of username is blocked. Admin may set username via RPC.

-- ---------------------------------------------------------------------------
-- 1. Block client-side username column mutation
-- ---------------------------------------------------------------------------

create or replace function public.protect_profile_username()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.username is distinct from new.username
     and current_user = 'authenticated' then
    raise exception 'Der Telegram Benutzername kann nicht clientseitig geändert werden.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_username on public.profiles;
create trigger profiles_protect_username
  before update on public.profiles
  for each row
  execute function public.protect_profile_username();

revoke all on function public.protect_profile_username() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. set_username — lock after initial claim unless admin change request
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
  _required boolean;
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

  -- Locked once set, unless admin requested a one-shot change.
  if _current is not null and not coalesce(_required, false) then
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
  'Self-service Telegram handle: initial claim, or one-shot change when username_required_on_next_login. Atomically clears the flag and rewrites cart titles.';

revoke all on function public.set_username(text) from public, anon;
grant execute on function public.set_username(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. admin_set_username — direct edit, clears change request
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_username(_user_id uuid, _username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _clean text;
  _old text;
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

  select nullif(btrim(username), '') into _old
  from public.profiles
  where id = _user_id
  for update;

  if not found then
    raise exception 'Benutzer wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  _clean := trim(both from coalesce(_username, ''));
  _clean := regexp_replace(_clean, '^@+', '');

  if _clean !~ '^[A-Za-z][A-Za-z0-9_.]{2,23}$' then
    raise exception 'Ungültiger Telegram Benutzername. Erlaubt: 3-24 Zeichen, beginnend mit einem Buchstaben, danach Buchstaben, Zahlen, "_" oder ".".'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.profiles
    where lower(username) = lower(_clean) and id <> _user_id
  ) then
    raise exception 'Dieser Telegram Benutzername wird bereits verwendet.' using errcode = 'P0001';
  end if;

  update public.profiles
  set
    username = _clean,
    username_required_on_next_login = false,
    updated_at = now()
  where id = _user_id;

  perform public.sync_cart_titles_for_user(_user_id);

  perform public.log_audit(
    auth.uid(),
    'user.username.admin_set',
    'profile',
    _user_id,
    jsonb_build_object('username', _old),
    jsonb_build_object('username', _clean)
  );

  return _clean;
end;
$$;

comment on function public.admin_set_username(uuid, text) is
  'Admin-only: set profiles.username directly, clear change request, rewrite cart titles.';

revoke all on function public.admin_set_username(uuid, text) from public, anon;
grant execute on function public.admin_set_username(uuid, text) to authenticated;

-- Keep admin_set_username_required as the next-login request / revoke API.
comment on column public.profiles.username_required_on_next_login is
  'Admin-set one-shot Telegram username change request. Cleared atomically by set_username / admin_set_username. Shown only after the next successful login (client session gate).';
