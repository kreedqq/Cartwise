-- 0103_fix_historical_kit_recovery_role_join.sql
-- Fix user_customer_roles join column in admin_apply_historical_kit_sync_recovery (role_id, not customer_role_id).

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
