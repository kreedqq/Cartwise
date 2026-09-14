-- 0092_order_corrections_and_kit_snapshots.sql
-- Kit snapshots on order_items at checkout; order revision audit; admin correction RPC.
-- Additive. Does not change 0088 checkout skip semantics.

alter table public.order_items
  add column if not exists kit_share_id_snapshot uuid references public.kit_shares (id) on delete set null,
  add column if not exists kit_size_vials_snapshot integer,
  add column if not exists kit_participant_quantity_snapshot numeric(12, 3);

comment on column public.order_items.kit_share_id_snapshot is
  'Kit share at order time; corrections/display must not rely on live kit alone.';
comment on column public.order_items.kit_size_vials_snapshot is
  'Kit size (vials) frozen at order creation.';
comment on column public.order_items.kit_participant_quantity_snapshot is
  'Participant share quantity frozen at order creation.';

alter table public.orders
  add column if not exists revision_number integer not null default 0;

create table if not exists public.order_revisions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  revision_number integer not null check (revision_number >= 1),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  reason text not null check (char_length(trim(reason)) >= 3),
  previous_total_usd numeric(12, 2) not null,
  new_total_usd numeric(12, 2) not null,
  previous_total_eur numeric(12, 2),
  new_total_eur numeric(12, 2),
  difference_usd numeric(12, 2) not null,
  difference_eur numeric(12, 2),
  changes jsonb not null default '{}'::jsonb,
  unique (order_id, revision_number)
);

create index if not exists order_revisions_order_idx
  on public.order_revisions (order_id, revision_number desc);

alter table public.order_revisions enable row level security;

drop policy if exists order_revisions_select_admin on public.order_revisions;
create policy order_revisions_select_admin
  on public.order_revisions for select
  using (public.has_role(auth.uid(), 'admin'));


