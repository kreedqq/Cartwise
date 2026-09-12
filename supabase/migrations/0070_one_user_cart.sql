-- 0070 one open cart per user.
-- Items carry shop_area. Existing open carts are merged, then a partial unique
-- index prevents a second draft/ready cart. Pricing stays on the existing
-- catalog + owner markup pipeline. Orders and order_items are not rewritten.

alter table public.cart_items
  add column if not exists shop_area text references public.shop_areas(key),
  add column if not exists submitted_order_id uuid references public.orders(id) on delete set null;

update public.cart_items ci
set shop_area = coalesce(ci.shop_area, c.shop_area, 'shop')
from public.carts c
where c.id = ci.cart_id
  and ci.shop_area is null;

create index if not exists cart_items_shop_area_idx
  on public.cart_items (cart_id, shop_area);

create index if not exists cart_items_submitted_order_idx
  on public.cart_items (submitted_order_id)
  where submitted_order_id is not null;

drop function if exists public.cart_item_shop_area(public.cart_items, text);

create or replace function public.cart_item_shop_area(_item_area text, _cart_area text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(btrim(coalesce(_item_area, '')), ''), nullif(btrim(coalesce(_cart_area, '')), ''), 'shop');
$$;

create or replace function public.cart_items_assign_shop_area()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.shop_area is not null then
    return new;
  end if;
  if new.kit_share_id is not null then
    select shop_area into new.shop_area
    from public.kit_shares
    where id = new.kit_share_id;
  end if;
  if new.shop_area is null then
    select shop_area into new.shop_area
    from public.carts
    where id = new.cart_id;
  end if;
  new.shop_area := coalesce(new.shop_area, 'shop');
  return new;
end;
$$;

drop trigger if exists cart_items_assign_shop_area on public.cart_items;
create trigger cart_items_assign_shop_area
  before insert or update of shop_area, kit_share_id, cart_id
  on public.cart_items
  for each row
  execute function public.cart_items_assign_shop_area();

-- Display name: one user cart does not need Warenkorb 2 / 3.
create or replace function public.cart_title(_username text, _ordinal integer)
returns text
language sql
immutable
as $$
  select coalesce(nullif(trim(_username), ''), 'Warenkorb');
$$;

create or replace function public.get_or_create_user_cart_for(_user_id uuid)
returns public.carts
language plpgsql
security definer
set search_path = public
as $$
declare
  _cart public.carts;
  _cart_name text;
  _legacy_area text;
begin
  if _user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(8700070, hashtext(_user_id::text));

  select * into _cart
  from public.carts
  where user_id = _user_id
    and deleted_at is null
    and status in ('draft', 'ready')
  order by is_active_cart desc, created_at asc, id asc
  limit 1
  for update;

  if found then
    update public.carts
    set is_active_cart = false
    where user_id = _user_id and is_active_cart and id <> _cart.id and status <> 'ordered';

    update public.carts
    set is_active_cart = true
    where id = _cart.id
    returning * into _cart;
    return _cart;
  end if;

  select coalesce(nullif(trim(username), ''), 'Warenkorb') into _cart_name
  from public.profiles
  where id = _user_id;
  if _cart_name is null then
    _cart_name := 'Warenkorb';
  end if;

  select coalesce(
    (select key from public.shop_areas where key = 'shop' limit 1),
    (select key from public.shop_areas order by sort_order, key limit 1)
  )
  into _legacy_area;
  _legacy_area := coalesce(_legacy_area, 'shop');

  begin
    insert into public.carts (user_id, name, status, is_active_cart, shop_area)
    values (_user_id, _cart_name, 'draft', true, _legacy_area)
    returning * into _cart;
  exception
    when unique_violation then
      select * into _cart
      from public.carts
      where user_id = _user_id
        and deleted_at is null
        and status in ('draft', 'ready')
      order by created_at asc, id asc
      limit 1
      for update;
  end;

  return _cart;
end;
$$;

