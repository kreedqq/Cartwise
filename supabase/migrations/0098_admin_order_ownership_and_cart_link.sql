-- 0098: Admin order ownership transfer, provable cart submitted_order_id link, delete preflight.
-- Does not modify 0091–0097. Additive only.

create or replace function public.admin_transfer_orders(
  _from_user_id uuid,
  _to_user_id uuid,
  _order_ids uuid[],
  _reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _order_id uuid;
  _moved uuid[] := '{}'::uuid[];
  _numbers text[] := '{}'::text[];
  _row record;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if not public.has_role(_uid, 'admin') then
    raise exception 'Nur Admins dürfen Bestellungen übertragen.' using errcode = '42501';
  end if;
  if _from_user_id is null or _to_user_id is null then
    raise exception 'Benutzer fehlt.' using errcode = '22023';
  end if;
  if _from_user_id = _to_user_id then
    raise exception 'Quell- und Zielbenutzer müssen unterschiedlich sein.' using errcode = '22023';
  end if;
  if _order_ids is null or array_length(_order_ids, 1) is null then
    raise exception 'Keine Bestellungen angegeben.' using errcode = '22023';
  end if;
  if _reason is null or char_length(trim(_reason)) < 3 then
    raise exception 'Bitte einen Grund angeben (mindestens 3 Zeichen).' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = _from_user_id) then
    raise exception 'Quellbenutzer wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from auth.users where id = _to_user_id) then
    raise exception 'Zielbenutzer wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  foreach _order_id in array _order_ids
  loop
    select o.id, o.order_number, o.user_id
    into _row
    from public.orders o
    where o.id = _order_id
    for update;

    if not found then
      raise exception 'Bestellung % wurde nicht gefunden.', _order_id using errcode = 'P0002';
    end if;
    if _row.user_id is distinct from _from_user_id then
      raise exception 'Bestellung % gehört nicht zum Quellbenutzer.', _row.order_number using errcode = 'P0001';
    end if;
  end loop;

  foreach _order_id in array _order_ids
  loop
    update public.orders
    set user_id = _to_user_id,
        updated_at = now()
    where id = _order_id
    returning order_number into _row.order_number;

    _moved := array_append(_moved, _order_id);
    _numbers := array_append(_numbers, _row.order_number);

    perform public.log_audit(
      _uid,
      'order.owner_transfer',
      'order',
      _order_id,
      jsonb_build_object('userId', _from_user_id),
      jsonb_build_object(
        'userId', _to_user_id,
        'fromUserId', _from_user_id,
        'toUserId', _to_user_id,
        'reason', trim(_reason),
        'orderNumber', _row.order_number
      )
    );
  end loop;

  return jsonb_build_object(
    'fromUserId', _from_user_id,
    'toUserId', _to_user_id,
    'orderIds', _moved,
    'orderNumbers', _numbers,
    'count', coalesce(array_length(_moved, 1), 0)
  );
end;
$$;

revoke all on function public.admin_transfer_orders(uuid, uuid, uuid[], text) from public, anon;
grant execute on function public.admin_transfer_orders(uuid, uuid, uuid[], text) to authenticated;

