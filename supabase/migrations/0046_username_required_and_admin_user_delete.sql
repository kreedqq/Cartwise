-- 0046_username_required_and_admin_user_delete.sql
-- Per-user Telegram username confirmation flag + safe admin account deletion.
-- Historical orders stay; orders.user_id becomes nullable (ON DELETE SET NULL).
-- Kit shares with remaining participants keep their kit; empty kits of the
-- deleted user are removed. Role pricing functions are not modified.

-- ---------------------------------------------------------------------------
-- 1. profiles.username_required_on_next_login
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists username_required_on_next_login boolean not null default false;

comment on column public.profiles.username_required_on_next_login is
  'When true, the user must confirm or set profiles.username before using the app. Admin-set, cleared by set_username.';

-- INVOKER: SECURITY DEFINER would make current_user postgres and let
-- authenticated clients clear the flag via a direct UPDATE.
create or replace function public.protect_username_required_flag()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.username_required_on_next_login is distinct from new.username_required_on_next_login
     and current_user = 'authenticated' then
    raise exception 'username_required_on_next_login darf nicht clientseitig geändert werden.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_username_required on public.profiles;
create trigger profiles_protect_username_required
  before update on public.profiles
  for each row
  execute function public.protect_username_required_flag();

-- ---------------------------------------------------------------------------
-- 2. set_username — also clear the admin-required flag
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
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  _clean := trim(coalesce(_username, ''));

  if _clean !~ '^[A-Za-z][A-Za-z0-9_.]{2,23}$' then
    raise exception 'Ungültiger Telegram Benutzername. Erlaubt: 3-24 Zeichen, beginnend mit einem Buchstaben, danach Buchstaben, Zahlen, "_" oder ".".'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.profiles
    where lower(username) = lower(_clean) and id <> _uid
  ) then
    raise exception 'Dieser Telegram Benutzername ist bereits vergeben.' using errcode = 'P0001';
  end if;

  update public.profiles
  set
    username = _clean,
    username_required_on_next_login = false,
    updated_at = now()
  where id = _uid;

  if not found then
    raise exception 'Profil wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  perform public.sync_cart_titles_for_user(_uid);
  return _clean;
end;
$$;

comment on function public.set_username(text) is
  'Self-service Telegram handle: validated, unique, caller only. Clears username_required_on_next_login. Rewrites cart titles from the stable ordinal.';

revoke all on function public.set_username(text) from public;
grant execute on function public.set_username(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Admin: set username-required flag for one user
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_username_required(_user_id uuid, _required boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  update public.profiles
  set username_required_on_next_login = coalesce(_required, false), updated_at = now()
  where id = _user_id;

  perform public.log_audit(
    auth.uid(),
    case when coalesce(_required, false) then 'user.username_required.enable' else 'user.username_required.disable' end,
    'profile',
    _user_id,
    null,
    jsonb_build_object('username_required_on_next_login', coalesce(_required, false))
  );
end;
$$;

comment on function public.admin_set_username_required(uuid, boolean) is
  'Admin-only: require or stop requiring Telegram username confirmation on the next login for one user.';

revoke all on function public.admin_set_username_required(uuid, boolean) from public;
grant execute on function public.admin_set_username_required(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Historical orders: do not cascade-delete when an auth user is removed
-- ---------------------------------------------------------------------------

alter table public.orders drop constraint if exists orders_user_id_fkey;
alter table public.orders alter column user_id drop not null;
alter table public.orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;

comment on column public.orders.user_id is
  'Placing customer. Null after the auth account is deleted; snapshots on the order stay.';

alter table public.review_actions drop constraint if exists review_actions_admin_user_id_fkey;
alter table public.review_actions
  add constraint review_actions_admin_user_id_fkey
  foreign key (admin_user_id) references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 5. Admin: delete auth account without destroying historical orders
-- ---------------------------------------------------------------------------

create or replace function public.admin_delete_user(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _admin_count integer;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen Benutzer entfernen.' using errcode = '42501';
  end if;
  if _user_id is null then
    raise exception 'user_id fehlt.' using errcode = '22023';
  end if;
  if _user_id = auth.uid() then
    raise exception 'Du kannst deinen eigenen Account nicht löschen.' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = _user_id) then
    raise exception 'Benutzer wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if public.has_role(_user_id, 'admin') then
    select count(*) into _admin_count from public.user_roles where role = 'admin';
    if coalesce(_admin_count, 0) <= 1 then
      raise exception 'Es muss mindestens ein Admin bestehen bleiben.' using errcode = '42501';
    end if;
  end if;

  -- Keep historical orders and their snapshots; only drop the live owner link.
  update public.orders
  set user_id = null
  where user_id = _user_id;

  -- Drop this user's kit participation. Other members keep the kit.
  delete from public.kit_share_participants
  where user_id = _user_id;

  -- If other participants remain, hand creator to the oldest remaining member.
  update public.kit_shares k
  set creator_user_id = coalesce(
    (
      select p.user_id
      from public.kit_share_participants p
      where p.kit_share_id = k.id
      order by p.created_at
      limit 1
    ),
    k.creator_user_id
  )
  where k.creator_user_id = _user_id;

  -- Kits with nobody left (this user's solo/empty kits) can go.
  delete from public.kit_shares k
  where k.creator_user_id = _user_id
    and not exists (
      select 1 from public.kit_share_participants p where p.kit_share_id = k.id
    );

  update public.review_actions
  set admin_user_id = null
  where admin_user_id = _user_id;

  perform public.log_audit(
    auth.uid(),
    'user.delete',
    'profile',
    _user_id,
    jsonb_build_object('deleted_user_id', _user_id),
    null
  );

  -- Cascades profiles, carts, favorites, templates, user_roles, user_customer_roles.
  -- orders.user_id is SET NULL. kit creator already reassigned or kit deleted.
  delete from auth.users where id = _user_id;
end;
$$;

comment on function public.admin_delete_user(uuid) is
  'Admin-only: remove an auth account. Historical orders and snapshots are kept. Caller cannot delete self or the last admin.';

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;
