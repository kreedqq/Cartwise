-- 0079: Admin Telegram-required request only for accounts without custom:telegram.
-- Additive REPLACE of admin_set_username_required + admin helper for UI.
-- Does not modify 0078 transfer logic, 0070 carts, or username lock semantics.

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

  -- Enabling is only meaningful for linking (Flow B). Already-linked accounts
  -- skip the UsernameGate by design — refuse so admins get a clear error.
  if coalesce(_required, false)
     and exists (
       select 1
       from auth.identities i
       where i.user_id = _user_id
         and i.provider = 'custom:telegram'
     ) then
    raise exception
      'Dieses Konto ist bereits mit Telegram verknüpft. Die Erzwingen-Funktion gilt nur für Konten ohne Telegram-Verknüpfung.'
      using errcode = 'P0001';
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
  'Admin-only: require Telegram linking on next login for users without custom:telegram. Refuses enable when Telegram is already linked.';

revoke all on function public.admin_set_username_required(uuid, boolean) from public, anon;
grant execute on function public.admin_set_username_required(uuid, boolean) to authenticated;

create or replace function public.admin_list_telegram_linked_user_ids()
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  _ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen diese Aktion ausführen.' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct i.user_id), '{}'::uuid[])
  into _ids
  from auth.identities i
  where i.provider = 'custom:telegram';

  return _ids;
end;
$$;

comment on function public.admin_list_telegram_linked_user_ids() is
  'Admin-only: auth.users ids that already have custom:telegram (for AdminUsers linking UI).';

revoke all on function public.admin_list_telegram_linked_user_ids() from public, anon;
grant execute on function public.admin_list_telegram_linked_user_ids() to authenticated;
