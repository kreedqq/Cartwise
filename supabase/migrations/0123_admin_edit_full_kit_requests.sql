-- 0123_admin_edit_full_kit_requests.sql
-- Allow admins to redistribute full (not ordered) kit requests; fix cart sync when reopening.

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
  _locked boolean;
  _lock_reason text;
  _sync jsonb;
begin
  _uid := public.assert_admin_kit_request();
  perform public.kit_request_expire_overdue();

  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found or not coalesce(_kit.is_open_request, false) then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  _base := public.admin_kit_request_list_item(_kit);
  _sync := public.kit_full_order_sync_summary(_kit.id);
  _locked := public.kit_share_customer_lock_active(_kit.id);
  _lock_reason := public.kit_share_customer_lock_reason(_kit.id);

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
        ),
        'orderSyncStatus', public.kit_full_order_sync_participant_status(_kit.id, p.user_id)
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
    'orderSync', _sync,
    'customerMutationLocked', coalesce(_locked, false),
    'customerLockReason', _lock_reason,
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
  _total integer := 0;
  _seen uuid[] := '{}'::uuid[];
  _existing public.kit_share_participants;
  _remaining public.kit_share_participants;
  _was_full boolean;
  _now_full boolean;
begin
  _uid := public.assert_admin_kit_request();

  if _allocations is null or jsonb_typeof(_allocations) <> 'array' then
    raise exception 'Ungültige Verteilung.' using errcode = '22023';
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
    raise exception 'Der Kit Anteil wurde bereits bestellt und kann nicht automatisch entfernt werden.'
      using errcode = 'P0001';
  end if;

  _before := public.admin_get_kit_request(_kit.id);
  _was_full := _kit.status = 'full';

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
  perform set_config('kit.skip_customer_lock', 'on', true);
  perform set_config('kit.skip_cart_removal_tracking', 'on', true);

  for _existing in
    select * from public.kit_share_participants where kit_share_id = _kit.id
  loop
    if not (_existing.user_id = any (_seen)) then
      if exists (
        select 1 from public.cart_items ci
        where ci.kit_share_id = _kit.id
          and ci.submitted_order_id is not null
          and exists (
            select 1 from public.carts c
            where c.id = ci.cart_id and c.user_id = _existing.user_id and c.deleted_at is null
          )
      ) then
        raise exception 'Der Kit Anteil wurde bereits bestellt und kann nicht automatisch entfernt werden.'
          using errcode = 'P0001';
      end if;

      delete from public.cart_items ci
      using public.carts c
      where ci.cart_id = c.id
        and c.user_id = _existing.user_id
        and c.deleted_at is null
        and ci.kit_share_id = _kit.id
        and ci.submitted_order_id is null;

      delete from public.kit_share_participants
      where id = _existing.id;

      perform public.log_audit(
        _uid,
        'kit_request.admin_participant_removed',
        'kit_share',
        _kit.id,
        jsonb_build_object(
          'removedUserId', _existing.user_id,
          'removedQuantity', _existing.quantity
        ),
        jsonb_build_object(
          'kitShareId', _kit.id,
          'adminUserId', _uid
        )
      );
    end if;
  end loop;

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

  if _now_full and not _was_full then
    perform public.kit_share_on_became_full(_kit.id);
  elsif _now_full then
    perform set_config('kit.skip_customer_lock', 'on', true);
    perform public.kit_share_sync_all_participant_carts(_kit.id);
  else
    perform set_config('peptix.allow_kit_request_join', '1', true);
    perform set_config('kit.skip_customer_lock', 'on', true);
    perform set_config('kit.skip_cart_removal_tracking', 'on', true);
    for _remaining in
      select * from public.kit_share_participants where kit_share_id = _kit.id
    loop
      perform public.kit_share_sync_participant_cart(_kit.id, _remaining.user_id);
    end loop;
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
  from public, anon, authenticated;
grant execute on function public.admin_set_kit_request_distribution(uuid, jsonb)
  to authenticated;