create or replace function public.admin_link_cart_item_submitted_order(
  _cart_item_id uuid,
  _reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _ci public.cart_items;
  _cart public.carts;
  _part public.kit_share_participants;
  _before jsonb;
  _after jsonb;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if not public.has_role(_uid, 'admin') then
    raise exception 'Nur Admins dürfen Cart-Verknüpfungen reparieren.' using errcode = '42501';
  end if;
  if _reason is null or char_length(trim(_reason)) < 3 then
    raise exception 'Bitte einen Grund angeben (mindestens 3 Zeichen).' using errcode = '22023';
  end if;

  select * into _ci from public.cart_items where id = _cart_item_id for update;
  if not found then
    raise exception 'Cart-Zeile wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if _ci.kit_share_id is null then
    raise exception 'Nur Kit-Cart-Zeilen können verknüpft werden.' using errcode = '22023';
  end if;
  if _ci.submitted_order_id is not null then
    raise exception 'Cart-Zeile ist bereits mit einer Bestellung verknüpft.' using errcode = 'P0001';
  end if;

  select * into _cart from public.carts where id = _ci.cart_id;
  if not found then
    raise exception 'Warenkorb wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  select * into _part
  from public.kit_share_participants
  where kit_share_id = _ci.kit_share_id
    and user_id = _cart.user_id;

  if not found then
    raise exception 'Kein passender Kit-Teilnehmer für diese Cart-Zeile.' using errcode = 'P0002';
  end if;
  if _part.order_id is null or _part.ordered_at is null then
    raise exception 'Teilnehmer hat keine eindeutige abgeschlossene Bestellung.' using errcode = 'P0001';
  end if;
  if _part.quantity is distinct from _ci.quantity then
    raise exception 'Menge der Cart-Zeile stimmt nicht mit dem Kit-Teilnehmer überein.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.orders o where o.id = _part.order_id and o.user_id = _cart.user_id
  ) then
    raise exception 'Bestellung des Teilnehmers gehört nicht zum Cart-Besitzer.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.order_items oi
    where oi.order_id = _part.order_id
      and oi.kit_share_id_snapshot = _ci.kit_share_id
  ) then
    null;
  elsif not exists (
    select 1
    from public.order_items oi
    where oi.order_id = _part.order_id
      and oi.product_code_snapshot = _ci.product_code_snapshot
      and oi.quantity = _ci.quantity
  ) then
    raise exception 'Keine eindeutige Order-Position für diese Kit-Cart-Zeile gefunden.' using errcode = 'P0001';
  end if;

  _before := jsonb_build_object(
    'cartItemId', _ci.id,
    'submittedOrderId', _ci.submitted_order_id,
    'kitShareId', _ci.kit_share_id,
    'orderId', _part.order_id
  );

  perform set_config('kit.skip_customer_lock', 'on', true);

  update public.cart_items
  set submitted_order_id = _part.order_id,
      updated_at = now()
  where id = _ci.id
  returning * into _ci;

  _after := jsonb_build_object(
    'cartItemId', _ci.id,
    'submittedOrderId', _ci.submitted_order_id,
    'kitShareId', _ci.kit_share_id
  );

  perform public.log_audit(
    _uid,
    'cart_item.link_submitted_order',
    'cart_item',
    _ci.id,
    _before,
    _after || jsonb_build_object('reason', trim(_reason))
  );

  return _after;
end;
$$;

revoke all on function public.admin_link_cart_item_submitted_order(uuid, text) from public, anon;
grant execute on function public.admin_link_cart_item_submitted_order(uuid, text) to authenticated;

create or replace function public.admin_preflight_user_delete(_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _orders integer := 0;
  _open_carts integer := 0;
  _kit_parts integer := 0;
  _blockers text[] := '{}'::text[];
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if not public.has_role(_uid, 'admin') then
    raise exception 'Nur Admins.' using errcode = '42501';
  end if;
  if _user_id is null then
    raise exception 'user_id fehlt.' using errcode = '22023';
  end if;

  select count(*) into _orders from public.orders where user_id = _user_id;
  select count(*) into _open_carts
  from public.carts
  where user_id = _user_id and deleted_at is null and status in ('draft', 'ready');
  select count(*) into _kit_parts from public.kit_share_participants where user_id = _user_id;

  if _orders > 0 then
    _blockers := array_append(
      _blockers,
      format('%s Bestellung(en) sind noch diesem Benutzer zugeordnet — zuerst übertragen oder admin_delete_user setzt user_id auf NULL.', _orders)
    );
  end if;

  return jsonb_build_object(
    'userId', _user_id,
    'orderCount', _orders,
    'openCartCount', _open_carts,
    'kitParticipantCount', _kit_parts,
    'canDeleteViaAdminRpc', true,
    'blockers', to_jsonb(_blockers),
    'note', 'admin_delete_user behält historische Bestellungen (user_id wird NULL), löscht Kit-Teilnahme und Auth-Account.'
  );
end;
$$;

revoke all on function public.admin_preflight_user_delete(uuid) from public, anon;
grant execute on function public.admin_preflight_user_delete(uuid) to authenticated;
