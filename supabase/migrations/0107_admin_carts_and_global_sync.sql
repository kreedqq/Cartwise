-- 0107: Admin open-cart management + global orders/carts sync orchestrator.
-- Reuses create_order, admin_insert_catalog_cart_line, kit_full_order_sync_kit, admin_refresh_open_cart_prices.

-- ---------------------------------------------------------------------------
-- admin_list_open_carts
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_open_carts(
  _shop_area text default null,
  _search text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _rows jsonb := '[]'::jsonb;
  _rec record;
  _term text := nullif(lower(btrim(coalesce(_search, ''))), '');
begin
  perform public.assert_admin_authenticated();

  for _rec in
    select
      c.id as cart_id,
      c.user_id,
      coalesce(nullif(btrim(p.username), ''), '—') as username,
      coalesce(c.note, public.cart_title(p.username, 1)) as cart_name,
      c.status,
      c.updated_at,
      coalesce(cs.item_count, 0)::integer as item_count,
      coalesce(cs.total_usd, 0) as total_usd,
      coalesce(cs.total_eur, null) as total_eur,
      (
        select coalesce(array_agg(distinct ci.shop_area order by ci.shop_area), '{}'::text[])
        from public.cart_items ci
        where ci.cart_id = c.id
          and ci.submitted_order_id is null
          and ci.quantity > 0
      ) as shop_areas,
      exists (
        select 1 from public.cart_items ci
        where ci.cart_id = c.id
          and ci.kit_share_id is not null
          and ci.submitted_order_id is null
          and ci.quantity > 0
      ) as has_kit,
      exists (
        select 1 from public.cart_items ci
        where ci.cart_id = c.id and ci.submitted_order_id is not null
      ) as has_submitted_lines
    from public.carts c
    join public.profiles p on p.id = c.user_id
    left join public.cart_summaries cs on cs.cart_id = c.id
    where c.deleted_at is null
      and exists (
        select 1 from public.cart_items ci
        where ci.cart_id = c.id
          and ci.submitted_order_id is null
          and ci.quantity > 0
      )
    order by c.updated_at desc
  loop
    if _shop_area is not null and btrim(_shop_area) <> ''
       and not (_shop_area = any(_rec.shop_areas)) then
      continue;
    end if;
    if _term is not null
       and position(_term in lower(_rec.username)) = 0
       and position(_term in lower(_rec.cart_name)) = 0 then
      continue;
    end if;
    _rows := _rows || jsonb_build_array(to_jsonb(_rec));
  end loop;

  return _rows;
end;
$$;

revoke all on function public.admin_list_open_carts(text, text) from public, anon;
grant execute on function public.admin_list_open_carts(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_get_open_cart_detail
-- ---------------------------------------------------------------------------

create or replace function public.admin_get_open_cart_detail(_cart_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _cart public.carts;
  _items jsonb := '[]'::jsonb;
  _rec record;
begin
  perform public.assert_admin_authenticated();

  select * into _cart from public.carts where id = _cart_id;
  if not found then
    raise exception 'Warenkorb wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  for _rec in
    select
      ci.*,
      ks.status as kit_status,
      ks.kit_size_vials as kit_size_vials
    from public.cart_items ci
    left join public.kit_shares ks on ks.id = ci.kit_share_id
    where ci.cart_id = _cart_id
      and ci.submitted_order_id is null
    order by ci.position
  loop
    _items := _items || jsonb_build_array(to_jsonb(_rec));
  end loop;

  return jsonb_build_object(
    'cart', to_jsonb(_cart),
    'customer', (
      select jsonb_build_object(
        'userId', p.id,
        'username', p.username
      )
      from public.profiles p
      where p.id = _cart.user_id
    ),
    'summary', (
      select to_jsonb(cs) from public.cart_summaries cs where cs.cart_id = _cart_id
    ),
    'items', _items
  );
end;
$$;

revoke all on function public.admin_get_open_cart_detail(uuid) from public, anon;
grant execute on function public.admin_get_open_cart_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_update_open_cart_item_quantity
-- ---------------------------------------------------------------------------

create or replace function public.admin_update_open_cart_item_quantity(
  _cart_item_id uuid,
  _quantity numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _admin uuid;
  _item public.cart_items;
  _cart public.carts;
  _before jsonb;
begin
  _admin := public.assert_admin_authenticated();

  if _quantity is null or _quantity <= 0 then
    raise exception 'Ungültige Menge.' using errcode = '22023';
  end if;

  select * into _item from public.cart_items where id = _cart_item_id for update;
  if not found then
    raise exception 'Position wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if _item.submitted_order_id is not null then
    raise exception 'Bestellte Positionen können nicht geändert werden.' using errcode = 'P0001';
  end if;
  if _item.kit_share_id is not null then
    raise exception 'Kit-Anteile bitte über Kit Gesuche verwalten.' using errcode = 'P0001';
  end if;

  select * into _cart from public.carts where id = _item.cart_id for update;
  _before := to_jsonb(_item);

  update public.cart_items
  set quantity = _quantity,
      updated_at = now()
  where id = _cart_item_id;

  perform public.refresh_cart_selling_prices_for_user(_cart.id, _cart.user_id);

  select * into _item from public.cart_items where id = _cart_item_id;

  perform public.log_audit(
    _admin,
    'admin.cart.quantity_change',
    'cart_item',
    _cart_item_id,
    _before,
    to_jsonb(_item)
  );

  return to_jsonb(_item);
end;
$$;

revoke all on function public.admin_update_open_cart_item_quantity(uuid, numeric) from public, anon;
grant execute on function public.admin_update_open_cart_item_quantity(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_remove_open_cart_item
-- ---------------------------------------------------------------------------

create or replace function public.admin_remove_open_cart_item(_cart_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _admin uuid;
  _item public.cart_items;
  _before jsonb;
begin
  _admin := public.assert_admin_authenticated();

  select * into _item from public.cart_items where id = _cart_item_id for update;
  if not found then
    raise exception 'Position wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if _item.submitted_order_id is not null then
    raise exception 'Bestellte Positionen können nicht entfernt werden.' using errcode = 'P0001';
  end if;
  if _item.kit_share_id is not null then
    raise exception 'Kit-Anteile bitte über Kit Gesuche entfernen.' using errcode = 'P0001';
  end if;

  _before := to_jsonb(_item);
  delete from public.cart_items where id = _cart_item_id;

  perform public.log_audit(
    _admin,
    'admin.cart.item_remove',
    'cart_item',
    _cart_item_id,
    _before,
    null
  );
end;
$$;

revoke all on function public.admin_remove_open_cart_item(uuid) from public, anon;
grant execute on function public.admin_remove_open_cart_item(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_add_open_cart_catalog_line
-- ---------------------------------------------------------------------------

create or replace function public.admin_add_open_cart_catalog_line(
  _cart_id uuid,
  _shop_area text,
  _vendor_code text,
  _product_id uuid,
  _quantity numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _admin uuid;
  _cart public.carts;
  _item_id uuid;
  _item public.cart_items;
begin
  _admin := public.assert_admin_authenticated();

  select * into _cart from public.carts where id = _cart_id for update;
  if not found then
    raise exception 'Warenkorb wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  perform set_config('kit.skip_customer_lock', 'on', true);

  _item_id := public.admin_insert_catalog_cart_line(
    _cart_id,
    _cart.user_id,
    _shop_area,
    _vendor_code,
    _product_id,
    _quantity
  );

  select * into _item from public.cart_items where id = _item_id;

  perform public.log_audit(
    _admin,
    'admin.cart.item_add',
    'cart_item',
    _item_id,
    null,
    to_jsonb(_item)
  );

  perform set_config('kit.skip_customer_lock', '', true);
  return _item_id;
end;
$$;

revoke all on function public.admin_add_open_cart_catalog_line(uuid, text, text, uuid, numeric)
  from public, anon;
grant execute on function public.admin_add_open_cart_catalog_line(uuid, text, text, uuid, numeric)
  to authenticated;

-- ---------------------------------------------------------------------------
-- admin_replace_open_cart_catalog_line
-- ---------------------------------------------------------------------------

create or replace function public.admin_replace_open_cart_catalog_line(
  _cart_item_id uuid,
  _shop_area text,
  _vendor_code text,
  _product_id uuid,
  _quantity numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _admin uuid;
  _item public.cart_items;
  _cart_id uuid;
  _before jsonb;
  _new_id uuid;
  _new_item public.cart_items;
begin
  _admin := public.assert_admin_authenticated();

  select * into _item from public.cart_items where id = _cart_item_id for update;
  if not found then
    raise exception 'Position wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if _item.kit_share_id is not null then
    raise exception 'Kit-Anteile können nicht ersetzt werden.' using errcode = 'P0001';
  end if;

  _cart_id := _item.cart_id;
  _before := to_jsonb(_item);

  perform public.admin_remove_open_cart_item(_cart_item_id);

  _new_id := public.admin_add_open_cart_catalog_line(
    _cart_id,
    _shop_area,
    _vendor_code,
    _product_id,
    _quantity
  );

  select * into _new_item from public.cart_items where id = _new_id;

  perform public.log_audit(
    _admin,
    'admin.cart.item_replace',
    'cart_item',
    _new_id,
    _before,
    to_jsonb(_new_item)
  );

  return _new_id;
end;
$$;

revoke all on function public.admin_replace_open_cart_catalog_line(uuid, text, text, uuid, numeric)
  from public, anon;
grant execute on function public.admin_replace_open_cart_catalog_line(uuid, text, text, uuid, numeric)
  to authenticated;

-- ---------------------------------------------------------------------------
-- admin_checkout_open_cart — same create_order pipeline as customer
-- ---------------------------------------------------------------------------

create or replace function public.admin_checkout_open_cart(
  _cart_id uuid,
  _note text,
  _payment_method text,
  _shipping_first_name text,
  _shipping_last_name text,
  _shipping_street text,
  _shipping_house_number text,
  _shipping_address_extra text,
  _shipping_postal_code text,
  _shipping_city text,
  _shipping_country text,
  _shipping_delivery_method text,
  _shipping_packstation_number text,
  _shipping_post_number text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _admin uuid;
  _cart public.carts;
  _result jsonb;
begin
  _admin := public.assert_admin_authenticated();

  select * into _cart from public.carts where id = _cart_id for update;
  if not found then
    raise exception 'Warenkorb wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  perform set_config('kit.skip_customer_lock', 'on', true);
  perform set_config('peptix.checkout_subject_user_id', _cart.user_id::text, true);
  perform set_config('peptix.admin_checkout', 'on', true);

  _result := public.create_order(
    _cart.id,
    _note,
    _payment_method,
    _shipping_first_name,
    _shipping_last_name,
    _shipping_street,
    _shipping_house_number,
    _shipping_address_extra,
    _shipping_postal_code,
    _shipping_city,
    _shipping_country,
    _shipping_delivery_method,
    _shipping_packstation_number,
    _shipping_post_number
  );

  perform set_config('peptix.checkout_subject_user_id', '', true);
  perform set_config('peptix.admin_checkout', '', true);
  perform set_config('kit.skip_customer_lock', '', true);

  perform public.log_audit(
    _admin,
    'admin.cart_checkout',
    'cart',
    _cart.id,
    null,
    jsonb_build_object('orderId', _result->>'orderId', 'customerUserId', _cart.user_id)
  );

  return _result || jsonb_build_object('customerUserId', _cart.user_id, 'adminUserId', _admin);
end;
$$;

revoke all on function public.admin_checkout_open_cart(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.admin_checkout_open_cart(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_sync_orders_and_carts — idempotent orchestrator
-- ---------------------------------------------------------------------------

create or replace function public.admin_sync_orders_and_carts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _admin uuid;
  _refresh jsonb;
  _kit record;
  _kit_result jsonb;
  _kits_checked integer := 0;
  _kits_synced integer := 0;
  _kits_unchanged integer := 0;
  _ambiguous integer := 0;
  _hist_missing integer := 0;
  _errors jsonb := '[]'::jsonb;
begin
  _admin := public.assert_admin_authenticated();

  _refresh := public.admin_refresh_open_cart_prices();

  for _kit in
    select id from public.kit_shares where status = 'full'
  loop
    _kits_checked := _kits_checked + 1;
    begin
      _kit_result := public.kit_full_order_sync_kit(_kit.id, _admin);
      if coalesce((_kit_result->>'summary')::text, '') in ('synced', 'partial') then
        _kits_synced := _kits_synced + 1;
      else
        _kits_unchanged := _kits_unchanged + 1;
      end if;
    exception
      when others then
        _errors := _errors || jsonb_build_array(jsonb_build_object(
          'kitShareId', _kit.id,
          'message', sqlerrm
        ));
    end;
  end loop;

  perform public.log_audit(
    _admin,
    'admin.sync_orders_and_carts',
    'system',
    null,
    null,
    jsonb_build_object(
      'cartsChecked', coalesce((_refresh->>'carts')::integer, 0),
      'cartItemsRefreshed', coalesce((_refresh->>'items')::integer, 0),
      'kitsChecked', _kits_checked,
      'kitsSynced', _kits_synced,
      'kitsUnchanged', _kits_unchanged
    )
  );

  return jsonb_build_object(
    'cartsChecked', coalesce((_refresh->>'carts')::integer, 0),
    'cartItemsChanged', coalesce((_refresh->>'items')::integer, 0),
    'kitsChecked', _kits_checked,
    'kitsSynced', _kits_synced,
    'kitsAlreadySynchronized', _kits_unchanged,
    'ordersChecked', _kits_checked,
    'ordersExtended', _kits_synced,
    'ambiguous', _ambiguous,
    'historicalPriceMissing', _hist_missing,
    'errors', _errors
  );
end;
$$;

revoke all on function public.admin_sync_orders_and_carts() from public, anon;
grant execute on function public.admin_sync_orders_and_carts() to authenticated;
