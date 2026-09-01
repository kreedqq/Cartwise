-- 0044_order_role_surcharge_snapshots.sql
-- Admin reporting of role markups already applied by sell_unit_price /
-- kit_share_catalog_unit_usd. Does not change catalog prices, markup
-- percents, kit pricing, or RLS on products/orders for customers.
--
-- Catalog unit = existing engine at 0% markup (quantity tier first).
-- Selling unit = unchanged create_order sell_unit_price / kit cart snapshot.
-- Surcharge USD = selling line − catalog line. Never a hardcoded 25%.
-- Historical orders without a row here are omitted from the report.

create table public.order_role_surcharge_lines (
  order_item_id uuid primary key references public.order_items (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  catalog_unit_price_usd numeric(12, 4) not null,
  selling_unit_price_usd numeric(12, 4) not null,
  quantity numeric(12, 3) not null,
  base_line_usd numeric(12, 2) not null,
  selling_line_usd numeric(12, 2) not null,
  surcharge_usd numeric(12, 2) not null,
  customer_role_name_snapshot text,
  created_at timestamptz not null default now()
);

comment on table public.order_role_surcharge_lines is
  'Frozen role-surcharge audit per order line. Admin-only. Not a second pricing engine.';
comment on column public.order_role_surcharge_lines.catalog_unit_price_usd is
  'Pre-markup unit after quantity-tier selection (sell_unit_price at 0%, or kit catalog unit).';
comment on column public.order_role_surcharge_lines.surcharge_usd is
  'selling_line_usd minus base_line_usd at checkout. Never recomputed from the current role.';
comment on column public.order_role_surcharge_lines.customer_role_name_snapshot is
  'Pricing role name at checkout. Used only for grouping; percent is not stored.';

create index order_role_surcharge_lines_order_idx on public.order_role_surcharge_lines (order_id);

alter table public.order_role_surcharge_lines enable row level security;

create policy "order_role_surcharge_lines_admin_select"
  on public.order_role_surcharge_lines for select
  using (public.has_role(auth.uid(), 'admin'));

grant select on public.order_role_surcharge_lines to authenticated;
grant select, insert, update, delete on public.order_role_surcharge_lines to service_role;

create or replace function public.customer_role_name_for(_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select r.name
      from public.user_customer_roles u
      join public.customer_roles r on r.id = u.role_id
      where u.user_id = _user_id
      limit 1
    ),
    (select name from public.customer_roles where is_default limit 1)
  );
$$;

revoke all on function public.customer_role_name_for(uuid) from public, anon, authenticated;

