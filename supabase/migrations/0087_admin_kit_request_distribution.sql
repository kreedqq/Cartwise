-- 0087_admin_kit_request_distribution.sql
-- Atomic admin distribution (add/update/remove participants), user search, safe delete.
-- Reuses capacity SUM(qty) <= kit_size and kit_share_sync_all_participant_carts when full.
-- Does not rewrite historical orders. Does not alter 0085/0086/0070.

-- ---------------------------------------------------------------------------
-- Allow admin distribution to remove/update marketplace participants via GUC
-- ---------------------------------------------------------------------------

create or replace function public.kit_share_guard_open_request_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _kit public.kit_shares;
begin
  if tg_op = 'INSERT' then
    select * into _kit from public.kit_shares where id = new.kit_share_id;
    if found and coalesce(_kit.is_open_request, false) then
      if new.user_id = _kit.creator_user_id then
        return new;
      end if;
      if current_setting('peptix.allow_kit_request_join', true) = '1' then
        return new;
      end if;
      raise exception 'Kit-Gesuche können keine Einladungen verwenden.' using errcode = 'P0001';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    select * into _kit from public.kit_shares where id = new.kit_share_id;
    if found and coalesce(_kit.is_open_request, false)
       and new.quantity is distinct from old.quantity
       and current_setting('peptix.allow_kit_request_join', true) <> '1' then
      raise exception 'Die Menge eines Kit-Gesuchs kann nicht über die Einladungsfunktion geändert werden.'
        using errcode = 'P0001';
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    select * into _kit from public.kit_shares where id = old.kit_share_id;
    if found and coalesce(_kit.is_open_request, false) and old.user_id is distinct from auth.uid() then
      -- Admin distribution / leave helpers set the same GUC used for joins.
      if current_setting('peptix.allow_kit_request_join', true) = '1' then
        return old;
      end if;
      raise exception 'Teilnehmer eines Kit-Gesuchs können nicht über die Einladungsfunktion entfernt werden.'
        using errcode = 'P0001';
    end if;
    return old;
  end if;
  return null;
end;
$$;

create or replace function public.reject_kit_participant_area_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _area text;
begin
  select shop_area into _area from public.kit_shares where id = new.kit_share_id;
  if auth.uid() is not null then
    -- Admins redistribute kits without needing a customer role on the area.
    if public.has_role(auth.uid(), 'admin') then
      return new;
    end if;
    perform public.assert_kit_area_access(auth.uid(), _area);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- User search (username only, no emails)
-- ---------------------------------------------------------------------------

create or replace function public.admin_search_kit_request_users(
  _query text,
  _limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid;
  _q text;
  _lim integer;
  _items jsonb := '[]'::jsonb;
begin
  _uid := public.assert_admin_kit_request();
  _q := nullif(btrim(coalesce(_query, '')), '');
  if _q is null or char_length(_q) < 2 then
    return jsonb_build_object('items', '[]'::jsonb);
  end if;
  _lim := greatest(1, least(coalesce(_limit, 20), 30));
  _q := ltrim(_q, '@');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', p.id,
        'username', p.username
      )
      order by p.username asc
    ),
    '[]'::jsonb
  )
  into _items
  from (
    select id, username
    from public.profiles
    where username is not null
      and btrim(username) <> ''
      and username ilike '%' || _q || '%'
    order by username asc
    limit _lim
  ) p;

  return jsonb_build_object('items', coalesce(_items, '[]'::jsonb));
end;
$$;

