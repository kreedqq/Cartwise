-- 0081: Fix admin_remove_telegram_identity to keep auth.users providers in sync
-- Root cause (prod evidence, controlled test user f500febb / @dddd):
--   0080 DELETE FROM auth.identities succeeded (0 custom:telegram rows for pepsiDry),
--   but raw_app_meta_data.providers still contained 'custom:telegram'.
--   Subsequent linkIdentity then surfaces identity_already_exists → false PEPTIX conflict UI.
-- Repair: after delete (or when identity already gone), rebuild providers from remaining identities.

create or replace function public.admin_remove_telegram_identity(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _other int;
  _telegram_count int;
  _providers jsonb;
  _primary text;
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

  select count(*)::int into _other
  from auth.identities
  where user_id = _user_id
    and provider is distinct from 'custom:telegram';

  -- Telegram-only lockout protection (only when an identity row still exists).
  if coalesce(_telegram_count, 0) >= 1 and coalesce(_other, 0) < 1 then
    raise exception 'Die Telegram Zuordnung kann nicht entfernt werden, solange sie die einzige Anmeldemethode dieses Kontos ist.'
      using errcode = '42501';
  end if;

  if coalesce(_telegram_count, 0) >= 1 then
    delete from auth.identities
    where user_id = _user_id
      and provider = 'custom:telegram';
  elsif not (
    coalesce((select raw_app_meta_data->'providers' from auth.users where id = _user_id), '[]'::jsonb)
      ? 'custom:telegram'
  ) then
    raise exception 'Dieses Konto hat keine Telegram Verknüpfung.' using errcode = 'P0002';
  end if;
  -- else: identity already deleted but providers still lists custom:telegram → reconcile below

  -- Rebuild providers strictly from remaining auth.identities (source of truth).
  select coalesce(jsonb_agg(provider order by provider), '[]'::jsonb)
  into _providers
  from (
    select distinct provider
    from auth.identities
    where user_id = _user_id
  ) s;

  _primary := coalesce(_providers->>0, 'email');

  update auth.users
  set
    raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'providers', _providers,
        'provider', case
          when coalesce(raw_app_meta_data->>'provider', '') = 'custom:telegram'
            then _primary
          when coalesce(raw_app_meta_data->>'provider', '') = ''
            then _primary
          when not (_providers ? coalesce(raw_app_meta_data->>'provider', ''))
            then _primary
          else raw_app_meta_data->>'provider'
        end
      ),
    updated_at = now()
  where id = _user_id;

  -- Read-back: identity must be gone AND providers must not list custom:telegram.
  if exists (
    select 1 from auth.identities
    where user_id = _user_id and provider = 'custom:telegram'
  ) then
    raise exception 'Telegram Identity konnte nicht entfernt werden (Identity-Readback fehlgeschlagen).'
      using errcode = 'P0001';
  end if;

  if coalesce((select raw_app_meta_data->'providers' from auth.users where id = _user_id), '[]'::jsonb)
       ? 'custom:telegram' then
    raise exception 'Telegram Identity konnte nicht entfernt werden (Providers-Readback fehlgeschlagen).'
      using errcode = 'P0001';
  end if;

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
    jsonb_build_object('provider', 'custom:telegram', 'reconciled_providers', _providers),
    null
  );
end;
$$;

comment on function public.admin_remove_telegram_identity(uuid) is
  'Admin-only: delete custom:telegram identity and reconcile auth.users.raw_app_meta_data.providers from remaining identities. Allows orphaned-providers cleanup when the identity row is already gone. Blocks telegram-only accounts. Does not delete profiles.username.';

revoke all on function public.admin_remove_telegram_identity(uuid) from public, anon;
grant execute on function public.admin_remove_telegram_identity(uuid) to authenticated;

-- Detect orphaned providers (identity gone, providers still lists telegram) for admin UI.
create or replace function public.admin_list_telegram_orphan_user_ids()
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

  select coalesce(array_agg(u.id), '{}'::uuid[])
  into _ids
  from auth.users u
  where coalesce(u.raw_app_meta_data->'providers', '[]'::jsonb) ? 'custom:telegram'
    and not exists (
      select 1 from auth.identities i
      where i.user_id = u.id and i.provider = 'custom:telegram'
    );

  return _ids;
end;
$$;

comment on function public.admin_list_telegram_orphan_user_ids() is
  'Admin-only: user ids where raw_app_meta_data.providers still lists custom:telegram but no auth.identities row exists.';

revoke all on function public.admin_list_telegram_orphan_user_ids() from public, anon;
grant execute on function public.admin_list_telegram_orphan_user_ids() to authenticated;