create or replace function public.create_order(
  _cart_id uuid,
  _note text default null,
  _payment_method text default null,
  _shipping_first_name text default null,
  _shipping_last_name text default null,
  _shipping_street text default null,
  _shipping_house_number text default null,
  _shipping_address_extra text default null,
  _shipping_postal_code text default null,
  _shipping_city text default null,
  _shipping_country text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _cart record;
  _item record;
  _product record;
  _product_row public.products;
  _order_id uuid;
  _order_item_id uuid;
  _order_number text;
  _position int := 0;
  _line_total numeric(12, 2);
  _total_usd numeric(14, 2) := 0;
  _total_eur numeric(14, 2) := 0;
  _eur_complete boolean := true;
  _line_count int;
  _rate numeric(12, 6);
  _markup numeric;
  _sell numeric;
  _normal numeric;
  _bulk numeric;
  _tier text;
  _eur numeric;
  _kit public.kit_shares;
  _kit_participant public.kit_share_participants;
  _kit_share_ids uuid[];
  _kit_share_id uuid;
  _remaining_unordered int;
  _telegram text;
  _first text;
  _last text;
  _street text;
  _house text;
  _extra text;
  _postal text;
  _city text;
  _country text;
  _role_name text;
  _catalog_unit numeric;
  _base_line numeric(12, 2);
  _allocated integer;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if _payment_method is null or _payment_method not in ('crypto', 'bank_transfer', 'paypal') then
    raise exception 'Bitte wählen Sie eine Zahlungsmethode aus.' using errcode = 'P0001';
  end if;

  select nullif(trim(username), '') into _telegram from public.profiles where id = auth.uid();
  if _telegram is null then
    raise exception 'Bitte zuerst einen Telegram Benutzernamen festlegen.' using errcode = 'P0001';
  end if;

  _first := public.require_shipping_text(_shipping_first_name, 'Bitte Vorname angeben.', 80);
  _last := public.require_shipping_text(_shipping_last_name, 'Bitte Nachname angeben.', 80);
  _street := public.require_shipping_text(_shipping_street, 'Bitte Straße angeben.', 120);
  _house := public.require_shipping_text(_shipping_house_number, 'Bitte Hausnummer angeben.', 20);
  _postal := public.require_shipping_text(_shipping_postal_code, 'Bitte PLZ angeben.', 16);
  _city := public.require_shipping_text(_shipping_city, 'Bitte Ort angeben.', 80);
  _country := public.require_shipping_text(_shipping_country, 'Bitte Land angeben.', 56);
  _extra := nullif(trim(coalesce(_shipping_address_extra, '')), '');
  if _extra is not null and (char_length(_extra) > 120 or _extra ~ '[[:cntrl:]]') then
    raise exception 'Adresszusatz ist ungültig.' using errcode = 'P0001';
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
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.cart_id = _cart_id
    and p.is_active
    and ci.quantity > 0;

  if _line_count = 0 then
    raise exception 'Der Warenkorb enthält keine bestellbaren Positionen.' using errcode = 'P0001';
  end if;

  _markup := public.markup_percent_for(auth.uid());
  _role_name := public.customer_role_name_for(auth.uid());

  insert into public.orders (
    user_id, cart_id, status, note, payment_method,
    telegram_username_snapshot,
    shipping_first_name, shipping_last_name, shipping_street, shipping_house_number,
    shipping_address_extra, shipping_postal_code, shipping_city, shipping_country,
    total_usd, total_eur, exchange_rate, submitted_at
  )
  values (
    auth.uid(), _cart_id, 'pending', nullif(trim(coalesce(_note, '')), ''), _payment_method,
    _telegram,
    _first, _last, _street, _house,
    _extra, _postal, _city, _country,
    0, null, null, now()
  )
  returning id, order_number into _order_id, _order_number;

  for _item in
    select ci.*
    from public.cart_items ci
    where ci.cart_id = _cart_id and ci.quantity > 0
    order by ci.position
  loop
    select * into _product from public.products where id = _item.product_id and is_active;
    if not found then
      continue;
    end if;

    if _item.kit_share_id is not null then
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

      _sell := _item.unit_price_usd_snapshot;
      _normal := _sell;
      _bulk := null;
      _tier := 'normal';

      update public.kit_share_participants
      set ordered_at = now(), order_id = _order_id, updated_at = now()
      where id = _kit_participant.id;

      if not (_item.kit_share_id = any(coalesce(_kit_share_ids, array[]::uuid[]))) then
        _kit_share_ids := coalesce(_kit_share_ids, array[]::uuid[]) || _item.kit_share_id;
      end if;
    else
      _sell := public.sell_unit_price(
        _product.price_usd, _product.bulk_price_usd, _product.bulk_price_min_quantity,
        _item.quantity, _markup
      );
      _normal := public.apply_role_markup(_product.price_usd, _markup);
      if _product.bulk_price_usd is not null and _product.bulk_price_min_quantity is not null and _product.bulk_price_min_quantity > 0 then
        _bulk := public.apply_role_markup(_product.bulk_price_usd, _markup);
        _tier := case when _item.quantity >= _product.bulk_price_min_quantity then 'bulk' else 'normal' end;
      else
        _bulk := null;
        _tier := 'normal';
      end if;
    end if;

    _line_total := round((_item.quantity * _sell)::numeric, 2);
    _total_usd := _total_usd + _line_total;

    _rate := _item.exchange_rate_snapshot;
    if _rate is not null and _rate > 0 then
      _eur := round((_line_total * _rate)::numeric, 2);
      _total_eur := _total_eur + _eur;
    else
      _eur := null;
      _eur_complete := false;
    end if;

    insert into public.order_items (
      order_id, position, product_id,
      product_code_snapshot, product_name_snapshot, dosage_vial_snapshot, description_snapshot,
      normal_price_usd_snapshot, bulk_price_usd_snapshot, bulk_price_min_quantity_snapshot,
      applied_price_tier, unit_price_usd_snapshot, quantity, line_total_usd,
      exchange_rate_snapshot, eur_value_snapshot
    )
    values (
      _order_id, _position, _product.id,
      _product.code, _product.name, _product.dosage_vial, _product.description,
      _normal, _bulk, _product.bulk_price_min_quantity,
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
      _catalog_unit := public.sell_unit_price(
        _product.price_usd, _product.bulk_price_usd, _product.bulk_price_min_quantity,
        _item.quantity, 0
      );
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

    _position := _position + 1;
  end loop;

  update public.orders
  set total_usd = _total_usd,
      total_eur = case when _eur_complete then _total_eur else null end,
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

  update public.carts
  set status = 'ordered', is_active_cart = false
  where id = _cart_id;

  insert into public.order_status_history (order_id, old_status, new_status, changed_by)
  values (_order_id, null, 'pending', auth.uid());

  perform public.log_audit(
    auth.uid(), 'order.create', 'order', _order_id, null,
    jsonb_build_object(
      'orderNumber', _order_number,
      'totalUsd', _total_usd,
      'itemCount', _line_count,
      'paymentMethod', _payment_method
    )
  );

  return jsonb_build_object('orderId', _order_id, 'orderNumber', _order_number, 'totalUsd', _total_usd);
end;
$$;

revoke all on function public.create_order(uuid, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.create_order(uuid, text, text, text, text, text, text, text, text, text, text) to authenticated;
