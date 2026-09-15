-- 0102_historical_kit_sync_recovery.sql
-- Admin preview + apply for historical kit sync gap order lines (0092 revision/audit extension).
-- Does not modify 0092 file. Additive RPCs only.

-- ---------------------------------------------------------------------------
-- kit_sync_recovery_historical_cart_template — peer or late-sync cart snapshot
-- ---------------------------------------------------------------------------

create or replace function public.kit_sync_recovery_historical_cart_template(
  _order_id uuid,
  _kit_share_id uuid,
  _participant_user_id uuid
)
returns public.cart_items
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _order public.orders;
  _kit public.kit_shares;
  _participant public.kit_share_participants;
  _template public.cart_items;
  _completed timestamptz;
  _peer_units numeric[];
  _qty_units numeric[];
  _peer_order_qty_units numeric[];
  _late public.cart_items;
  _markup numeric(8, 4);
  _base_unit numeric(12, 4);
  _derived_unit numeric(12, 4);
  _product public.products;
begin
  select * into _order from public.orders where id = _order_id;
  if not found then
    return null;
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found then
    return null;
  end if;

  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _participant_user_id;

  if not found then
    return null;
  end if;

  _completed := _kit.completed_at;
  if _completed is null then
    return null;
  end if;

  -- Peer snapshots at full event (±2h), before customer checkout
  select array_agg(distinct ci.unit_price_usd_snapshot order by ci.unit_price_usd_snapshot)
  into _peer_units
  from public.cart_items ci
  join public.carts c on c.id = ci.cart_id
  where ci.kit_share_id = _kit_share_id
    and c.user_id is distinct from _participant_user_id
    and ci.price_snapshot_at >= _completed - interval '2 hours'
    and ci.price_snapshot_at <= _completed + interval '2 hours'
    and ci.created_at <= _order.submitted_at;

  -- Same participant quantity peers at full window
  select array_agg(distinct ci.unit_price_usd_snapshot order by ci.unit_price_usd_snapshot)
  into _qty_units
  from public.cart_items ci
  join public.carts c on c.id = ci.cart_id
  join public.kit_share_participants ksp
    on ksp.kit_share_id = ci.kit_share_id and ksp.user_id = c.user_id
  where ci.kit_share_id = _kit_share_id
    and ksp.quantity = _participant.quantity
    and ci.price_snapshot_at >= _completed - interval '2 hours'
    and ci.price_snapshot_at <= _completed + interval '2 hours'
    and ci.created_at <= _order.submitted_at;

  if _qty_units is not null and array_length(_qty_units, 1) = 1 then
    select ci.* into _template
    from public.cart_items ci
    join public.carts c on c.id = ci.cart_id
    join public.kit_share_participants ksp
      on ksp.kit_share_id = ci.kit_share_id and ksp.user_id = c.user_id
    where ci.kit_share_id = _kit_share_id
      and ksp.quantity = _participant.quantity
      and ci.unit_price_usd_snapshot = _qty_units[1]
      and ci.price_snapshot_at >= _completed - interval '2 hours'
      and ci.price_snapshot_at <= _completed + interval '2 hours'
      and ci.created_at <= _order.submitted_at
    order by ci.price_snapshot_at asc
    limit 1;

    if found then
      return _template;
    end if;
  end if;

  if _peer_units is not null and array_length(_peer_units, 1) = 1 then
    select ci.* into _template
    from public.cart_items ci
    where ci.kit_share_id = _kit_share_id
      and ci.unit_price_usd_snapshot = _peer_units[1]
      and ci.price_snapshot_at >= _completed - interval '2 hours'
      and ci.price_snapshot_at <= _completed + interval '2 hours'
      and ci.created_at <= _order.submitted_at
    order by ci.price_snapshot_at asc
    limit 1;

    if found then
      return _template;
    end if;
  end if;

  -- Customer late-sync cart line (after checkout) — single unambiguous anchor
  select ci.* into _late
  from public.cart_items ci
  join public.carts c on c.id = ci.cart_id and c.user_id = _participant_user_id
  where ci.kit_share_id = _kit_share_id
    and ci.created_at > _order.submitted_at
  order by ci.created_at asc
  limit 1;

  if _late.id is not null then
    if _peer_units is null or not exists (
      select 1 from unnest(_peer_units) as u
      where u is distinct from _late.unit_price_usd_snapshot
    ) then
      return _late;
    end if;
  end if;

  -- Mixed participant role snapshots at full: anchor catalog from lowest peer cart unit + participant markup
  if _peer_units is not null and array_length(_peer_units, 1) > 1 then
    _product := public.kit_share_catalog_product(_kit);
    _base_unit := _peer_units[1];
    _markup := public.markup_percent_for_area(_participant_user_id, _kit.shop_area, _product.id);
    _derived_unit := public.apply_role_markup(_base_unit, _markup);

    select ci.* into _template
    from public.cart_items ci
    where ci.kit_share_id = _kit_share_id
      and ci.unit_price_usd_snapshot = _base_unit
      and ci.price_snapshot_at >= _completed - interval '2 hours'
      and ci.price_snapshot_at <= _completed + interval '2 hours'
      and ci.created_at <= _order.submitted_at
    order by ci.price_snapshot_at asc
    limit 1;

    if found then
      _template.unit_price_usd_snapshot := _derived_unit;
      _template.normal_price_usd_snapshot := _base_unit;
      if _template.bulk_price_usd_snapshot is not null then
        _template.bulk_price_usd_snapshot := public.apply_role_markup(_template.bulk_price_usd_snapshot, _markup);
      end if;
      _template.eur_value_snapshot := round((_derived_unit * _participant.quantity)::numeric, 2);
      return _template;
    end if;
  end if;

  -- Peer orders: same kit, participant quantity match, checkout between full and this order
  select array_agg(distinct oi.unit_price_usd_snapshot order by oi.unit_price_usd_snapshot)
  into _peer_order_qty_units
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.kit_share_participants ksp
    on ksp.order_id = o.id
    and ksp.kit_share_id = _kit_share_id
    and ksp.quantity = _participant.quantity
  where o.submitted_at >= _completed
    and o.submitted_at <= _order.submitted_at
    and o.id is distinct from _order_id
    and (
      oi.kit_share_id_snapshot = _kit_share_id
      or (
        oi.kit_share_id_snapshot is null
        and oi.product_code_snapshot = coalesce(
          (select p.code from public.products p where p.id = _kit.product_id),
          _kit.vendor_code
        )
      )
    );

  if _peer_order_qty_units is not null and array_length(_peer_order_qty_units, 1) = 1 then
    select ci.* into _template
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.kit_share_participants ksp
      on ksp.order_id = o.id
      and ksp.kit_share_id = _kit_share_id
      and ksp.quantity = _participant.quantity
    join lateral (
      select
        oi.id as id,
        o.cart_id as cart_id,
        0::integer as position,
        oi.product_id as product_id,
        oi.product_code_snapshot as product_code_input,
        oi.product_code_snapshot,
        oi.product_name_snapshot,
        _participant.quantity::numeric as quantity,
        oi.unit_price_usd_snapshot,
        oi.exchange_rate_snapshot,
        round((oi.unit_price_usd_snapshot * _participant.quantity)::numeric, 2) as eur_value_snapshot,
        o.submitted_at as price_snapshot_at,
        'resolved'::text as resolution_status,
        null::text as note,
        1::integer as version,
        o.submitted_at as created_at,
        o.submitted_at as updated_at,
        oi.normal_price_usd_snapshot,
        oi.bulk_price_usd_snapshot,
        oi.bulk_price_min_quantity_snapshot,
        oi.applied_price_tier,
        _kit_share_id as kit_share_id,
        oi.product_code_snapshot as vendor_code,
        _kit.shop_area as shop_area,
        null::uuid as submitted_order_id
    ) ci on true
    where o.submitted_at >= _completed
      and o.submitted_at <= _order.submitted_at
      and o.id is distinct from _order_id
      and (
        oi.kit_share_id_snapshot = _kit_share_id
        or (
          oi.kit_share_id_snapshot is null
          and oi.product_code_snapshot = coalesce(
            (select p.code from public.products p where p.id = _kit.product_id),
            _kit.vendor_code
          )
        )
      )
      and oi.unit_price_usd_snapshot = _peer_order_qty_units[1]
    order by o.submitted_at desc
    limit 1;

    if found then
      return _template;
    end if;
  end if;

  -- Same kit peer orders: single distinct unit among participants with any quantity
  if (
    select count(distinct oi.unit_price_usd_snapshot)
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.kit_share_participants ksp
      on ksp.order_id = o.id and ksp.kit_share_id = _kit_share_id
    where o.submitted_at >= _completed
      and o.submitted_at <= _order.submitted_at
      and o.id is distinct from _order_id
      and (
        oi.kit_share_id_snapshot = _kit_share_id
        or oi.product_code_snapshot = coalesce(
          (select p.code from public.products p where p.id = _kit.product_id),
          _kit.vendor_code
        )
      )
  ) = 1 then
    select ci.* into _template
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.kit_share_participants ksp
      on ksp.order_id = o.id and ksp.kit_share_id = _kit_share_id
    join lateral (
      select
        oi.id as id,
        o.cart_id as cart_id,
        0::integer as position,
        oi.product_id as product_id,
        oi.product_code_snapshot as product_code_input,
        oi.product_code_snapshot,
        oi.product_name_snapshot,
        _participant.quantity::numeric as quantity,
        oi.unit_price_usd_snapshot,
        oi.exchange_rate_snapshot,
        round((oi.unit_price_usd_snapshot * _participant.quantity)::numeric, 2) as eur_value_snapshot,
        o.submitted_at as price_snapshot_at,
        'resolved'::text as resolution_status,
        null::text as note,
        1::integer as version,
        o.submitted_at as created_at,
        o.submitted_at as updated_at,
        oi.normal_price_usd_snapshot,
        oi.bulk_price_usd_snapshot,
        oi.bulk_price_min_quantity_snapshot,
        oi.applied_price_tier,
        _kit_share_id as kit_share_id,
        oi.product_code_snapshot as vendor_code,
        _kit.shop_area as shop_area,
        null::uuid as submitted_order_id
    ) ci on true
    where o.submitted_at >= _completed
      and o.submitted_at <= _order.submitted_at
      and o.id is distinct from _order_id
    order by o.submitted_at desc
    limit 1;

    if found then
      return _template;
    end if;
  end if;

  return null;