create or replace function public.create_one_area_order(
  _cart_id                     uuid,
  _area                        text,
  _note                        text,
  _payment_method              text,
  _shipping_first_name         text,
  _shipping_last_name          text,
  _shipping_street             text,
  _shipping_house_number       text,
  _shipping_address_extra      text,
  _shipping_postal_code        text,
  _shipping_city               text,
  _shipping_country            text,
  _shipping_delivery_method    text,
  _shipping_packstation_number text,
  _shipping_post_number        text,
  _telegram                    text
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

  -- Count only lines that can actually become order items now.
  select count(*) into _line_count
  from public.cart_items ci
  where ci.cart_id = _cart_id
    and ci.quantity > 0
    and ci.submitted_order_id is null
    and public.cart_item_shop_area(ci.shop_area, _cart.shop_area) = _area
    and (
      (
        ci.kit_share_id is not null
        and public.cart_kit_share_is_checkout_ready(ci.kit_share_id, auth.uid(), ci.quantity)
      )
      or (
        ci.kit_share_id is null
        and exists (
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
      -- Incomplete / not-yet-orderable kit lines remain in the cart.
      if not public.cart_kit_share_is_checkout_ready(_item.kit_share_id, auth.uid(), _item.quantity) then
        continue;
      end if;

      select * into _kit from public.kit_shares where id = _item.kit_share_id for update;
      if not found then
        raise exception 'Ungültiger Kit-Anteil im Warenkorb.' using errcode = 'P0001';
      end if;

      _product := public.kit_share_catalog_product(_kit);
      if _product.id is null or not _product.is_active then
        raise exception 'Ungültiger Kit-Anteil im Warenkorb.' using errcode = 'P0001';
      end if;

      if public.shop_area_pricing_profile(_item_area) = 'retail' then
        raise exception 'Kits sind in diesem Shop-Bereich nicht verfügbar.' using errcode = 'P0001';
      end if;

      if _kit.status not in ('full', 'ordered') then
        continue;
      end if;

      select * into _kit_participant
      from public.kit_share_participants
      where kit_share_id = _item.kit_share_id and user_id = auth.uid()
      for update;

      if not found or _kit_participant.quantity <> _item.quantity then
        raise exception 'Ungültiger Kit-Anteil im Warenkorb.' using errcode = 'P0001';
      end if;

      if _kit_participant.ordered_at is not null then
        continue;
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
      _master_id := _kit.product_id;
    end if;

    insert into public.order_items (
      order_id, position, product_id,
      kit_share_id_snapshot, kit_size_vials_snapshot, kit_participant_quantity_snapshot,
      product_code_snapshot, product_name_snapshot, dosage_vial_snapshot, description_snapshot,
      normal_price_usd_snapshot, bulk_price_usd_snapshot, bulk_price_min_quantity_snapshot,
      applied_price_tier, unit_price_usd_snapshot, quantity, line_total_usd,
      exchange_rate_snapshot, eur_value_snapshot
    )
    values (
      _order_id, _position, _master_id,
      case when _item.kit_share_id is not null then _item.kit_share_id else null end,
      case when _item.kit_share_id is not null then _kit.kit_size_vials else null end,
      case when _item.kit_share_id is not null then _kit_participant.quantity else null end,
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
      if exists (select 1 from public.products p where p.id = _product.id) then
        select * into _product_row from public.products where id = _product.id;
        _catalog_unit := public.kit_share_catalog_unit_usd(_product_row, _kit.kit_size_vials, _allocated);
      else
        _catalog_unit := public.kit_share_catalog_unit_usd(_product, _kit.kit_size_vials, _allocated);
      end if;
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

  if _position = 0 then
    delete from public.orders where id = _order_id;
    raise exception 'Der Warenkorb enthält keine bestellbaren Positionen.' using errcode = 'P0001';
  end if;

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
      'itemCount',     _position,
      'paymentMethod', _payment_method,
      'deliveryMethod', _shipping_delivery_method,
      'shopArea',      _area
    )
  );

  return jsonb_build_object('orderId', _order_id, 'orderNumber', _order_number, 'totalUsd', _total_usd, 'shopArea', _area);
end;
$$;



revoke all on function public.create_one_area_order(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_apply_order_correction — atomic revision using frozen unit prices
-- ---------------------------------------------------------------------------

create or replace function public.admin_apply_order_correction(
  _order_id uuid,
  _expected_revision integer,
  _reason text,
  _line_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _admin uuid := auth.uid();
  _order public.orders;
  _rev integer;
  _prev_usd numeric(12, 2);
  _prev_eur numeric(12, 2);
  _new_usd numeric(12, 2) := 0;
  _new_eur numeric(12, 2) := 0;
  _eur_ok boolean := true;
  _row jsonb;
  _item_id uuid;
  _qty numeric(12, 3);
  _item public.order_items;
  _line numeric(12, 2);
  _eur_line numeric(12, 2);
  _cat_unit numeric;
  _sell_unit numeric;
  _base numeric(12, 2);
  _applied jsonb := '[]'::jsonb;
begin
  if _admin is null or not public.has_role(_admin, 'admin') then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  _reason := nullif(trim(coalesce(_reason, '')), '');
  if _reason is null or char_length(_reason) < 3 then
    raise exception 'Bitte einen Korrekturgrund angeben (mind. 3 Zeichen).' using errcode = '22023';
  end if;

  if _line_changes is null or jsonb_typeof(_line_changes) <> 'array' then
    raise exception 'Ungültige Positionsänderungen.' using errcode = '22023';
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

  _prev_usd := _order.total_usd;
  _prev_eur := _order.total_eur;

  for _row in select value from jsonb_array_elements(_line_changes)
  loop
    begin
      _item_id := (_row->>'orderItemId')::uuid;
    exception when others then
      raise exception 'Ungültige Positions-ID.' using errcode = '22023';
    end;

    select * into _item from public.order_items where id = _item_id and order_id = _order_id for update;
    if not found then
      raise exception 'Bestellposition wurde nicht gefunden.' using errcode = 'P0002';
    end if;

    if (_row ? 'remove') and coalesce((_row->>'remove')::boolean, false) then
      delete from public.order_role_surcharge_lines where order_item_id = _item.id;
      delete from public.order_items where id = _item.id;
      _applied := _applied || jsonb_build_array(jsonb_build_object(
        'orderItemId', _item_id, 'action', 'remove',
        'previousQuantity', _item.quantity, 'productCode', _item.product_code_snapshot
      ));
      continue;
    end if;

    begin
      _qty := (_row->>'quantity')::numeric(12, 3);
    exception when others then
      raise exception 'Ungültige Menge.' using errcode = '22023';
    end;

    if _qty is null or _qty <= 0 then
      raise exception 'Ungültige Menge.' using errcode = '22023';
    end if;

    _sell_unit := _item.unit_price_usd_snapshot;
    _line := round((_qty * _sell_unit)::numeric, 2);

    if _item.exchange_rate_snapshot is not null and _item.exchange_rate_snapshot > 0 then
      _eur_line := round((_line * _item.exchange_rate_snapshot)::numeric, 2);
    else
      _eur_line := null;
      _eur_ok := false;
    end if;

    update public.order_items
    set quantity = _qty,
        line_total_usd = _line,
        eur_value_snapshot = _eur_line,
        kit_participant_quantity_snapshot = case
          when kit_share_id_snapshot is not null then _qty
          else kit_participant_quantity_snapshot
        end
    where id = _item.id;

    select * into _item from public.order_items where id = _item_id;

    select catalog_unit_price_usd, selling_unit_price_usd
    into _cat_unit, _sell_unit
    from public.order_role_surcharge_lines
    where order_item_id = _item.id;

    if found then
      _base := round((_qty * _cat_unit)::numeric, 2);
      update public.order_role_surcharge_lines
      set quantity = _qty,
          base_line_usd = _base,
          selling_line_usd = _line,
          surcharge_usd = round((_line - _base)::numeric, 2)
      where order_item_id = _item.id;
    end if;

    _applied := _applied || jsonb_build_array(jsonb_build_object(
      'orderItemId', _item_id, 'action', 'quantity',
      'quantity', _qty, 'productCode', _item.product_code_snapshot
    ));
  end loop;

  select coalesce(sum(line_total_usd), 0), coalesce(sum(eur_value_snapshot), 0)
  into _new_usd, _new_eur
  from public.order_items
  where order_id = _order_id;

  if not exists (select 1 from public.order_items where order_id = _order_id) then
    raise exception 'Die Bestellung muss mindestens eine Position behalten.' using errcode = 'P0001';
  end if;

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
    jsonb_build_object('lines', _applied)
  );

  perform public.log_audit(
    _admin, 'order.correct', 'order', _order_id, null,
    jsonb_build_object(
      'revisionNumber', _rev + 1,
      'reason', _reason,
      'previousTotalUsd', _prev_usd,
      'newTotalUsd', _new_usd,
      'changes', _applied
    )
  );

  return jsonb_build_object(
    'orderId', _order_id,
    'revisionNumber', _rev + 1,
    'previousTotalUsd', _prev_usd,
    'newTotalUsd', _new_usd,
    'differenceUsd', round((_new_usd - _prev_usd)::numeric, 2),
    'changes', _applied
  );
end;
$$;

revoke all on function public.admin_apply_order_correction(uuid, integer, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_apply_order_correction(uuid, integer, text, jsonb)
  to authenticated;