revoke all on function public.admin_search_kit_request_users(text, integer) from public, anon;
grant execute on function public.admin_search_kit_request_users(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic distribution
-- _allocations: jsonb array of { "userId": uuid, "quantity": int }
-- quantity < 1 = remove; omitted users are removed
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_kit_request_distribution(
  _kit_share_id uuid,
  _allocations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid;
  _kit public.kit_shares;
  _before jsonb;
  _after jsonb;
  _row jsonb;
  _user_id uuid;
  _qty integer;
  _seen uuid[] := '{}';
  _total integer := 0;
  _existing public.kit_share_participants;
  _was_full boolean;
  _now_full boolean;
begin
  _uid := public.assert_admin_kit_request();

  if _allocations is null or jsonb_typeof(_allocations) <> 'array' then
    raise exception 'Ungültige Verteilung.' using errcode = '22023';
  end if;
  if jsonb_array_length(_allocations) < 1 then
    raise exception 'Die Verteilung muss mindestens einen Teilnehmer enthalten.' using errcode = '22023';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found or not coalesce(_kit.is_open_request, false) then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status = 'cancelled' then
    raise exception 'Dieses Kit wurde bereits storniert.' using errcode = 'P0001';
  end if;
  if _kit.status = 'expired' then
    raise exception 'Dieses Kit-Gesuch ist abgelaufen.' using errcode = 'P0001';
  end if;
  if _kit.status = 'ordered' then
    raise exception 'Dieses Kit wurde bereits bestellt und kann nicht mehr umverteilt werden.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit.id
      and (ordered_at is not null or order_id is not null)
  ) then
    raise exception 'Dieses Kit wurde bereits bestellt und kann nicht mehr umverteilt werden.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.cart_items ci
    where ci.kit_share_id = _kit.id
      and ci.submitted_order_id is not null
  ) then
    raise exception 'Dieses Kit wurde bereits bestellt und kann nicht mehr umverteilt werden.'
      using errcode = 'P0001';
  end if;

  _before := public.admin_get_kit_request(_kit.id);
  _was_full := _kit.status = 'full';

  -- Validate + normalize allocations first (fail before mutating).
  for _row in select value from jsonb_array_elements(_allocations)
  loop
    begin
      _user_id := (_row->>'userId')::uuid;
    exception when others then
      raise exception 'Ungültige Benutzer-ID in der Verteilung.' using errcode = '22023';
    end;
    if _user_id is null then
      raise exception 'Ungültige Benutzer-ID in der Verteilung.' using errcode = '22023';
    end if;
    if _user_id = any (_seen) then
      raise exception 'Dieser Benutzer ist bereits Teilnehmer dieses Kits.' using errcode = 'P0001';
    end if;
    _seen := array_append(_seen, _user_id);

    begin
      _qty := (_row->>'quantity')::integer;
    exception when others then
      raise exception 'Ungültige Menge.' using errcode = '22023';
    end;
    if _qty is null or _qty < 1 then
      raise exception 'Ungültige Menge.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.profiles p where p.id = _user_id and nullif(btrim(p.username), '') is not null) then
      raise exception 'Benutzer wurde nicht gefunden oder hat keinen Benutzernamen.' using errcode = 'P0002';
    end if;
    _total := _total + _qty;
  end loop;

  if _total > _kit.kit_size_vials then
    raise exception 'Die neue Verteilung überschreitet die Kitgröße.' using errcode = 'P0001';
  end if;

  perform set_config('peptix.allow_kit_request_join', '1', true);

  -- Remove participants not in the new set (and their open kit cart lines).
  for _existing in
    select * from public.kit_share_participants where kit_share_id = _kit.id
  loop
    if not (_existing.user_id = any (_seen)) then
      delete from public.cart_items ci
      using public.carts c
      where ci.cart_id = c.id
        and c.user_id = _existing.user_id
        and c.deleted_at is null
        and ci.kit_share_id = _kit.id
        and ci.submitted_order_id is null;

      delete from public.kit_share_participants
      where id = _existing.id;
    end if;
  end loop;

  -- Upsert remaining allocations.
  for _row in select value from jsonb_array_elements(_allocations)
  loop
    _user_id := (_row->>'userId')::uuid;
    _qty := (_row->>'quantity')::integer;

    update public.kit_share_participants
    set quantity = _qty, updated_at = now()
    where kit_share_id = _kit.id and user_id = _user_id;

    if not found then
      insert into public.kit_share_participants (kit_share_id, user_id, quantity)
      values (_kit.id, _user_id, _qty);
    end if;
  end loop;

  _total := public.kit_share_allocated_total(_kit.id);
  if _total > _kit.kit_size_vials then
    raise exception 'Die neue Verteilung überschreitet die Kitgröße.' using errcode = 'P0001';
  end if;

  _now_full := _total = _kit.kit_size_vials and mod(_total, 10) = 0;

  -- Marketplace full kits normally refuse demotion via kit_share_refresh_status_locked.
  -- Admin redistribution must set status explicitly (still fail-closed on ordered kits).
  update public.kit_shares
  set
    status = case when _now_full then 'full' else 'open' end,
    completed_at = case
      when _now_full then coalesce(completed_at, now())
      else null
    end,
    updated_at = now()
  where id = _kit.id
  returning * into _kit;

  if _now_full then
    perform public.kit_share_sync_all_participant_carts(_kit.id);
  else
    -- Open kits must not keep leftover full-kit cart lines.
    delete from public.cart_items ci
    using public.carts c
    where ci.cart_id = c.id
      and ci.kit_share_id = _kit.id
      and ci.submitted_order_id is null
      and c.deleted_at is null;
  end if;

  _after := public.admin_get_kit_request(_kit.id);

  perform public.log_audit(
    _uid,
    'kit_request.admin_distribution_update',
    'kit_share',
    _kit.id,
    jsonb_build_object(
      'status', _before->>'status',
      'allocatedTotal', _before->>'allocatedTotal',
      'participants', _before->'participants'
    ),
    jsonb_build_object(
      'status', _after->>'status',
      'allocatedTotal', _after->>'allocatedTotal',
      'participants', _after->'participants',
      'wasFull', _was_full,
      'nowFull', _now_full
    )
  );

  return _after;
end;
$$;

revoke all on function public.admin_set_kit_request_distribution(uuid, jsonb)
  from public, anon;