end;
$$;

revoke all on function public.kit_sync_recovery_historical_cart_template(uuid, uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- kit_sync_recovery_evaluate — eligibility + pricing (read-only)
-- ---------------------------------------------------------------------------

create or replace function public.kit_sync_recovery_evaluate(
  _order_id uuid,
  _kit_share_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _admin uuid := auth.uid();
  _order public.orders;
  _kit public.kit_shares;
  _participant public.kit_share_participants;
  _product public.products;
  _template public.cart_items;
  _qty numeric(12, 3);
  _unit numeric(12, 4);
  _line_usd numeric(12, 2);
  _line_eur numeric(12, 2);
  _eur_ok boolean := true;
  _status text := 'recovery_candidate';
  _reason text;
  _cart_before timestamptz;
begin
  if _admin is null or not public.has_role(_admin, 'admin') then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  select * into _order from public.orders where id = _order_id;
  if not found then
    raise exception 'Bestellung wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _order.order_number = 'CW-2026-000063' then
    return jsonb_build_object(
      'status', 'recovery_blocked',
      'reason', 'HeyAnna5 / CW-2026-000063 ist von Recovery ausgeschlossen.'
    );
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found then
    raise exception 'Kit wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _order.user_id;

  if not found then
    return jsonb_build_object('status', 'recovery_blocked', 'reason', 'Kein Kit-Teilnehmer für diese Bestellung.');
  end if;

  if _participant.ordered_at is not null or _participant.order_id is not null then
    return jsonb_build_object('status', 'recovery_blocked', 'reason', 'Teilnehmer ist bereits bestellt.');
  end if;

  if _kit.status = 'cancelled' then
    return jsonb_build_object('status', 'recovery_blocked', 'reason', 'Kit ist storniert.');
  end if;

  if _kit.completed_at is null then
    return jsonb_build_object('status', 'recovery_blocked', 'reason', 'Kit-Full-Zeitpunkt nicht belegbar.');
  end if;

  if _order.submitted_at <= _kit.completed_at then
    return jsonb_build_object('status', 'recovery_blocked', 'reason', 'Checkout lag nicht nach Kit-Full.');
  end if;

  if public.kit_share_allocated_total(_kit_share_id) <> _kit.kit_size_vials then
    return jsonb_build_object('status', 'recovery_blocked', 'reason', 'Kit war nicht vollständig (Sum ≠ Size).');
  end if;

  if exists (
    select 1 from public.order_items oi
    where oi.order_id = _order_id and oi.kit_share_id_snapshot = _kit_share_id
  ) then
    return jsonb_build_object('status', 'recovery_already_applied', 'reason', 'Kit-Position existiert bereits.');
  end if;

  _product := public.kit_share_catalog_product(_kit);
  if _product.id is null and coalesce(_kit.vendor_code, '') = '' then
    return jsonb_build_object('status', 'recovery_blocked', 'reason', 'Produktidentität nicht auflösbar.');
  end if;

  if exists (
    select 1 from public.order_items oi
    where oi.order_id = _order_id
      and oi.kit_share_id_snapshot is null
      and oi.product_code_snapshot = coalesce(_product.code, _kit.vendor_code)
      and oi.quantity = _participant.quantity
  ) then
    return jsonb_build_object('status', 'recovery_blocked', 'reason', 'Entsprechende Positionszeile existiert bereits (Legacy).');
  end if;

  select min(ci.created_at) into _cart_before
  from public.cart_items ci
  where ci.cart_id = _order.cart_id and ci.kit_share_id = _kit_share_id;

  if _cart_before is not null and _cart_before <= _order.submitted_at then
    return jsonb_build_object(
      'status', 'recovery_blocked',
      'reason', 'Checkout-Cart-Line für dieses Kit war vorhanden — kein Sync-Gap-Recovery-Fall.'
    );
  end if;

  _template := public.kit_sync_recovery_historical_cart_template(_order_id, _kit_share_id, _order.user_id);
  if _template is null or _template.unit_price_usd_snapshot is null then
    return jsonb_build_object('status', 'recovery_blocked', 'reason', 'Historischer Preis nicht eindeutig rekonstruierbar.');
  end if;

  _qty := _participant.quantity;
  _unit := _template.unit_price_usd_snapshot;
  _line_usd := round((_qty * _unit)::numeric, 2);

  if _order.exchange_rate is not null and _order.exchange_rate > 0 then
    _line_eur := round((_line_usd * _order.exchange_rate)::numeric, 2);
  else
    _line_eur := null;
    _eur_ok := false;
  end if;

  _status := 'recovery_verified';

  return jsonb_build_object(
    'status', _status,
    'orderId', _order.id,
    'orderNumber', _order.order_number,
    'customerUserId', _order.user_id,
    'kitShareId', _kit_share_id,
    'productCode', coalesce(_product.code, _kit.vendor_code),
    'productName', coalesce(_product.name, _template.product_name_snapshot),
    'dosageVial', _product.dosage_vial,
    'kitSizeVials', _kit.kit_size_vials,
    'participantQuantity', _qty,
    'kitCompletedAt', _kit.completed_at,
    'checkoutAt', _order.submitted_at,
    'participantJoinedAt', _participant.created_at,
    'historicalUnitPriceUsd', _unit,
    'historicalNormalUnitUsd', _template.normal_price_usd_snapshot,
    'historicalBulkUnitUsd', _template.bulk_price_usd_snapshot,
    'appliedPriceTier', _template.applied_price_tier,
    'bulkPriceMinQuantity', _template.bulk_price_min_quantity_snapshot,
    'missingLineTotalUsd', _line_usd,
    'missingLineTotalEur', _line_eur,
    'currentOrderTotalUsd', _order.total_usd,
    'currentOrderTotalEur', _order.total_eur,
    'newOrderTotalUsd', round((_order.total_usd + _line_usd)::numeric, 2),
    'newOrderTotalEur', case when _eur_ok and _order.total_eur is not null
      then round((_order.total_eur + _line_eur)::numeric, 2) else null end,
    'exchangeRate', _order.exchange_rate,
    'expectedRevision', coalesce(_order.revision_number, 0),
    'priceSource', jsonb_build_object(
      'cartItemId', _template.id,
      'priceSnapshotAt', _template.price_snapshot_at,
      'cartCreatedAt', _template.created_at
    ),
    'recoveryReason', 'Kit war beim Checkout bereits vollständig; der persönliche Kit-Anteil wurde wegen einer historischen Sync-Lücke nicht rechtzeitig in den Warenkorb übernommen.'
  );
end;
$$;

revoke all on function public.kit_sync_recovery_evaluate(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.kit_sync_recovery_evaluate(uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- admin_apply_historical_kit_sync_recovery
-- ---------------------------------------------------------------------------

create or replace function public.admin_apply_historical_kit_sync_recovery(
  _order_id uuid,
  _expected_revision integer,
  _kit_share_id uuid,
  _reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _admin uuid := auth.uid();
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
begin
  if _admin is null or not public.has_role(_admin, 'admin') then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  _reason := nullif(trim(coalesce(_reason, '')), '');
  if _reason is null or char_length(_reason) < 3 then
    raise exception 'Bitte einen Korrekturgrund angeben (mind. 3 Zeichen).' using errcode = '22023';
  end if;

  _eval := public.kit_sync_recovery_evaluate(_order_id, _kit_share_id);
  if (_eval->>'status') is distinct from 'recovery_verified' then
    raise exception 'Recovery nicht möglich: %', coalesce(_eval->>'reason', _eval->>'status')
      using errcode = 'P0001';
  end if;

  select * into _order from public.orders where id = _order_id for update;
  if not found then
    raise exception 'Bestellung wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _order.status = 'cancelled' then
    raise exception 'Stornierte Bestellungen können nicht korrigiert werden.' using errcode = 'P0001';
  end if;

  _rev := coalesce(_order.revision_number, 0);
  if _expected_revision is distinct from _rev then
    raise exception 'Diese Bestellung wurde inzwischen geändert. Bitte erneut laden.'
      using errcode = 'P0001';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id;
  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _order.user_id;

  _product := public.kit_share_catalog_product(_kit);
  _template := public.kit_sync_recovery_historical_cart_template(_order_id, _kit_share_id, _order.user_id);

  _qty := _participant.quantity;
  _unit := _template.unit_price_usd_snapshot;
  _line_usd := round((_qty * _unit)::numeric, 2);

  if _order.exchange_rate is not null and _order.exchange_rate > 0 then
    _line_eur := round((_line_usd * _order.exchange_rate)::numeric, 2);
  else
    _line_eur := null;
    _eur_ok := false;
  end if;

  _prev_usd := _order.total_usd;
  _prev_eur := _order.total_eur;

  select coalesce(max(position), -1) + 1 into _position
  from public.order_items where order_id = _order_id;

  insert into public.order_items (
    order_id, position, product_id,
    kit_share_id_snapshot, kit_size_vials_snapshot, kit_participant_quantity_snapshot,
    product_code_snapshot, product_name_snapshot, dosage_vial_snapshot, description_snapshot,
    normal_price_usd_snapshot, bulk_price_usd_snapshot, bulk_price_min_quantity_snapshot,
    applied_price_tier, unit_price_usd_snapshot, quantity, line_total_usd,
    exchange_rate_snapshot, eur_value_snapshot
  )
  values (
    _order_id, _position, _product.id,
    _kit_share_id, _kit.kit_size_vials, _qty,
    coalesce(_product.code, _kit.vendor_code), coalesce(_product.name, _template.product_name_snapshot),
    _product.dosage_vial, _product.description,
    _template.normal_price_usd_snapshot, _template.bulk_price_usd_snapshot,
    _template.bulk_price_min_quantity_snapshot, _template.applied_price_tier,
    _unit, _qty, _line_usd,
    _order.exchange_rate, _line_eur
  )
  returning id into _order_item_id;

  select coalesce(sum(line_total_usd), 0), coalesce(sum(eur_value_snapshot), 0)
  into _new_usd, _new_eur
  from public.order_items where order_id = _order_id;

  if exists (
    select 1 from public.order_items
    where order_id = _order_id and (eur_value_snapshot is null or exchange_rate_snapshot is null)
  ) then
    _eur_ok := false;
  end if;

  update public.orders
  set total_usd = _new_usd,
      total_eur = case when _eur_ok then _new_eur else null end,
      revision_number = _rev + 1,
      updated_at = now()
  where id = _order_id;

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
    _order_item_id, _order_id,
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
    _order_id, _rev + 1, _admin, _reason,
    _prev_usd, _new_usd,
    _prev_eur, case when _eur_ok then _new_eur else null end,
    round((_new_usd - _prev_usd)::numeric, 2),
    case when _eur_ok and _prev_eur is not null and _new_eur is not null
      then round((_new_eur - _prev_eur)::numeric, 2) else null end,
    jsonb_build_object(
      'lines', jsonb_build_array(jsonb_build_object(
        'action', 'add_historical_kit_line',
        'orderItemId', _order_item_id,
        'kitShareId', _kit_share_id,
        'productCode', coalesce(_product.code, _kit.vendor_code),
        'quantity', _qty,
        'unitPriceUsd', _unit,
        'lineTotalUsd', _line_usd
      ))
    )
  );

  select username into _username from public.profiles where id = _order.user_id;

  perform public.log_audit(
    _admin, 'order.add_historical_line', 'order', _order_id, null,
    jsonb_build_object(
      'orderNumber', _order.order_number,
      'customerUsername', _username,
      'kitShareId', _kit_share_id,
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
    'orderId', _order_id,
    'orderItemId', _order_item_id,
    'revisionNumber', _rev + 1,
    'previousTotalUsd', _prev_usd,
    'newTotalUsd', _new_usd,
    'differenceUsd', round((_new_usd - _prev_usd)::numeric, 2),
    'missingLineTotalUsd', _line_usd,
    'missingLineTotalEur', _line_eur
  );
end;
$$;

revoke all on function public.admin_apply_historical_kit_sync_recovery(uuid, integer, uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_apply_historical_kit_sync_recovery(uuid, integer, uuid, text)
  to authenticated;
