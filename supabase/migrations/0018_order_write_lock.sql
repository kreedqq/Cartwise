-- 0018_order_write_lock.sql
-- 0016 granted authenticated INSERT on orders/order_items so the SECURITY
-- INVOKER create_order() could write under the caller's RLS. That also let a
-- customer INSERT a fake order with an arbitrary total_usd (section 44/64/66).
-- Lock writes to the two RPCs (now SECURITY DEFINER) and leave clients with
-- SELECT only. set_order_status is likewise the only path that may UPDATE
-- an order (previously the admin UPDATE policy allowed changing totals).

revoke insert, update, delete on public.orders from authenticated;
grant select on public.orders to authenticated;

revoke insert, update, delete on public.order_items from authenticated;
grant select on public.order_items to authenticated;

revoke insert, update, delete on public.order_status_history from authenticated;
grant select on public.order_status_history to authenticated;

drop policy if exists "orders_insert_own" on public.orders;
drop policy if exists "orders_update_admin" on public.orders;
drop policy if exists "order_items_insert_own" on public.order_items;
drop policy if exists "order_status_history_insert_own_or_admin" on public.order_status_history;

-- Recreate create_order as SECURITY DEFINER. Body is unchanged from 0016:
-- it still keys everything off auth.uid() and never trusts client totals.
create or replace function public.create_order(_cart_id uuid, _note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _cart record;
  _item record;
  _order_id uuid;
  _order_number text;
  _position int := 0;
  _line_total numeric(12, 2);
  _total_usd numeric(14, 2) := 0;
  _total_eur numeric(14, 2) := 0;
  _eur_complete boolean := true;
  _line_count int;
  _rate numeric(12, 6);
  _latest_snapshot_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into _cart
  from public.carts
  where id = _cart_id and user_id = auth.uid() and deleted_at is null
  for update;

  if not found then
    raise exception 'Warenkorb wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _cart.status not in ('draft', 'ready') then
    raise exception 'Dieser Warenkorb wurde bereits bestellt oder ist archiviert.' using errcode = 'P0001';
  end if;

  select count(*) into _line_count
  from public.cart_items
  where cart_id = _cart_id
    and resolution_status = 'resolved'
    and unit_price_usd_snapshot is not null
    and quantity > 0;

  if _line_count = 0 then
    raise exception 'Der Warenkorb enthält keine bestellbaren Positionen.' using errcode = 'P0001';
  end if;

  insert into public.orders (user_id, cart_id, status, note, total_usd, total_eur, exchange_rate, submitted_at)
  values (auth.uid(), _cart_id, 'pending', nullif(trim(coalesce(_note, '')), ''), 0, null, null, now())
  returning id, order_number into _order_id, _order_number;

  for _item in
    select ci.*, p.dosage_vial as product_dosage_vial, p.description as product_description
    from public.cart_items ci
    left join public.products p on p.id = ci.product_id
    where ci.cart_id = _cart_id
      and ci.resolution_status = 'resolved'
      and ci.unit_price_usd_snapshot is not null
      and ci.quantity > 0
    order by ci.position
  loop
    _line_total := round(_item.quantity * _item.unit_price_usd_snapshot, 2);
    _total_usd := _total_usd + _line_total;

    if _item.eur_value_snapshot is null then
      _eur_complete := false;
    else
      _total_eur := _total_eur + _item.eur_value_snapshot;
    end if;

    if _item.exchange_rate_snapshot is not null
       and (_latest_snapshot_at is null or _item.price_snapshot_at > _latest_snapshot_at) then
      _latest_snapshot_at := _item.price_snapshot_at;
      _rate := _item.exchange_rate_snapshot;
    end if;

    insert into public.order_items (
      order_id, position, product_id,
      product_code_snapshot, product_name_snapshot, dosage_vial_snapshot, description_snapshot,
      normal_price_usd_snapshot, bulk_price_usd_snapshot, bulk_price_min_quantity_snapshot,
      applied_price_tier, unit_price_usd_snapshot, quantity, line_total_usd,
      exchange_rate_snapshot, eur_value_snapshot
    )
    values (
      _order_id, _position, _item.product_id,
      coalesce(_item.product_code_snapshot, upper(trim(_item.product_code_input))),
      coalesce(_item.product_name_snapshot, _item.product_code_input),
      _item.product_dosage_vial, _item.product_description,
      coalesce(_item.normal_price_usd_snapshot, _item.unit_price_usd_snapshot),
      _item.bulk_price_usd_snapshot, _item.bulk_price_min_quantity_snapshot,
      coalesce(_item.applied_price_tier, 'normal'), _item.unit_price_usd_snapshot, _item.quantity, _line_total,
      _item.exchange_rate_snapshot, _item.eur_value_snapshot
    );

    _position := _position + 1;
  end loop;

  update public.orders
  set total_usd = _total_usd,
      total_eur = case when _eur_complete then _total_eur else null end,
      exchange_rate = _rate
  where id = _order_id;

  update public.carts
  set status = 'ordered', is_active_cart = false
  where id = _cart_id;

  insert into public.order_status_history (order_id, old_status, new_status, changed_by)
  values (_order_id, null, 'pending', auth.uid());

  perform public.log_audit(
    auth.uid(), 'order.create', 'order', _order_id, null,
    jsonb_build_object('orderNumber', _order_number, 'totalUsd', _total_usd, 'itemCount', _line_count)
  );

  return jsonb_build_object('orderId', _order_id, 'orderNumber', _order_number, 'totalUsd', _total_usd);
end;
$$;

create or replace function public.set_order_status(_order_id uuid, _status text, _admin_note text default null)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  _current public.orders;
  _updated public.orders;
  _clean_note text;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen den Bestellstatus ändern.' using errcode = '42501';
  end if;

  if _status not in ('pending', 'processing', 'confirmed', 'completed', 'cancelled') then
    raise exception 'Ungültiger Status.' using errcode = '22023';
  end if;

  select * into _current from public.orders where id = _order_id for update;
  if not found then
    raise exception 'Bestellung wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _current.status in ('completed', 'cancelled') and _status <> _current.status then
    raise exception 'Diese Bestellung ist abgeschlossen und kann nicht mehr geändert werden.' using errcode = 'P0001';
  end if;

  update public.orders
  set status = _status
  where id = _order_id
  returning * into _updated;

  _clean_note := nullif(trim(coalesce(_admin_note, '')), '');
  if _clean_note is not null then
    insert into public.order_admin_notes (order_id, note, updated_by, updated_at)
    values (_order_id, _clean_note, auth.uid(), now())
    on conflict (order_id) do update
      set note = excluded.note,
          updated_by = excluded.updated_by,
          updated_at = now();
  end if;

  if _status is distinct from _current.status then
    insert into public.order_status_history (order_id, old_status, new_status, changed_by)
    values (_order_id, _current.status, _status, auth.uid());

    perform public.log_audit(
      auth.uid(), 'order.status_changed', 'order', _order_id,
      jsonb_build_object('status', _current.status), jsonb_build_object('status', _status)
    );
  elsif _clean_note is not null then
    perform public.log_audit(
      auth.uid(), 'order.note_updated', 'order', _order_id, null, jsonb_build_object('adminNote', true)
    );
  end if;

  return _updated;
end;
$$;

revoke all on function public.create_order(uuid, text) from public;
grant execute on function public.create_order(uuid, text) to authenticated;

revoke all on function public.set_order_status(uuid, text, text) from public;
grant execute on function public.set_order_status(uuid, text, text) to authenticated;