grant execute on function public.admin_set_kit_request_distribution(uuid, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Physical delete (safe open kits only)
-- ---------------------------------------------------------------------------

create or replace function public.admin_delete_kit_request(_kit_share_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid;
  _kit public.kit_shares;
  _before jsonb;
begin
  _uid := public.assert_admin_kit_request();

  select * into _kit from public.kit_shares where id = _kit_share_id for update;
  if not found or not coalesce(_kit.is_open_request, false) then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit.id
      and (ordered_at is not null or order_id is not null)
  ) then
    raise exception 'Dieses Kit kann nicht gelöscht werden, da bereits eine Bestellung damit verbunden ist.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.cart_items
    where kit_share_id = _kit.id and submitted_order_id is not null
  ) then
    raise exception 'Dieses Kit kann nicht gelöscht werden, da bereits eine Bestellung damit verbunden ist.'
      using errcode = 'P0001';
  end if;

  if _kit.status = 'ordered' then
    raise exception 'Dieses Kit kann nicht gelöscht werden, da bereits eine Bestellung damit verbunden ist.'
      using errcode = 'P0001';
  end if;

  _before := public.admin_kit_request_list_item(_kit);

  delete from public.cart_items ci
  using public.carts c
  where ci.cart_id = c.id
    and ci.kit_share_id = _kit.id
    and ci.submitted_order_id is null
    and c.deleted_at is null;

  perform set_config('peptix.allow_kit_request_join', '1', true);

  delete from public.kit_share_participants where kit_share_id = _kit.id;
  delete from public.kit_shares where id = _kit.id;

  perform public.log_audit(
    _uid,
    'kit_request.admin_delete',
    'kit_share',
    _kit_share_id,
    _before,
    null
  );

  return jsonb_build_object('deleted', true, 'id', _kit_share_id);
end;
$$;

revoke all on function public.admin_delete_kit_request(uuid) from public, anon;
grant execute on function public.admin_delete_kit_request(uuid) to authenticated;

comment on function public.admin_search_kit_request_users(text, integer) is
  'Admin-only username search for kit distribution. Returns userId + username only.';

comment on function public.admin_set_kit_request_distribution(uuid, jsonb) is
  'Admin-only atomic marketplace kit redistribution. Capacity SUM(qty)<=kit_size. Full uses existing cart sync.';

comment on function public.admin_delete_kit_request(uuid) is
  'Admin-only physical delete for marketplace kits without orders. Participants cascade; open cart lines cleared.';

-- Extend capability flags for distribution / delete.
create or replace function public.admin_get_kit_request(_kit_share_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid;
  _kit public.kit_shares;
  _base jsonb;
  _participants jsonb := '[]'::jsonb;
  _any_ordered boolean := false;
  _cart_lines integer := 0;
  _has_submitted_cart boolean := false;
  _editable boolean;
begin
  _uid := public.assert_admin_kit_request();
  perform public.kit_request_expire_overdue();

  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found or not coalesce(_kit.is_open_request, false) then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  _base := public.admin_kit_request_list_item(_kit);

  select exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit.id and (ordered_at is not null or order_id is not null)
  ) into _any_ordered;

  select count(*)::integer into _cart_lines
  from public.cart_items
  where kit_share_id = _kit.id;

  select exists (
    select 1 from public.cart_items
    where kit_share_id = _kit.id and submitted_order_id is not null
  ) into _has_submitted_cart;

  _editable := _kit.status in ('open', 'full')
    and not coalesce(_any_ordered, false)
    and not coalesce(_has_submitted_cart, false);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', p.user_id,
        'username', coalesce(nullif(trim(pr.username), ''), 'Teilnehmer'),
        'quantity', p.quantity,
        'joinedAt', p.created_at,
        'updatedAt', p.updated_at,
        'hasOrdered', p.ordered_at is not null,
        'orderedAt', p.ordered_at,
        'orderId', p.order_id,
        'isCreator', p.user_id = _kit.creator_user_id,
        'hasCartItem', exists (
          select 1 from public.cart_items ci
          where ci.kit_share_id = _kit.id
            and exists (
              select 1 from public.carts c
              where c.id = ci.cart_id
                and c.user_id = p.user_id
                and c.deleted_at is null
            )
        )
      )
      order by case when p.user_id = _kit.creator_user_id then 0 else 1 end,
               p.created_at asc
    ),
    '[]'::jsonb
  )
  into _participants
  from public.kit_share_participants p
  left join public.profiles pr on pr.id = p.user_id
  where p.kit_share_id = _kit.id;

  return _base || jsonb_build_object(
    'participants', coalesce(_participants, '[]'::jsonb),
    'anyParticipantOrdered', coalesce(_any_ordered, false),
    'cartLineCount', coalesce(_cart_lines, 0),
    'canEditMeta', _kit.status in ('open', 'full', 'expired'),
    'canEditQuantities', _editable,
    'canEditDistribution', _editable,
    'canCancel', _kit.status = 'open' and not coalesce(_any_ordered, false),
    'canDelete', _kit.status in ('open', 'full', 'cancelled', 'expired')
      and not coalesce(_any_ordered, false)
      and not coalesce(_has_submitted_cart, false),
    'canChangeProduct', false
  );
end;
$$;

revoke all on function public.admin_get_kit_request(uuid) from public, anon;
grant execute on function public.admin_get_kit_request(uuid) to authenticated;