revoke all on function public.get_or_create_user_cart_for(uuid) from public, anon, authenticated;

create or replace function public.get_or_create_user_cart()
returns public.carts
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  perform public.assert_public_site_access();
  return public.get_or_create_user_cart_for(_uid);
end;
$$;

revoke all on function public.get_or_create_user_cart() from public, anon;
grant execute on function public.get_or_create_user_cart() to authenticated;

create or replace function public.ensure_shop_area_cart(_shop_area text)
returns public.carts
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if not public.user_can_access_shop_area(_uid, _shop_area) then
    raise exception 'Kein Zugriff auf diesen Shop-Bereich.' using errcode = '42501';
  end if;
  return public.get_or_create_user_cart_for(_uid);
end;
$$;

revoke all on function public.ensure_shop_area_cart(text) from public;
grant execute on function public.ensure_shop_area_cart(text) to authenticated;

create or replace function public.kit_share_target_cart_id(_user_id uuid, _area_key text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _area text;
  _cart public.carts;
begin
  _area := _area_key;
  if _area is null then
    _area := public.first_accessible_group_buy_area(_user_id);
  end if;
  if _area is null or public.shop_area_pricing_profile(_area) <> 'group_buy' then
    raise exception 'Kits sind nur in Group-Buy-Bereichen verfügbar.' using errcode = '42501';
  end if;
  if not public.user_can_access_shop_area(_user_id, _area) then
    raise exception 'Kein Zugriff auf diesen Shop-Bereich.' using errcode = '42501';
  end if;
  _cart := public.get_or_create_user_cart_for(_user_id);
  return _cart.id;
end;
$$;

revoke all on function public.kit_share_target_cart_id(uuid, text) from public, anon, authenticated;

create or replace function public.refresh_cart_selling_prices_for_user(_cart_id uuid, _user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _cart_area text;
  _item record;
  _area text;
  _area_factor numeric := 1.0;
  _markup numeric;
  _product public.products;
  _p_for_bulk public.products;
  _sell numeric;
  _normal numeric;
  _bulk numeric;
  _tier text;
  _rate numeric;
  _line numeric;
  _discounts boolean;
  _code text;
  _updated integer := 0;
begin
  if not exists (
    select 1 from public.carts
    where id = _cart_id
      and user_id = _user_id
      and deleted_at is null
      and status in ('draft', 'ready')
  ) then
    return 0;
  end if;

  select shop_area into _cart_area from public.carts where id = _cart_id;
  _markup := public.markup_percent_for(_user_id);
  _discounts := public.quantity_discounts_enabled();

  for _item in
    select * from public.cart_items
    where cart_id = _cart_id
      and kit_share_id is null
      and resolution_status = 'resolved'
      and submitted_order_id is null
  loop
    _area := public.cart_item_shop_area(_item.shop_area, _cart_area);
    _code := coalesce(
      nullif(btrim(coalesce(_item.vendor_code, '')), ''),
      nullif(btrim(coalesce(_item.product_code_snapshot, '')), ''),
      nullif(btrim(coalesce(_item.product_code_input, '')), '')
    );
    _product := public.resolve_area_catalog_product(_area, _code, _item.product_id);
    if _product.id is null or not _product.is_active then
      continue;
    end if;

    select base_price_factor_pct / 100.0
    into _area_factor
    from public.shop_areas
    where key = _area;
    _area_factor := coalesce(_area_factor, 1.0);

    _sell   := public.shop_area_sell_unit_price(_product, _item.quantity, _markup, _area);
    _normal := public.shop_area_sell_unit_price(_product, 1,             _markup, _area);

    if public.shop_area_pricing_profile(_area) = 'retail'
       and public.product_uses_kit_unit_pricing(_product) then
      _bulk := null;
      _tier := 'normal';
    elsif _discounts
          and _product.bulk_price_usd is not null
          and _product.bulk_price_min_quantity is not null
          and _product.bulk_price_min_quantity > 0 then
      _p_for_bulk := public.apply_shop_area_product_overrides(_product, _area);
      _bulk := public.apply_role_markup(
        public.catalog_bulk_unit_price(
          _p_for_bulk.price_usd,
          _p_for_bulk.bulk_price_usd,
          _p_for_bulk.bulk_price_min_quantity
        ) * _area_factor,
        _markup
      );
      _tier := case
        when _bulk is not null and _item.quantity >= _product.bulk_price_min_quantity then 'bulk'
        else 'normal'
      end;
    else
      _bulk := null;
      _tier := 'normal';
    end if;

    _rate := _item.exchange_rate_snapshot;
    _line := round((_item.quantity * _sell)::numeric, 2);

    update public.cart_items
    set
      unit_price_usd_snapshot          = _sell,
      normal_price_usd_snapshot        = _normal,
      bulk_price_usd_snapshot          = _bulk,
      bulk_price_min_quantity_snapshot = case when _discounts then _product.bulk_price_min_quantity else null end,
      applied_price_tier               = _tier,
      eur_value_snapshot               = case
                                           when _rate is not null and _rate > 0
                                             then round((_line * _rate)::numeric, 2)
                                           else eur_value_snapshot
                                         end,
      price_snapshot_at                = now(),
      version                          = version + 1,
      updated_at                       = now()
    where id = _item.id;

    _updated := _updated + 1;
  end loop;

  return _updated;
end;
$$;

revoke all on function public.refresh_cart_selling_prices_for_user(uuid, uuid) from public, anon, authenticated;

drop function if exists public.cart_item_merge_key(public.cart_items);

create or replace function public.cart_item_merge_key(
  _kit_share_id uuid,
  _shop_area text,
  _vendor_code text,
  _product_code_snapshot text,
  _product_code_input text,
  _product_id uuid
)
returns text
language sql
immutable
as $$
  select case
    when _kit_share_id is not null then 'kit:' || _kit_share_id::text
    else
      coalesce(nullif(btrim(coalesce(_shop_area, '')), ''), 'shop')
      || '|'
      || upper(btrim(coalesce(
        nullif(btrim(coalesce(_vendor_code, '')), ''),
        nullif(btrim(coalesce(_product_code_snapshot, '')), ''),
        nullif(btrim(coalesce(_product_code_input, '')), ''),
        coalesce(_product_id::text, '')
      )))
  end;
$$;

create or replace function public.merge_open_carts_for_user(_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _canonical public.carts;
  _donor record;
  _src record;
  _dst record;
  _moved integer := 0;
  _merged integer := 0;
  _donors integer := 0;
  _max_pos integer;
begin
  perform pg_advisory_xact_lock(8700070, hashtext(_user_id::text));

  select * into _canonical
  from public.carts
  where user_id = _user_id
    and deleted_at is null
    and status in ('draft', 'ready')
  order by is_active_cart desc, created_at asc, id asc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('userId', _user_id, 'canonicalCartId', null, 'donors', 0, 'moved', 0, 'merged', 0);
  end if;

  select coalesce(max(position), -1) into _max_pos
  from public.cart_items
  where cart_id = _canonical.id;

  for _donor in
    select *
    from public.carts
    where user_id = _user_id
      and deleted_at is null
      and status in ('draft', 'ready')
      and id <> _canonical.id
    order by created_at, id
    for update
  loop
    _donors := _donors + 1;
    for _src in
      select * from public.cart_items where cart_id = _donor.id order by position, id
    loop
      if _src.kit_share_id is not null then
        update public.cart_items
        set cart_id = _canonical.id,
            position = _max_pos + 1,
            shop_area = coalesce(_src.shop_area, _donor.shop_area, 'shop'),
            updated_at = now()
        where id = _src.id;
        _max_pos := _max_pos + 1;
        _moved := _moved + 1;
        continue;
      end if;

      select * into _dst
      from public.cart_items ci
      where ci.cart_id = _canonical.id
        and ci.kit_share_id is null
        and public.cart_item_merge_key(
              ci.kit_share_id, ci.shop_area, ci.vendor_code,
              ci.product_code_snapshot, ci.product_code_input, ci.product_id
            ) = public.cart_item_merge_key(
              _src.kit_share_id, _src.shop_area, _src.vendor_code,
              _src.product_code_snapshot, _src.product_code_input, _src.product_id
            )
      order by ci.position, ci.id
      limit 1;

      if found then
        update public.cart_items
        set quantity = _dst.quantity + _src.quantity,
            version = _dst.version + 1,
            updated_at = now()
        where id = _dst.id;
        delete from public.cart_items where id = _src.id;
        _merged := _merged + 1;
      else
        update public.cart_items
        set cart_id = _canonical.id,
            position = _max_pos + 1,
            shop_area = coalesce(_src.shop_area, _donor.shop_area, 'shop'),
            updated_at = now()
        where id = _src.id;
        _max_pos := _max_pos + 1;
        _moved := _moved + 1;
      end if;
    end loop;

    update public.carts
    set deleted_at = now(),
        is_active_cart = false,
        status = 'archived',
        updated_at = now()
    where id = _donor.id;
  end loop;

  update public.carts
  set is_active_cart = true,
      name = public.cart_title(coalesce((select nullif(trim(username), '') from public.profiles where id = _user_id), ''), 1)
  where id = _canonical.id;

  perform public.refresh_cart_selling_prices_for_user(_canonical.id, _user_id);

  return jsonb_build_object(
    'userId', _user_id,
    'canonicalCartId', _canonical.id,
    'donors', _donors,
    'moved', _moved,
    'merged', _merged
  );
end;
$$;

revoke all on function public.merge_open_carts_for_user(uuid) from public, anon, authenticated;

create or replace function public.admin_merge_open_user_carts(_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _row record;
  _result jsonb;
  _results jsonb := '[]'::jsonb;
  _users integer := 0;
begin
  if _uid is null or not public.has_role(_uid, 'admin') then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  if _user_id is not null then
    _result := public.merge_open_carts_for_user(_user_id);
    return jsonb_build_object('users', 1, 'results', jsonb_build_array(_result));
  end if;

  for _row in
    select user_id
    from public.carts
    where deleted_at is null
      and status in ('draft', 'ready')
    group by user_id
    having count(*) > 1
    order by user_id
  loop
    _result := public.merge_open_carts_for_user(_row.user_id);
    _results := _results || jsonb_build_array(_result);
    _users := _users + 1;
  end loop;

  return jsonb_build_object('users', _users, 'results', _results);
end;
$$;

revoke all on function public.admin_merge_open_user_carts(uuid) from public, anon;
grant execute on function public.admin_merge_open_user_carts(uuid) to authenticated;

do $$
declare
  _user uuid;
begin
  for _user in
    select user_id
    from public.carts
    where deleted_at is null
      and status in ('draft', 'ready')
    group by user_id
    having count(*) > 1
  loop
    perform public.merge_open_carts_for_user(_user);
  end loop;
end;
$$;

create unique index if not exists carts_one_open_per_user_idx
  on public.carts (user_id)
  where deleted_at is null and status in ('draft', 'ready');

create or replace function public.create_one_area_order(
  _cart_id                    uuid,
  _area                       text,
  _note                       text,
  _payment_method             text,
  _shipping_first_name        text,
  _shipping_last_name         text,
  _shipping_street            text,
  _shipping_house_number      text,
  _shipping_address_extra     text,
  _shipping_postal_code       text,
  _shipping_city              text,
  _shipping_country           text,
  _shipping_delivery_method   text,
  _shipping_packstation_number text,
  _shipping_post_number       text,
  _telegram                   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _cart                 record;
  _area_factor          numeric := 1.0;
  _item                 record;
  _product              public.products;
  _product_row          public.products;
  _p_for_bulk           public.products;
  _order_id             uuid;
  _order_item_id        uuid;
  _order_number         text;
  _position             int  := 0;
  _line_total           numeric(12, 2);
  _total_usd            numeric(14, 2) := 0;
  _total_eur            numeric(14, 2) := 0;
  _eur_complete         boolean        := true;
  _line_count           int;
  _rate                 numeric(12, 6);
  _markup               numeric;
  _sell                 numeric;
  _normal               numeric;
  _bulk                 numeric;
  _tier                 text;
  _eur                  numeric;
  _kit                  public.kit_shares;
  _kit_participant      public.kit_share_participants;
  _kit_share_ids        uuid[];
  _kit_share_id         uuid;
  _remaining_unordered  int;
  _role_name            text;
  _catalog_unit         numeric;
  _base_line            numeric(12, 2);
  _allocated            integer;
  _code                 text;
  _master_id            uuid;
  _item_area            text;
begin
  select * into _cart
  from public.carts
  where id = _cart_id
  for update;

  if not public.user_can_access_shop_area(auth.uid(), _area) then
    raise exception 'Kein Zugriff auf diesen Shop-Bereich.' using errcode = '42501';
  end if;

  select base_price_factor_pct / 100.0
  into _area_factor
  from public.shop_areas
  where key = _area;
  _area_factor := coalesce(_area_factor, 1.0);

  select count(*) into _line_count
  from public.cart_items ci
  where ci.cart_id = _cart_id
    and ci.quantity > 0
    and ci.submitted_order_id is null
    and public.cart_item_shop_area(ci.shop_area, _cart.shop_area) = _area
    and (
      ci.kit_share_id is not null
      or exists (
        select 1
        from public.shop_area_products sap
        where sap.shop_area_key = _area
          and sap.is_active
          and (
            sap.vendor_code = upper(btrim(coalesce(
              ci.vendor_code, ci.product_code_snapshot, ci.product_code_input, ''
            )))
            or (
              ci.product_id is not null
              and (sap.product_id = ci.product_id or sap.id = ci.product_id)
            )
          )
      )
    );

  if _line_count = 0 then
    raise exception 'Der Warenkorb enthält keine bestellbaren Positionen.' using errcode = 'P0001';
  end if;

  _markup    := public.markup_percent_for(auth.uid());
  _role_name := public.customer_role_name_for(auth.uid());

  insert into public.orders (
    user_id, cart_id, status, note, payment_method,
    telegram_username_snapshot,
    shipping_delivery_method,
    shipping_first_name, shipping_last_name, shipping_street, shipping_house_number,
    shipping_address_extra, shipping_packstation_number, shipping_post_number,
    shipping_postal_code, shipping_city, shipping_country,
    total_usd, total_eur, exchange_rate, submitted_at,
    shop_area
  )
  values (
    auth.uid(), _cart_id, 'pending', nullif(trim(coalesce(_note, '')), ''), _payment_method,
    _telegram,
    _shipping_delivery_method,
    _shipping_first_name, _shipping_last_name, _shipping_street, _shipping_house_number,
    _shipping_address_extra, _shipping_packstation_number, _shipping_post_number,
    _shipping_postal_code, _shipping_city, _shipping_country,
    0, null, null, now(),
    _area
  )
  returning id, order_number into _order_id, _order_number;

  for _item in
    select ci.*
    from public.cart_items ci
    where ci.cart_id = _cart_id
      and ci.quantity > 0
      and ci.submitted_order_id is null
      and public.cart_item_shop_area(ci.shop_area, _cart.shop_area) = _area
    order by ci.position
  loop
    _item_area := public.cart_item_shop_area(_item.shop_area, _cart.shop_area);
    _code := coalesce(
      nullif(btrim(coalesce(_item.vendor_code, '')), ''),
      nullif(btrim(coalesce(_item.product_code_snapshot, '')), ''),
      nullif(btrim(coalesce(_item.product_code_input, '')), '')
    );

    if _item.kit_share_id is not null then
      select * into _product from public.products where id = _item.product_id and is_active;
      if not found then
        raise exception 'Ungültiger Kit-Anteil im Warenkorb.' using errcode = 'P0001';
      end if;

      if public.shop_area_pricing_profile(_item_area) = 'retail' then
        raise exception 'Kits sind in diesem Shop-Bereich nicht verfügbar.' using errcode = 'P0001';
      end if;

      select * into _kit from public.kit_shares where id = _item.kit_share_id for update;

      if not found or _kit.status not in ('full', 'ordered') then
        raise exception 'Ungültiger Kit-Anteil im Warenkorb.' using errcode = 'P0001';
      end if;

      select * into _kit_participant
      from public.kit_share_participants
      where kit_share_id = _item.kit_share_id and user_id = auth.uid()
      for update;

      if not found or _kit_participant.quantity <> _item.quantity then
        raise exception 'Ungültiger Kit-Anteil im Warenkorb.' using errcode = 'P0001';
      end if;

      if _kit_participant.ordered_at is not null then
        raise exception 'Dieser Kit-Anteil wurde bereits bestellt.' using errcode = 'P0001';
      end if;

      _sell   := _item.unit_price_usd_snapshot;
      _normal := _sell;
      _bulk   := null;
      _tier   := 'normal';

      update public.kit_share_participants
      set ordered_at = now(), order_id = _order_id, updated_at = now()
      where id = _kit_participant.id;

      if not (_item.kit_share_id = any(coalesce(_kit_share_ids, array[]::uuid[]))) then
        _kit_share_ids := coalesce(_kit_share_ids, array[]::uuid[]) || _item.kit_share_id;
      end if;
    else
      _product := public.resolve_area_catalog_product(_item_area, _code, _item.product_id);
      if _product.id is null then
        raise exception 'Ein Produkt gehört nicht zum aktuellen Händlerkatalog.'
          using errcode = 'P0002';
      end if;

      _sell   := public.shop_area_sell_unit_price(_product, _item.quantity, _markup, _item_area);
      _normal := public.shop_area_sell_unit_price(_product, 1,             _markup, _item_area);

      if public.shop_area_pricing_profile(_item_area) = 'retail'
         and public.product_uses_kit_unit_pricing(_product) then
        _bulk := null;
        _tier := 'normal';
      elsif public.quantity_discounts_enabled()
            and _product.bulk_price_usd is not null
            and _product.bulk_price_min_quantity is not null
            and _product.bulk_price_min_quantity > 0 then
        _p_for_bulk := public.apply_shop_area_product_overrides(_product, _item_area);
        _bulk := public.apply_role_markup(
          public.catalog_bulk_unit_price(
            _p_for_bulk.price_usd,
            _p_for_bulk.bulk_price_usd,
            _p_for_bulk.bulk_price_min_quantity
          ) * _area_factor,
          _markup
        );
        _tier := case
          when _item.quantity >= _product.bulk_price_min_quantity then 'bulk'
          else 'normal'
        end;
      else
        _bulk := null;
        _tier := 'normal';
      end if;
    end if;

    _line_total    := round((_item.quantity * _sell)::numeric, 2);
    _total_usd     := _total_usd + _line_total;

    _rate := _item.exchange_rate_snapshot;
    if _rate is not null and _rate > 0 then
      _eur       := round((_line_total * _rate)::numeric, 2);
      _total_eur := _total_eur + _eur;
    else
      _eur          := null;
      _eur_complete := false;
    end if;

    select sap.product_id into _master_id
    from public.shop_area_products sap
    where sap.shop_area_key = _item_area
      and sap.vendor_code = _product.code
    limit 1;
    if _item.kit_share_id is not null then
      _master_id := _product.id;
    end if;

    insert into public.order_items (
      order_id, position, product_id,
      product_code_snapshot, product_name_snapshot, dosage_vial_snapshot, description_snapshot,
      normal_price_usd_snapshot, bulk_price_usd_snapshot, bulk_price_min_quantity_snapshot,
      applied_price_tier, unit_price_usd_snapshot, quantity, line_total_usd,
      exchange_rate_snapshot, eur_value_snapshot
    )
    values (
      _order_id, _position, _master_id,
      _product.code, _product.name, _product.dosage_vial, _product.description,
      _normal, _bulk, case when public.quantity_discounts_enabled() then _product.bulk_price_min_quantity else null end,
      _tier, _sell, _item.quantity, _line_total,
      _rate, _eur
    )
    returning id into _order_item_id;

    if _item.kit_share_id is not null then
      select coalesce(sum(quantity), 0)::integer into _allocated
      from public.kit_share_participants
      where kit_share_id = _item.kit_share_id;
      select * into _product_row from public.products where id = _product.id;
      _catalog_unit := public.kit_share_catalog_unit_usd(_product_row, _kit.kit_size_vials, _allocated);
    else
      _catalog_unit := public.shop_area_catalog_unit(_product, _item.quantity, _item_area);
    end if;

    _base_line := round((_item.quantity * _catalog_unit)::numeric, 2);

    insert into public.order_role_surcharge_lines (
      order_item_id, order_id,
      catalog_unit_price_usd, selling_unit_price_usd, quantity,
      base_line_usd, selling_line_usd, surcharge_usd,
      customer_role_name_snapshot
    )
    values (
      _order_item_id, _order_id,
      _catalog_unit, _sell, _item.quantity,
      _base_line, _line_total, round((_line_total - _base_line)::numeric, 2),
      _role_name
    );

    update public.cart_items
    set submitted_order_id = _order_id, updated_at = now()
    where id = _item.id;

    _position := _position + 1;
  end loop;

  update public.orders
  set total_usd  = _total_usd,
      total_eur  = case when _eur_complete then _total_eur else null end,
      exchange_rate = _rate
  where id = _order_id;

  if _kit_share_ids is not null then
    foreach _kit_share_id in array _kit_share_ids
    loop
      select count(*) into _remaining_unordered
      from public.kit_share_participants
      where kit_share_id = _kit_share_id and ordered_at is null;

      if _remaining_unordered = 0 then
        update public.kit_shares
        set status = 'ordered', updated_at = now()
        where id = _kit_share_id;
      end if;
    end loop;
  end if;

  insert into public.order_status_history (order_id, old_status, new_status, changed_by)
  values (_order_id, null, 'pending', auth.uid());

  perform public.log_audit(
    auth.uid(), 'order.create', 'order', _order_id, null,
    jsonb_build_object(
      'orderNumber',   _order_number,
      'totalUsd',      _total_usd,
      'itemCount',     _line_count,
      'paymentMethod', _payment_method,
      'deliveryMethod', _shipping_delivery_method,
      'shopArea',      _area
    )
  );

  return jsonb_build_object('orderId', _order_id, 'orderNumber', _order_number, 'totalUsd', _total_usd, 'shopArea', _area);
end;
$$;

revoke all on function public.create_one_area_order(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;

create or replace function public.create_order(
  _cart_id                    uuid,
  _note                       text    default null,
  _payment_method             text    default null,
  _shipping_first_name        text    default null,
  _shipping_last_name         text    default null,
  _shipping_street            text    default null,
  _shipping_house_number      text    default null,
  _shipping_address_extra     text    default null,
  _shipping_postal_code       text    default null,
  _shipping_city              text    default null,
  _shipping_country           text    default null,
  _shipping_delivery_method   text    default null,
  _shipping_packstation_number text   default null,
  _shipping_post_number       text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _cart        record;
  _telegram    text;
  _first       text;
  _last        text;
  _street      text;
  _house       text;
  _extra       text;
  _postal      text;
  _city        text;
  _country     text;
  _delivery    text;
  _packstation text;
  _post_number text;
  _area        text;
  _areas       text[];
  _result      jsonb;
  _results     jsonb := '[]'::jsonb;
  _remaining   int;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  perform public.assert_public_site_access();

  if _payment_method is null or _payment_method not in ('crypto', 'bank_transfer', 'paypal') then
    raise exception 'Bitte wählen Sie eine Zahlungsmethode aus.' using errcode = 'P0001';
  end if;

  select nullif(trim(username), '') into _telegram from public.profiles where id = auth.uid();
  if _telegram is null then
    raise exception 'Bitte zuerst einen Telegram Benutzernamen festlegen.' using errcode = 'P0001';
  end if;

  if _shipping_delivery_method is null or _shipping_delivery_method not in ('home', 'packstation') then
    raise exception 'Bitte wählen Sie eine Lieferart aus.' using errcode = 'P0001';
  end if;
  _delivery := _shipping_delivery_method;

  _first  := public.require_shipping_text(_shipping_first_name,   'Bitte Vorname angeben.',    80);
  _last   := public.require_shipping_text(_shipping_last_name,    'Bitte Nachname angeben.',   80);
  _postal := public.require_shipping_text(_shipping_postal_code,  'Bitte PLZ angeben.',        16);
  _city   := public.require_shipping_text(_shipping_city,         'Bitte Ort angeben.',        80);
  _country := public.require_shipping_text(_shipping_country,     'Bitte Land angeben.',       56);

  if _delivery = 'home' then
    _street := public.require_shipping_text(_shipping_street,       'Bitte Straße angeben.',      120);
    _house  := public.require_shipping_text(_shipping_house_number, 'Bitte Hausnummer angeben.',   20);
    _extra  := nullif(trim(coalesce(_shipping_address_extra, '')), '');
    if _extra is not null and (char_length(_extra) > 120 or _extra ~ '[[:cntrl:]]') then
      raise exception 'Adresszusatz ist ungültig.' using errcode = 'P0001';
    end if;
    _packstation := null;
    _post_number := null;
  else
    _packstation := public.require_shipping_text(_shipping_packstation_number, 'Bitte Packstation Nummer angeben.', 20);
    _post_number := public.require_shipping_text(_shipping_post_number,        'Bitte Postnummer angeben.',         20);
    _street := null;
    _house  := null;
    _extra  := null;
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

  select array_agg(distinct public.cart_item_shop_area(ci.shop_area, _cart.shop_area) order by public.cart_item_shop_area(ci.shop_area, _cart.shop_area))
  into _areas
  from public.cart_items ci
  where ci.cart_id = _cart_id
    and ci.quantity > 0
    and ci.submitted_order_id is null;

  if _areas is null or array_length(_areas, 1) is null then
    raise exception 'Der Warenkorb enthält keine bestellbaren Positionen.' using errcode = 'P0001';
  end if;

  foreach _area in array _areas
  loop
    _result := public.create_one_area_order(
      _cart_id, _area, _note, _payment_method,
      _first, _last, _street, _house, _extra, _postal, _city, _country,
      _delivery, _packstation, _post_number, _telegram
    );
    _results := _results || jsonb_build_array(_result);
  end loop;

  select count(*) into _remaining
  from public.cart_items
  where cart_id = _cart_id
    and quantity > 0
    and submitted_order_id is null;

  if _remaining = 0 then
    update public.carts
    set status = 'ordered', is_active_cart = false
    where id = _cart_id;
  end if;

  return (_results -> 0) || jsonb_build_object('orders', _results);
end;
$$;

revoke all on function public.create_order(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.create_order(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

create or replace function public.duplicate_cart(_cart_id uuid, _new_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.carts where id = _cart_id and user_id = auth.uid() and deleted_at is null
  ) then
    raise exception 'Warenkorb wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  raise exception 'Es ist nur ein aktiver Warenkorb erlaubt.' using errcode = 'P0001';
end;
$$;

comment on function public.duplicate_cart(uuid, text) is
  'Disabled: one open cart per user. Callers must not create a second draft cart.';

revoke all on function public.duplicate_cart(uuid, text) from public;
grant execute on function public.duplicate_cart(uuid, text) to authenticated;
