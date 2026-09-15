-- 0104_kit_full_order_sync.sql
-- When a kit share becomes FULL, extend existing customer orders (order revision)
-- for participants who checked out while the kit was still incomplete (0088 skip).
-- Additive; reuses 0092 revision + order_items kit snapshots. Does not modify 0102.

-- ---------------------------------------------------------------------------
-- kit_full_order_sync_historical_price — frozen unit from cart / recovery / ratio
-- ---------------------------------------------------------------------------

create or replace function public.kit_full_order_sync_historical_price(
  _order_id uuid,
  _kit_share_id uuid,
  _participant_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _order public.orders;
  _kit public.kit_shares;
  _participant public.kit_share_participants;
  _product public.products;
  _template public.cart_items;
  _unit numeric(12, 4);
  _alloc_at_checkout integer;
  _markup numeric(8, 4);
  _catalog_unit numeric(12, 4);
  _ratio numeric(12, 6);
  _cat_ref numeric(12, 4);
  _sell_ref numeric(12, 4);
begin
  select * into _order from public.orders where id = _order_id;
  select * into _kit from public.kit_shares where id = _kit_share_id;
  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _participant_user_id;

  if not found then
    return null;
  end if;

  _product := public.kit_share_catalog_product(_kit);

  if _kit.completed_at is not null and _order.submitted_at > _kit.completed_at then
    _template := public.kit_sync_recovery_historical_cart_template(_order_id, _kit_share_id, _participant_user_id);
    if _template.id is not null and _template.unit_price_usd_snapshot is not null then
      return jsonb_build_object(
        'unitPriceUsd', _template.unit_price_usd_snapshot,
        'normalUnitUsd', _template.normal_price_usd_snapshot,
        'bulkUnitUsd', _template.bulk_price_usd_snapshot,
        'bulkMinQty', _template.bulk_price_min_quantity_snapshot,
        'appliedTier', coalesce(_template.applied_price_tier, 'normal'),
        'source', 'recovery_template'
      );
    end if;
  end if;

  select ci.* into _template
  from public.cart_items ci
  where ci.cart_id = _order.cart_id
    and ci.kit_share_id = _kit_share_id
    and coalesce(ci.price_snapshot_at, ci.created_at) <= _order.submitted_at + interval '15 minutes'
  order by coalesce(ci.price_snapshot_at, ci.created_at) desc
  limit 1;

  if _template.id is null then
    select ci.* into _template
    from public.cart_items ci
    where ci.cart_id = _order.cart_id
      and ci.kit_share_id = _kit_share_id
      and ci.created_at >= _order.submitted_at
    order by ci.created_at asc
    limit 1;
  end if;

  if _template.id is null then
    select ci.* into _template
    from public.cart_items ci
    join public.kit_shares ks_ci on ks_ci.id = ci.kit_share_id
    where ci.cart_id = _order.cart_id
      and ci.kit_share_id is not null
      and ks_ci.product_id is not distinct from _kit.product_id
      and coalesce(ci.price_snapshot_at, ci.created_at) <= _order.submitted_at + interval '24 hours'
    order by
      case when ci.kit_share_id = _kit_share_id then 0 else 1 end,
      coalesce(ci.price_snapshot_at, ci.created_at) desc
    limit 1;
  end if;

  if _template.id is null then
    select ci.* into _template
    from public.cart_items ci
    join public.carts c on c.id = ci.cart_id and c.deleted_at is null
    where ci.kit_share_id = _kit_share_id
      and c.user_id = _participant_user_id
      and ci.created_at >= _order.submitted_at
      and (_kit.completed_at is null or ci.created_at <= _kit.completed_at + interval '7 days')
    order by ci.created_at asc
    limit 1;
  end if;

  if _template.id is not null and _template.unit_price_usd_snapshot is not null then
    return jsonb_build_object(
      'unitPriceUsd', _template.unit_price_usd_snapshot,
      'normalUnitUsd', _template.normal_price_usd_snapshot,
      'bulkUnitUsd', _template.bulk_price_usd_snapshot,
      'bulkMinQty', _template.bulk_price_min_quantity_snapshot,
      'appliedTier', coalesce(_template.applied_price_tier, 'normal'),
      'source', 'cart_snapshot'
    );
  end if;

  select coalesce(sum(p.quantity), 0)::integer into _alloc_at_checkout
  from public.kit_share_participants p
  where p.kit_share_id = _kit_share_id
    and p.created_at <= _order.submitted_at + interval '5 minutes';

  if _alloc_at_checkout <= 0 then
    _alloc_at_checkout := _participant.quantity;
  end if;

  select orsl.catalog_unit_price_usd, orsl.selling_unit_price_usd
  into _cat_ref, _sell_ref
  from public.order_items oi
  join public.order_role_surcharge_lines orsl on orsl.order_item_id = oi.id
  where oi.order_id = _order.id
    and orsl.catalog_unit_price_usd > 0
    and orsl.selling_unit_price_usd > 0
  order by oi.position
  limit 1;

  if _cat_ref is not null and _sell_ref is not null then
    _ratio := _sell_ref / _cat_ref;
  else
    _ratio := null;
  end if;

  _markup := public.markup_percent_for_area(_participant_user_id, _kit.shop_area, _product.id);
  _catalog_unit := public.kit_share_catalog_unit_usd(_product, _kit.kit_size_vials, _alloc_at_checkout);
  _unit := public.apply_role_markup(_catalog_unit, _markup);

  if _ratio is not null then
    _unit := round((_catalog_unit * _ratio)::numeric, 4);
  end if;

  return jsonb_build_object(
    'unitPriceUsd', _unit,
    'normalUnitUsd', _catalog_unit,
    'bulkUnitUsd', null,
    'bulkMinQty', _product.bulk_price_min_quantity,
    'appliedTier', 'normal',
    'source', 'checkout_allocation_ratio'
  );
end;
$$;

revoke all on function public.kit_full_order_sync_historical_price(uuid, uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- kit_full_order_sync_participant_status — read-only per participant
-- ---------------------------------------------------------------------------

create or replace function public.kit_full_order_sync_participant_status(
  _kit_share_id uuid,
  _participant_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _kit public.kit_shares;
  _participant public.kit_share_participants;
  _order public.orders;
  _order_id uuid;
  _candidate_ids uuid[];
  _template public.cart_items;
  _product public.products;
  _qty numeric(12, 3);
  _unit numeric(12, 4);
  _line_usd numeric(12, 2);
  _alloc_at_checkout integer;
  _markup numeric(8, 4);
  _catalog_unit numeric(12, 4);
  _ratio numeric(12, 6);
  _cat_ref numeric(12, 4);
  _sell_ref numeric(12, 4);
begin
  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found then
    return jsonb_build_object('status', 'error', 'reason', 'Kit nicht gefunden.');
  end if;

  if _kit.status <> 'full' or not public.kit_share_allocation_matches_size(_kit_share_id) then
    return jsonb_build_object('status', 'not_applicable', 'reason', 'Kit ist nicht vollständig.');
  end if;

  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _participant_user_id;

  if not found then
    return jsonb_build_object('status', 'not_applicable', 'reason', 'Kein Teilnehmer.');
  end if;

  _qty := _participant.quantity;

  if exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.kit_share_id_snapshot = _kit_share_id
      and o.user_id = _participant_user_id
      and o.status <> 'cancelled'
  ) then
    select o.id into _order_id
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.kit_share_id_snapshot = _kit_share_id
      and o.user_id = _participant_user_id
      and o.status <> 'cancelled'
    order by o.submitted_at desc
    limit 1;

    return jsonb_build_object(
      'status', 'synced',
      'orderId', _order_id,
      'participantUserId', _participant_user_id,
      'kitShareId', _kit_share_id
    );
  end if;

  if _participant.ordered_at is not null
     and _participant.order_id is not null
     and not exists (
       select 1 from public.order_items oi
       where oi.order_id = _participant.order_id
         and oi.kit_share_id_snapshot = _kit_share_id
     ) then
    _order_id := _participant.order_id;
  else
    _order_id := null;

    select ci.submitted_order_id into _order_id
    from public.cart_items ci
    join public.carts c on c.id = ci.cart_id and c.deleted_at is null
    where ci.kit_share_id = _kit_share_id
      and c.user_id = _participant_user_id
      and ci.submitted_order_id is not null
    limit 1;

    if _order_id is null then
      select array_agg(o.id order by o.submitted_at desc)
      into _candidate_ids
      from public.orders o
      where o.user_id = _participant_user_id
        and o.status <> 'cancelled'
        and o.shop_area = _kit.shop_area
        and o.submitted_at >= _participant.created_at
        and not exists (
          select 1 from public.order_items oi
          where oi.order_id = o.id and oi.kit_share_id_snapshot = _kit_share_id
        )
        and (
          exists (
            select 1 from public.cart_items ci
            where ci.cart_id = o.cart_id and ci.kit_share_id = _kit_share_id
          )
          or exists (
            select 1
            from public.cart_items ci
            join public.kit_shares ks_ci on ks_ci.id = ci.kit_share_id
            where ci.cart_id = o.cart_id
              and ci.kit_share_id is not null
              and ks_ci.product_id is not distinct from _kit.product_id
          )
          or exists (
            select 1
            from public.order_items oi2
            where oi2.order_id = o.id
              and oi2.kit_share_id_snapshot is not null
              and oi2.kit_share_id_snapshot is distinct from _kit_share_id
          )
        );

      if _candidate_ids is null or array_length(_candidate_ids, 1) is null then
        return jsonb_build_object(
          'status', 'pending_no_order',
          'reason', 'Keine passende Bestellung gefunden.',
          'participantUserId', _participant_user_id,
          'kitShareId', _kit_share_id
        );
      end if;

      if array_length(_candidate_ids, 1) > 1 then
        return jsonb_build_object(
          'status', 'pending_ambiguous_order',
          'reason', 'Mehrere mögliche Bestellungen.',
          'orderIds', to_jsonb(_candidate_ids),
          'participantUserId', _participant_user_id,
          'kitShareId', _kit_share_id
        );
      end if;

      _order_id := _candidate_ids[1];
    end if;
  end if;

  select * into _order from public.orders where id = _order_id;
  if not found or _order.status = 'cancelled' then
    return jsonb_build_object(
      'status', 'pending_no_order',
      'reason', 'Keine passende Bestellung gefunden.',
      'participantUserId', _participant_user_id,
      'kitShareId', _kit_share_id
    );
  end if;

  if _order.user_id is distinct from _participant_user_id then
    return jsonb_build_object(
      'status', 'pending_ambiguous_order',
      'reason', 'Bestellung gehört nicht zum Teilnehmer.',
      'participantUserId', _participant_user_id,
      'kitShareId', _kit_share_id
    );
  end if;

  if exists (
    select 1 from public.order_items oi
    where oi.order_id = _order.id and oi.kit_share_id_snapshot = _kit_share_id
  ) then
    return jsonb_build_object(
      'status', 'synced',
      'orderId', _order.id,
      'participantUserId', _participant_user_id,
      'kitShareId', _kit_share_id
    );
  end if;

  select (public.kit_full_order_sync_historical_price(_order.id, _kit_share_id, _participant_user_id)->>'unitPriceUsd')::numeric
  into _unit;

  if _unit is null then
    return jsonb_build_object(
      'status', 'pending_no_price',
      'reason', 'Historischer Preis nicht eindeutig bestimmbar.',
      'orderId', _order.id,
      'participantUserId', _participant_user_id,
      'kitShareId', _kit_share_id
    );
  end if;

  _line_usd := round((_qty * _unit)::numeric, 2);

  return jsonb_build_object(
    'status', 'ready',
    'orderId', _order.id,
    'orderNumber', _order.order_number,
    'participantUserId', _participant_user_id,
    'kitShareId', _kit_share_id,
    'participantQuantity', _qty,
    'historicalUnitPriceUsd', _unit,
    'lineTotalUsd', _line_usd,
    'expectedRevision', coalesce(_order.revision_number, 0)
  );
end;
$$;

revoke all on function public.kit_full_order_sync_participant_status(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- kit_full_order_sync_apply_participant — atomic revision + line (idempotent)
-- ---------------------------------------------------------------------------

create or replace function public.kit_full_order_sync_apply_participant(
  _kit_share_id uuid,
  _participant_user_id uuid,
  _actor uuid,
  _reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _eval jsonb;
  _order public.orders;
  _kit public.kit_shares;
  _participant public.kit_share_participants;
  _product public.products;
  _template public.cart_items;
  _rev integer;
  _prev_usd numeric(12, 2);
  _prev_eur numeric(12, 2);
  _new_usd numeric(12, 2);
  _new_eur numeric(12, 2);
  _eur_ok boolean := true;
  _qty numeric(12, 3);
  _unit numeric(12, 4);
  _line_usd numeric(12, 2);
  _line_eur numeric(12, 2);
  _position integer;
  _order_item_id uuid;
  _catalog_unit numeric(12, 4);
  _base_line numeric(12, 2);
  _role_name text;
  _username text;
  _status_row jsonb;
  _price jsonb;
begin
  _status_row := public.kit_full_order_sync_participant_status(_kit_share_id, _participant_user_id);
  _eval := _status_row;

  if (_eval->>'status') = 'synced' then
    return _eval || jsonb_build_object('applied', false);
  end if;

  if (_eval->>'status') is distinct from 'ready' then
    return _eval || jsonb_build_object('applied', false);
  end if;

  _reason := nullif(trim(coalesce(_reason, '')), '');
  if _reason is null then
    _reason := 'Automatische Kit-Bestell-Synchronisation';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id;
  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _participant_user_id
  for update;

  select * into _order from public.orders where id = (_eval->>'orderId')::uuid for update;
  if not found or _order.status = 'cancelled' then
    return jsonb_build_object('status', 'pending_no_order', 'applied', false);
  end if;

  if exists (
    select 1 from public.order_items oi
    where oi.order_id = _order.id and oi.kit_share_id_snapshot = _kit_share_id
  ) then
    return jsonb_build_object('status', 'synced', 'orderId', _order.id, 'applied', false);
  end if;

  _rev := coalesce(_order.revision_number, 0);
  if (_eval->>'expectedRevision')::integer is distinct from _rev then
    return jsonb_build_object(
      'status', 'conflict',
      'reason', 'Bestellrevision hat sich geändert.',
      'applied', false
    );
  end if;

  _qty := _participant.quantity;
  _unit := (_eval->>'historicalUnitPriceUsd')::numeric;
  _line_usd := round((_qty * _unit)::numeric, 2);

  if _order.exchange_rate is not null and _order.exchange_rate > 0 then
    _line_eur := round((_line_usd * _order.exchange_rate)::numeric, 2);
  else
    _line_eur := null;
    _eur_ok := false;
  end if;

  _product := public.kit_share_catalog_product(_kit);

  _price := public.kit_full_order_sync_historical_price(_order.id, _kit_share_id, _participant_user_id);

  _template.id := null;
  _template.unit_price_usd_snapshot := _unit;
  _template.normal_price_usd_snapshot := coalesce((_price->>'normalUnitUsd')::numeric, _unit);
  _template.bulk_price_usd_snapshot := (_price->>'bulkUnitUsd')::numeric;
  _template.bulk_price_min_quantity_snapshot := case
    when nullif(trim(_price->>'bulkMinQty'), '') is null then null
    else trunc((_price->>'bulkMinQty')::numeric)::integer
  end;
  _template.applied_price_tier := coalesce(_price->>'appliedTier', 'normal');
  _template.product_code_snapshot := coalesce(_product.code, _kit.vendor_code);
  _template.product_name_snapshot := coalesce(_product.name, _kit.vendor_code);

  _prev_usd := _order.total_usd;
  _prev_eur := _order.total_eur;

  select coalesce(max(position), -1) + 1 into _position
  from public.order_items where order_id = _order.id;

  insert into public.order_items (
    order_id, position, product_id,
    kit_share_id_snapshot, kit_size_vials_snapshot, kit_participant_quantity_snapshot,
    product_code_snapshot, product_name_snapshot, dosage_vial_snapshot, description_snapshot,
    normal_price_usd_snapshot, bulk_price_usd_snapshot, bulk_price_min_quantity_snapshot,
    applied_price_tier, unit_price_usd_snapshot, quantity, line_total_usd,
    exchange_rate_snapshot, eur_value_snapshot
  )
  values (
    _order.id, _position, _product.id,
    _kit_share_id, _kit.kit_size_vials, _qty,
    coalesce(_product.code, _kit.vendor_code), coalesce(_product.name, _template.product_name_snapshot),
    _product.dosage_vial, _product.description,
    _template.normal_price_usd_snapshot, _template.bulk_price_usd_snapshot,
    _template.bulk_price_min_quantity_snapshot, coalesce(_template.applied_price_tier, 'normal'),
    _unit, _qty, _line_usd,
    _order.exchange_rate, _line_eur
  )
  returning id into _order_item_id;

  select coalesce(sum(line_total_usd), 0), coalesce(sum(eur_value_snapshot), 0)
  into _new_usd, _new_eur
  from public.order_items where order_id = _order.id;

  if exists (
    select 1 from public.order_items
    where order_id = _order.id and (eur_value_snapshot is null or exchange_rate_snapshot is null)
  ) then
    _eur_ok := false;
  end if;

  update public.orders
  set total_usd = _new_usd,
      total_eur = case when _eur_ok then _new_eur else null end,
      revision_number = _rev + 1,
      updated_at = now()
  where id = _order.id;

  select cr.name into _role_name
  from public.user_customer_roles ucr
  join public.customer_roles cr on cr.id = ucr.role_id
  where ucr.user_id = _order.user_id
  limit 1;

  _catalog_unit := case
    when coalesce(_template.applied_price_tier, 'normal') = 'bulk'
      then coalesce(_template.bulk_price_usd_snapshot, _template.normal_price_usd_snapshot)
    else coalesce(_template.normal_price_usd_snapshot, _template.bulk_price_usd_snapshot)
  end;

  _base_line := round((_qty * _catalog_unit)::numeric, 2);

  insert into public.order_role_surcharge_lines (
    order_item_id, order_id,
    catalog_unit_price_usd, selling_unit_price_usd, quantity,
    base_line_usd, selling_line_usd, surcharge_usd,
    customer_role_name_snapshot
  )
  values (
    _order_item_id, _order.id,
    _catalog_unit, _unit, _qty,
    _base_line, _line_usd, round((_line_usd - _base_line)::numeric, 2),
    _role_name
  );

  insert into public.order_revisions (
    order_id, revision_number, created_by, reason,
    previous_total_usd, new_total_usd,
    previous_total_eur, new_total_eur,
    difference_usd, difference_eur,
    changes
  )
  values (
    _order.id, _rev + 1, _actor, _reason,
    _prev_usd, _new_usd,
    _prev_eur, case when _eur_ok then _new_eur else null end,
    round((_new_usd - _prev_usd)::numeric, 2),
    case when _eur_ok and _prev_eur is not null and _new_eur is not null
      then round((_new_eur - _prev_eur)::numeric, 2) else null end,
    jsonb_build_object(
      'lines', jsonb_build_array(jsonb_build_object(
        'action', 'add_historical_kit_line',
        'source', 'kit_full_order_sync',
        'orderItemId', _order_item_id,
        'kitShareId', _kit_share_id,
        'productCode', coalesce(_product.code, _kit.vendor_code),
        'quantity', _qty,
        'unitPriceUsd', _unit,
        'lineTotalUsd', _line_usd
      ))
    )
  );

  update public.kit_share_participants
  set order_id = _order.id,
      ordered_at = coalesce(ordered_at, _order.submitted_at),
      updated_at = now()
  where kit_share_id = _kit_share_id and user_id = _participant_user_id;

  update public.cart_items ci
  set submitted_order_id = _order.id,
      updated_at = now()
  from public.carts c
  where ci.cart_id = c.id
    and c.user_id = _participant_user_id
    and c.deleted_at is null
    and ci.kit_share_id = _kit_share_id
    and ci.submitted_order_id is null;

  select username into _username from public.profiles where id = _order.user_id;

  perform public.log_audit(
    _actor, 'kit_order.auto_sync', 'order', _order.id, null,
    jsonb_build_object(
      'orderNumber', _order.order_number,
      'customerUsername', _username,
      'kitShareId', _kit_share_id,
      'participantUserId', _participant_user_id,
      'participantQuantity', _qty,
      'productCode', coalesce(_product.code, _kit.vendor_code),
      'historicalUnitPriceUsd', _unit,
      'lineTotalUsd', _line_usd,
      'previousTotalUsd', _prev_usd,
      'newTotalUsd', _new_usd,
      'revisionNumber', _rev + 1,
      'reason', _reason
    )
  );

  return jsonb_build_object(
    'status', 'synced',
    'applied', true,
    'orderId', _order.id,
    'orderItemId', _order_item_id,
    'revisionNumber', _rev + 1,
    'differenceUsd', round((_new_usd - _prev_usd)::numeric, 2)
  );
end;
$$;

revoke all on function public.kit_full_order_sync_apply_participant(uuid, uuid, uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- kit_full_order_sync_kit — all participants (idempotent)
-- ---------------------------------------------------------------------------

create or replace function public.kit_full_order_sync_kit(_kit_share_id uuid, _actor uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _kit public.kit_shares;
  _participant record;
  _results jsonb := '[]'::jsonb;
  _row jsonb;
  _synced integer := 0;
  _ready integer := 0;
  _pending integer := 0;
begin
  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status <> 'full' or not public.kit_share_allocation_matches_size(_kit_share_id) then
    return jsonb_build_object('kitShareId', _kit_share_id, 'participants', '[]'::jsonb, 'summary', 'not_applicable');
  end if;

  for _participant in
    select user_id from public.kit_share_participants where kit_share_id = _kit_share_id
  loop
    _row := public.kit_full_order_sync_apply_participant(
      _kit_share_id,
      _participant.user_id,
      _actor,
      'Automatische Kit-Bestell-Synchronisation'
    );
    _results := _results || jsonb_build_array(_row);

    if (_row->>'status') = 'synced' and coalesce((_row->>'applied')::boolean, false) then
      _synced := _synced + 1;
    elsif (_row->>'status') = 'synced' then
      _ready := _ready + 1;
    else
      _pending := _pending + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'kitShareId', _kit_share_id,
    'participants', _results,
    'summary', jsonb_build_object(
      'appliedCount', _synced,
      'alreadySyncedCount', _ready,
      'pendingCount', _pending
    )
  );
end;
$$;

revoke all on function public.kit_full_order_sync_kit(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- kit_share_on_became_full — order sync BEFORE cart repricing
-- ---------------------------------------------------------------------------

create or replace function public.kit_share_on_became_full(_kit_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.kit_shares
  set completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where id = _kit_share_id;

  perform public.kit_full_order_sync_kit(_kit_share_id, null);

  perform set_config('kit.skip_customer_lock', 'on', true);
  perform public.kit_share_sync_all_participant_carts(_kit_share_id);
end;
$$;

revoke all on function public.kit_share_on_became_full(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- kit_share_refresh_status_locked — hook order sync on OPEN → FULL
-- ---------------------------------------------------------------------------

create or replace function public.kit_share_refresh_status_locked(_kit_share_id uuid)
returns public.kit_shares
language plpgsql
security definer
set search_path = public
as $$
declare
  _kit public.kit_shares;
  _prev_status text;
  _allocated integer;
  _new_status text;
begin
  select * into _kit
  from public.kit_shares
  where id = _kit_share_id
  for update;

  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.status in ('cancelled', 'ordered') then
    raise exception 'Dieses Kit kann nicht mehr verändert werden.' using errcode = 'P0001';
  end if;

  _prev_status := _kit.status;
  _allocated := public.kit_share_allocated_total(_kit_share_id);

  if _allocated > _kit.kit_size_vials then
    raise exception 'Die Kit Verteilung ist ungültig. Die Gesamtmenge überschreitet die Kitgröße.' using errcode = 'P0001';
  end if;

  _new_status := case
    when _allocated = _kit.kit_size_vials then 'full'
    else 'open'
  end;

  update public.kit_shares
  set status = _new_status,
      updated_at = now()
  where id = _kit_share_id
  returning * into _kit;

  if _new_status = 'full'
     and _prev_status is distinct from 'full'
     and public.kit_share_allocation_matches_size(_kit_share_id) then
    perform public.kit_share_on_became_full(_kit_share_id);
  end if;

  return _kit;
end;
$$;

revoke all on function public.kit_share_refresh_status_locked(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_sync_kit_full_orders — manual fallback (same validation)
-- ---------------------------------------------------------------------------

create or replace function public.admin_sync_kit_full_orders(_kit_share_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid;
begin
  _uid := public.assert_admin_kit_request();
  return public.kit_full_order_sync_kit(_kit_share_id, _uid);
end;
$$;

revoke all on function public.admin_sync_kit_full_orders(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_sync_kit_full_orders(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- kit_full_order_sync_summary — admin UI aggregate
-- ---------------------------------------------------------------------------

create or replace function public.kit_full_order_sync_summary(_kit_share_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _kit public.kit_shares;
  _participant record;
  _rows jsonb := '[]'::jsonb;
  _row jsonb;
  _synced integer := 0;
  _total integer := 0;
  _label text := 'not_applicable';
begin
  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found then
    return jsonb_build_object('label', 'error');
  end if;

  if _kit.status <> 'full' then
    return jsonb_build_object('label', 'not_applicable', 'syncedCount', 0, 'participantCount', 0);
  end if;

  for _participant in
    select user_id from public.kit_share_participants where kit_share_id = _kit_share_id
  loop
    _total := _total + 1;
    _row := public.kit_full_order_sync_participant_status(_kit_share_id, _participant.user_id);
    _rows := _rows || jsonb_build_array(_row);
    if (_row->>'status') = 'synced' then
      _synced := _synced + 1;
    end if;
  end loop;

  if _total = 0 then
    _label := 'not_applicable';
  elsif _synced = _total then
    _label := 'all_synced';
  elsif _synced > 0 then
    _label := 'partial_synced';
  elsif exists (
    select 1 from jsonb_array_elements(_rows) e
    where e.value->>'status' in ('pending_ambiguous_order', 'pending_no_order', 'pending_no_price')
  ) then
    _label := 'needs_attention';
  else
    _label := 'pending';
  end if;

  return jsonb_build_object(
    'label', _label,
    'syncedCount', _synced,
    'participantCount', _total,
    'participants', _rows
  );
end;
$$;

revoke all on function public.kit_full_order_sync_summary(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_kit_request_list_item + admin_get_kit_request — expose sync summary
-- ---------------------------------------------------------------------------

create or replace function public.admin_kit_request_list_item(_kit public.kit_shares)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _product public.products;
  _allocated integer;
  _creator_username text;
  _participant_count integer;
  _sync jsonb;
begin
  _product := public.kit_share_catalog_product(_kit);
  _allocated := public.kit_share_allocated_total(_kit.id);

  select username into _creator_username
  from public.profiles
  where id = _kit.creator_user_id;

  select count(*)::integer into _participant_count
  from public.kit_share_participants
  where kit_share_id = _kit.id;

  _sync := public.kit_full_order_sync_summary(_kit.id);

  return jsonb_build_object(
    'id', _kit.id,
    'productId', public.kit_request_catalog_id(_kit),
    'productName', coalesce(_product.name, _kit.vendor_code, 'Unbekannt'),
    'productCode', coalesce(_product.code, _kit.vendor_code),
    'variantLabel', coalesce(nullif(trim(_product.dosage_vial), ''), _product.code, _kit.vendor_code),
    'category', public.kit_request_shop_category(_product),
    'kitSizeVials', _kit.kit_size_vials,
    'allocatedTotal', _allocated,
    'remainingVials', greatest(_kit.kit_size_vials - _allocated, 0),
    'status', _kit.status,
    'creatorUsername', coalesce(nullif(trim(_creator_username), ''), 'Teilnehmer'),
    'participantCount', coalesce(_participant_count, 0),
    'createdAt', _kit.created_at,
    'updatedAt', _kit.updated_at,
    'expiresAt', _kit.expires_at,
    'completedAt', _kit.completed_at,
    'note', _kit.note,
    'shopArea', _kit.shop_area,
    'vendorCode', _kit.vendor_code,
    'areaProductId', _kit.area_product_id,
    'masterProductId', _kit.product_id,
    'orderSyncLabel', _sync->>'label',
    'orderSyncSyncedCount', (_sync->>'syncedCount')::integer,
    'orderSyncParticipantCount', (_sync->>'participantCount')::integer
  );
end;
$$;

revoke all on function public.admin_kit_request_list_item(public.kit_shares)
  from public, anon, authenticated;

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

  select exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit.id and ordered_at is not null
  ) into _any_ordered;

  select count(*)::integer into _cart_lines
  from public.cart_items
  where kit_share_id = _kit.id;

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
    'canEditMeta', _kit.status in ('open', 'full', 'expired'),
    'canEditQuantities', _kit.status = 'open' and not coalesce(_any_ordered, false),
    'canCancel', _kit.status = 'open' and not coalesce(_any_ordered, false),
    'canChangeProduct', false
  );
end;
$$;

revoke all on function public.admin_get_kit_request(uuid) from public, anon;
grant execute on function public.admin_get_kit_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_set_kit_request_distribution — order sync before cart when newly full
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
  _total integer := 0;
  _seen uuid[] := '{}'::uuid[];
  _existing public.kit_share_participants;
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
    raise exception 'Dieses Kit wurde bereits bestellt und kann nicht mehr umverteilt werden.'
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
  from public, anon, authenticated;
grant execute on function public.admin_set_kit_request_distribution(uuid, jsonb)
  to authenticated;
