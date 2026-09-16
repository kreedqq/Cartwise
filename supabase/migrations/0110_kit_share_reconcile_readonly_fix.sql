-- 0110: reconcile report must not call cart mutators / FOR UPDATE paths.

create or replace function public.kit_share_reconcile_report(_kit_share_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _kit public.kit_shares;
  _issues jsonb := '[]'::jsonb;
  _participants jsonb := '[]'::jsonb;
  _participant record;
  _cart_id uuid;
  _cart_qty integer;
  _line_count integer;
  _line_area text;
  _state jsonb;
  _checked_at timestamptz := now();
  _healthy_participants integer := 0;
  _participant_status text;
  _order_item_qty integer;
  _locked boolean;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nicht autorisiert.' using errcode = '42501';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found then
    return jsonb_build_object(
      'kitShareId', _kit_share_id,
      'checkedAt', _checked_at,
      'overallStatus', 'UNKNOWN',
      'state', null,
      'participants', '[]'::jsonb,
      'issues', '[]'::jsonb,
      'reconciliationRequired', false
    );
  end if;

  _state := public.kit_share_project_state(_kit_share_id);
  _locked := coalesce((_state->>'isLocked')::boolean, false);

  if _kit.status = 'cancelled' then
    _issues := _issues || jsonb_build_array(jsonb_build_object('code', 'CANCELLED', 'severity', 'info'));
  elsif _kit.status = 'ordered' then
    _issues := _issues || jsonb_build_array(jsonb_build_object('code', 'ORDERED', 'severity', 'info'));
  elsif _locked then
    _issues := _issues || jsonb_build_array(jsonb_build_object('code', 'LOCKED', 'severity', 'info'));
  end if;

  if (_state->>'allocatedQuantity')::integer > (_state->>'kitSize')::integer then
    _issues := _issues || jsonb_build_array(jsonb_build_object(
      'code', 'ALLOCATION_OVERFLOW',
      'severity', 'error'
    ));
  end if;

  for _participant in
    select
      ksp.user_id,
      ksp.quantity,
      ksp.order_id,
      coalesce(p.username, '') as username
    from public.kit_share_participants ksp
    left join public.profiles p on p.id = ksp.user_id
    where ksp.kit_share_id = _kit_share_id
  loop
    _cart_id := null;
    _cart_qty := 0;
    _line_count := 0;
    _line_area := null;

    select c.id into _cart_id
    from public.carts c
    where c.user_id = _participant.user_id
      and c.deleted_at is null
      and c.status in ('draft', 'ready', 'open')
    order by c.updated_at desc nulls last
    limit 1;

    if _cart_id is not null then
      select
        coalesce(sum(ci.quantity), 0)::integer,
        count(*)::integer,
        max(ci.shop_area)
      into _cart_qty, _line_count, _line_area
      from public.cart_items ci
      where ci.cart_id = _cart_id
        and ci.kit_share_id = _kit_share_id;
    end if;

    _participant_status := 'HEALTHY';
    _order_item_qty := null;

    if _line_count > 1 then
      _participant_status := 'DUPLICATE_CART_LINE';
      _issues := _issues || jsonb_build_array(jsonb_build_object(
        'code', 'DUPLICATE_CART_LINE',
        'severity', 'warning',
        'userId', _participant.user_id,
        'cartLineCount', _line_count
      ));
    end if;

    if _line_area is not null and _line_area is distinct from _kit.shop_area then
      _participant_status := 'WRONG_AREA';
      _issues := _issues || jsonb_build_array(jsonb_build_object(
        'code', 'WRONG_AREA',
        'severity', 'warning',
        'userId', _participant.user_id,
        'expectedArea', _kit.shop_area,
        'cartLineArea', _line_area
      ));
    end if;

    if _kit.status = 'full' then
      if _line_count = 0 then
        _participant_status := 'MISSING_CART_LINE';
        _issues := _issues || jsonb_build_array(jsonb_build_object(
          'code', 'MISSING_CART_LINE',
          'severity', 'warning',
          'userId', _participant.user_id,
          'participantQuantity', _participant.quantity
        ));
      elsif _cart_qty is distinct from _participant.quantity then
        _participant_status := 'WRONG_CART_QUANTITY';
        _issues := _issues || jsonb_build_array(jsonb_build_object(
          'code', 'WRONG_CART_QUANTITY',
          'severity', 'warning',
          'userId', _participant.user_id,
          'participantQuantity', _participant.quantity,
          'cartQuantity', _cart_qty
        ));
      end if;
    elsif _line_count > 0 and _cart_qty is distinct from _participant.quantity then
      _participant_status := 'WRONG_CART_QUANTITY';
      _issues := _issues || jsonb_build_array(jsonb_build_object(
        'code', 'WRONG_CART_QUANTITY',
        'severity', 'warning',
        'userId', _participant.user_id,
        'participantQuantity', _participant.quantity,
        'cartQuantity', _cart_qty
      ));
    end if;

    if _participant.order_id is not null then
      select oi.kit_participant_quantity_snapshot::integer into _order_item_qty
      from public.order_items oi
      where oi.order_id = _participant.order_id
        and oi.kit_share_id_snapshot = _kit_share_id
      order by oi.created_at desc
      limit 1;

      if _order_item_qty is null then
        _issues := _issues || jsonb_build_array(jsonb_build_object(
          'code', 'ORDER_MISMATCH',
          'severity', 'warning',
          'userId', _participant.user_id,
          'orderId', _participant.order_id,
          'reason', 'missing_kit_line'
        ));
        if _participant_status = 'HEALTHY' then
          _participant_status := 'ORDER_MISMATCH';
        end if;
      elsif _order_item_qty is distinct from _participant.quantity
        and _kit.status = 'ordered' then
        _issues := _issues || jsonb_build_array(jsonb_build_object(
          'code', 'HISTORICAL_ORDER_SNAPSHOT_MISMATCH',
          'severity', 'info',
          'userId', _participant.user_id,
          'orderId', _participant.order_id,
          'participantQuantity', _participant.quantity,
          'orderSnapshotQuantity', _order_item_qty
        ));
        if _participant_status = 'HEALTHY' then
          _participant_status := 'HISTORICAL_ORDER_SNAPSHOT_MISMATCH';
        end if;
      elsif _order_item_qty is distinct from _participant.quantity then
        _issues := _issues || jsonb_build_array(jsonb_build_object(
          'code', 'ORDER_MISMATCH',
          'severity', 'warning',
          'userId', _participant.user_id,
          'orderId', _participant.order_id,
          'participantQuantity', _participant.quantity,
          'orderSnapshotQuantity', _order_item_qty
        ));
        if _participant_status = 'HEALTHY' then
          _participant_status := 'ORDER_MISMATCH';
        end if;
      end if;
    end if;

    if _participant_status = 'HEALTHY' then
      _healthy_participants := _healthy_participants + 1;
    end if;

    _participants := _participants || jsonb_build_array(jsonb_build_object(
      'userId', _participant.user_id,
      'username', _participant.username,
      'participantQuantity', _participant.quantity,
      'cartQuantity', coalesce(_cart_qty, 0),
      'cartLineCount', coalesce(_line_count, 0),
      'orderId', _participant.order_id,
      'orderSnapshotQuantity', _order_item_qty,
      'status', _participant_status
    ));
  end loop;

  return jsonb_build_object(
    'kitShareId', _kit_share_id,
    'checkedAt', _checked_at,
    'overallStatus', case
      when not exists (
        select 1
        from jsonb_array_elements(_issues) elem
        where (elem->>'severity') in ('error', 'warning')
      ) then 'HEALTHY'
      else 'NEEDS_ATTENTION'
    end,
    'state', _state,
    'participants', _participants,
    'participantCount', jsonb_array_length(_participants),
    'healthyParticipantCount', _healthy_participants,
    'issues', _issues,
    'reconciliationRequired', exists (
      select 1
      from jsonb_array_elements(_issues) elem
      where (elem->>'severity') in ('error', 'warning')
    )
  );
end;
$$;

revoke all on function public.kit_share_reconcile_report(uuid) from public, anon;
grant execute on function public.kit_share_reconcile_report(uuid) to authenticated;
