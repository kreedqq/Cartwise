-- 0089_kit_request_role_permission.sql
-- Role-gated Kit Gesuche (fail closed). Extends customer_roles; does not touch
-- 0070 / 0085 / 0086 / 0087. Admin kit RPCs stay admin-gated only.

alter table public.customer_roles
  add column if not exists can_use_kit_requests boolean not null default false;

comment on column public.customer_roles.can_use_kit_requests is
  'When true, users with this customer role may use Kit Gesuche (create/list/join). Fail closed: default false.';

-- Explicit seed: Group Buy allowed. NEU and all others stay false (fail closed).
update public.customer_roles
set can_use_kit_requests = true
where upper(trim(name)) = 'GROUP BUY';

create or replace function public.user_can_use_kit_requests(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select r.can_use_kit_requests
      from public.user_customer_roles u
      join public.customer_roles r on r.id = u.role_id
      where u.user_id = _uid
        and r.is_active
      limit 1
    ),
    (
      select r.can_use_kit_requests
      from public.customer_roles r
      where r.is_default
        and r.is_active
      limit 1
    ),
    false
  );
$$;

revoke all on function public.user_can_use_kit_requests(uuid) from public, anon;
grant execute on function public.user_can_use_kit_requests(uuid) to authenticated;

create or replace function public.assert_user_can_use_kit_requests(_uid uuid default auth.uid())
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if public.has_role(_uid, 'admin') then
    return;
  end if;
  if not public.user_can_use_kit_requests(_uid) then
    raise exception 'Kit Gesuche sind für deine aktuelle Rolle nicht freigeschaltet.'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_user_can_use_kit_requests(uuid) from public, anon, authenticated;

create or replace function public.get_my_can_use_kit_requests()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when public.has_role(auth.uid(), 'admin') then true
    else public.user_can_use_kit_requests(auth.uid())
  end;
$$;

revoke all on function public.get_my_can_use_kit_requests() from public, anon;
grant execute on function public.get_my_can_use_kit_requests() to authenticated;

-- Patch customer-facing kit RPCs that require an active kit permission.
-- leave / list_my / cancel own: keep usable for existing participation (no assert).
-- get_kit_request: allow creator/participant without permission (patched below).
-- list_open: empty payload when denied (no data leak).
do $mig$
declare
  r record;
  def text;
  patched text;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_kit_request',
        'join_kit_request',
        'preview_kit_request_join',
        'list_kit_requestable_product_ids'
      )
  loop
    def := pg_get_functiondef(r.oid);
    if position('assert_user_can_use_kit_requests' in def) > 0 then
      continue;
    end if;

    patched := regexp_replace(
      def,
      E'(raise exception ''Nicht angemeldet\\.'' using errcode = ''42501'';\\s*end if;)',
      E'\\1\n\n  perform public.assert_user_can_use_kit_requests(_uid);',
      1,
      'n'
    );

    if patched = def then
      raise exception '0089: could not patch % for kit permission assert', r.proname;
    end if;

    execute patched;
  end loop;
end;
$mig$;

-- get_kit_request: permission OR already involved (creator / participant).
do $mig$
declare
  def text;
  patched text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_kit_request'
  limit 1;

  if def is null then
    raise exception '0089: get_kit_request missing';
  end if;

  if position('user_can_use_kit_requests' in def) = 0 then
    patched := regexp_replace(
      def,
      E'(if not found or not coalesce\\(_kit\\.is_open_request, false\\) then\\s*raise exception ''Kit-Gesuch wurde nicht gefunden\\.'' using errcode = ''P0002'';\\s*end if;)',
      E'\\1\n\n  if not public.has_role(_uid, ''admin'')\n     and not public.user_can_use_kit_requests(_uid)\n     and _kit.creator_user_id is distinct from _uid\n     and not exists (\n       select 1 from public.kit_share_participants ksp\n       where ksp.kit_share_id = _kit.id and ksp.user_id = _uid\n     ) then\n    raise exception ''Kit-Gesuch wurde nicht gefunden.'' using errcode = ''P0002'';\n  end if;',
      1,
      'n'
    );
    if patched = def then
      raise exception '0089: could not patch get_kit_request';
    end if;
    execute patched;
  end if;
end;
$mig$;

-- list_open_kit_requests: fail closed with empty list (no kit catalog leak).
do $mig$
declare
  def text;
  patched text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'list_open_kit_requests'
  limit 1;

  if def is null then
    raise exception '0089: list_open_kit_requests missing';
  end if;

  if position('user_can_use_kit_requests' in def) = 0 then
    patched := regexp_replace(
      def,
      E'(raise exception ''Nicht angemeldet\\.'' using errcode = ''42501'';\\s*end if;)',
      E'\\1\n\n  if not public.has_role(_uid, ''admin'') and not public.user_can_use_kit_requests(_uid) then\n    _page_n := greatest(coalesce(_page, 1), 1);\n    _size := least(greatest(coalesce(_page_size, 20), 1), 50);\n    return jsonb_build_object(''items'', ''[]''::jsonb, ''total'', 0, ''page'', _page_n, ''pageSize'', _size);\n  end if;',
      1,
      'n'
    );
    if patched = def then
      raise exception '0089: could not patch list_open_kit_requests';
    end if;
    execute patched;
  end if;
end;
$mig$;

-- Admin upsert: persist can_use_kit_requests. Drop old 4-arg signature.
drop function if exists public.admin_upsert_customer_role(uuid, text, numeric, boolean);

create or replace function public.admin_upsert_customer_role(
  _id uuid,
  _name text,
  _markup_percent numeric,
  _is_active boolean,
  _can_use_kit_requests boolean default false
)
returns public.customer_roles
language plpgsql
security definer
set search_path = public
as $$
declare
  _row public.customer_roles;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen Rollen verwalten.' using errcode = '42501';
  end if;

  _name := trim(_name);
  if _name = '' then
    raise exception 'Rollenname darf nicht leer sein.' using errcode = '23514';
  end if;
  if _markup_percent is null or _markup_percent < 0 or _markup_percent > 1000 then
    raise exception 'Ungültiger Aufschlag.' using errcode = '22023';
  end if;

  if _id is null then
    insert into public.customer_roles (name, markup_percent, is_active, can_use_kit_requests)
    values (_name, _markup_percent, coalesce(_is_active, true), coalesce(_can_use_kit_requests, false))
    returning * into _row;
  else
    update public.customer_roles
    set name = _name,
        markup_percent = _markup_percent,
        is_active = coalesce(_is_active, is_active),
        can_use_kit_requests = coalesce(_can_use_kit_requests, can_use_kit_requests)
    where id = _id
    returning * into _row;
    if not found then
      raise exception 'Rolle wurde nicht gefunden.' using errcode = 'P0002';
    end if;
  end if;

  perform public.log_audit(auth.uid(), 'customer_role.upsert', 'customer_role', _row.id, null,
    jsonb_build_object(
      'name', _row.name,
      'markupPercent', _row.markup_percent,
      'isActive', _row.is_active,
      'canUseKitRequests', _row.can_use_kit_requests
    ));
  return _row;
end;
$$;

revoke all on function public.admin_upsert_customer_role(uuid, text, numeric, boolean, boolean) from public;
grant execute on function public.admin_upsert_customer_role(uuid, text, numeric, boolean, boolean) to authenticated;
