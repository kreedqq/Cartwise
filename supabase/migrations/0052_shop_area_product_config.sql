-- 0052_shop_area_product_config.sql
-- Additive: per-area product visibility, price overrides, role markups, documents,
-- and kit_shares.shop_area so Group Buy 1 / 2 stay separate kit instances.
-- Does not alter 0051, historical orders, catalog product rows, or cart security objects.

-- ---------------------------------------------------------------------------
-- kit_shares.shop_area
-- ---------------------------------------------------------------------------

alter table public.kit_shares
  add column if not exists shop_area text not null default 'group_buy_1';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'kit_shares_shop_area_check'
  ) then
    alter table public.kit_shares
      add constraint kit_shares_shop_area_check
      check (shop_area in ('group_buy_1', 'group_buy_2'));
  end if;
end
$$;

comment on column public.kit_shares.shop_area is
  'Group-buy instance for this kit. Retail shop never owns kits.';

create index if not exists kit_shares_shop_area_open_idx
  on public.kit_shares (shop_area, status)
  where is_open_request;

-- ---------------------------------------------------------------------------
-- Per-area product config
-- ---------------------------------------------------------------------------

create table public.shop_area_products (
  shop_area_key text not null references public.shop_areas (key) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (shop_area_key, product_id)
);

comment on table public.shop_area_products is
  'Optional per-area visibility. Missing row = inherit products.is_active. is_active=false hides the SKU in that area only.';

create table public.shop_area_product_prices (
  shop_area_key text not null references public.shop_areas (key) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  price_usd numeric(12, 4),
  bulk_price_usd numeric(12, 4),
  bulk_price_min_quantity numeric(12, 3),
  updated_at timestamptz not null default now(),
  primary key (shop_area_key, product_id),
  check (
    (bulk_price_usd is null and bulk_price_min_quantity is null)
    or (bulk_price_usd is not null and bulk_price_min_quantity is not null and bulk_price_min_quantity > 0)
  )
);

comment on table public.shop_area_product_prices is
  'Optional catalog-unit overrides for one product in one area. NULL columns fall back to products.*.';

create table public.shop_area_product_role_markups (
  shop_area_key text not null references public.shop_areas (key) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  role_id uuid not null references public.customer_roles (id) on delete cascade,
  markup_percent numeric(8, 4) not null,
  updated_at timestamptz not null default now(),
  primary key (shop_area_key, product_id, role_id)
);

comment on table public.shop_area_product_role_markups is
  'Optional markup_percent for product + area + role. Missing row uses customer_roles.markup_percent. Applied once via apply_role_markup.';

create table public.shop_area_documents (
  shop_area_key text primary key references public.shop_areas (key) on delete cascade,
  storage_path text not null,
  file_name text not null,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.shop_area_documents is
  'One catalog document per shop area. Stored in pdf-imports/shop-area-docs/{area}/.';

alter table public.shop_area_products enable row level security;
alter table public.shop_area_product_prices enable row level security;
alter table public.shop_area_product_role_markups enable row level security;
alter table public.shop_area_documents enable row level security;

create policy shop_area_products_admin_all
  on public.shop_area_products for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy shop_area_product_prices_admin_all
  on public.shop_area_product_prices for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy shop_area_product_role_markups_admin_all
  on public.shop_area_product_role_markups for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy shop_area_documents_admin_all
  on public.shop_area_documents for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.shop_area_products to authenticated;
grant select, insert, update, delete on public.shop_area_product_prices to authenticated;
grant select, insert, update, delete on public.shop_area_product_role_markups to authenticated;
grant select, insert, update, delete on public.shop_area_documents to authenticated;

drop policy if exists shop_area_docs_bucket_admin_select on storage.objects;
drop policy if exists shop_area_docs_bucket_admin_insert on storage.objects;
drop policy if exists shop_area_docs_bucket_admin_update on storage.objects;
drop policy if exists shop_area_docs_bucket_admin_delete on storage.objects;

create policy shop_area_docs_bucket_admin_select
  on storage.objects for select
  using (
    bucket_id = 'pdf-imports'
    and public.has_role(auth.uid(), 'admin')
    and (storage.foldername(name))[1] = 'shop-area-docs'
  );

create policy shop_area_docs_bucket_admin_insert
  on storage.objects for insert
  with check (
    bucket_id = 'pdf-imports'
    and public.has_role(auth.uid(), 'admin')
    and (storage.foldername(name))[1] = 'shop-area-docs'
  );

create policy shop_area_docs_bucket_admin_update
  on storage.objects for update
  using (
    bucket_id = 'pdf-imports'
    and public.has_role(auth.uid(), 'admin')
    and (storage.foldername(name))[1] = 'shop-area-docs'
  )
  with check (
    bucket_id = 'pdf-imports'
    and public.has_role(auth.uid(), 'admin')
    and (storage.foldername(name))[1] = 'shop-area-docs'
  );

create policy shop_area_docs_bucket_admin_delete
  on storage.objects for delete
  using (
    bucket_id = 'pdf-imports'
    and public.has_role(auth.uid(), 'admin')
    and (storage.foldername(name))[1] = 'shop-area-docs'
  );

-- ---------------------------------------------------------------------------
-- Pricing helpers (markup still applied exactly once)
-- ---------------------------------------------------------------------------

create or replace function public.apply_shop_area_product_overrides(
  _product public.products,
  _area_key text
)
returns public.products
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _over public.shop_area_product_prices;
begin
  select * into _over
  from public.shop_area_product_prices
  where shop_area_key = _area_key and product_id = _product.id;

  if found then
    if _over.price_usd is not null then
      _product.price_usd := _over.price_usd;
    end if;
    if _over.bulk_price_usd is not null then
      _product.bulk_price_usd := _over.bulk_price_usd;
      _product.bulk_price_min_quantity := _over.bulk_price_min_quantity;
    end if;
  end if;

  return _product;
end;
$$;

revoke all on function public.apply_shop_area_product_overrides(public.products, text) from public, anon, authenticated;

create or replace function public.product_visible_in_shop_area(_product_id uuid, _area_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.products p
    where p.id = _product_id
      and p.is_active
      and not exists (
        select 1 from public.shop_area_products sap
        where sap.product_id = p.id
          and sap.shop_area_key = _area_key
          and sap.is_active = false
      )
  );
$$;

revoke all on function public.product_visible_in_shop_area(uuid, text) from public, anon, authenticated;

create or replace function public.markup_percent_for_area(
  _user_id uuid,
  _area_key text,
  _product_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select saprm.markup_percent
      from public.user_customer_roles u
      join public.shop_area_product_role_markups saprm
        on saprm.role_id = u.role_id
       and saprm.shop_area_key = _area_key
       and saprm.product_id = _product_id
      where u.user_id = _user_id
      limit 1
    ),
    (
      select saprm.markup_percent
      from public.customer_roles r
      join public.shop_area_product_role_markups saprm
        on saprm.role_id = r.id
       and saprm.shop_area_key = _area_key
       and saprm.product_id = _product_id
      where r.is_default
        and not exists (select 1 from public.user_customer_roles u where u.user_id = _user_id)
      limit 1
    ),
    public.markup_percent_for(_user_id),
    0
  );
$$;

revoke all on function public.markup_percent_for_area(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.shop_area_catalog_unit(
  _product public.products,
  _qty numeric,
  _area_key text
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _area public.shop_areas;
  _p public.products;
  _factor numeric;
  _divisor numeric;
  _unit numeric;
begin
  select * into _area from public.shop_areas where key = _area_key;
  if not found then
    raise exception 'Unbekannter Shop-Bereich.' using errcode = 'P0001';
  end if;

  _p := public.apply_shop_area_product_overrides(_product, _area_key);

  if _area.pricing_profile = 'group_buy' then
    return public.sell_unit_price(
      _p.price_usd, _p.bulk_price_usd, _p.bulk_price_min_quantity,
      _qty, 0
    );
  end if;

  _factor := _area.retail_price_factor;
  _divisor := _area.kit_unit_divisor;

  if public.product_uses_kit_unit_pricing(_p) then
    return (_p.price_usd / _divisor) * _factor;
  end if;

  _unit := public.sell_unit_price(
    _p.price_usd, _p.bulk_price_usd, _p.bulk_price_min_quantity,
    _qty, 0
  );
  return _unit * _factor;
end;
$$;

revoke all on function public.shop_area_catalog_unit(public.products, numeric, text) from public, anon, authenticated;

create or replace function public.shop_area_sell_unit_price(
  _product public.products,
  _qty numeric,
  _percent numeric,
  _area_key text
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _p public.products := public.apply_shop_area_product_overrides(_product, _area_key);
  _pct numeric;
begin
  if auth.uid() is not null then
    _pct := public.markup_percent_for_area(auth.uid(), _area_key, _p.id);
  else
    _pct := coalesce(_percent, 0);
  end if;

  return public.apply_role_markup(
    public.shop_area_catalog_unit(_p, _qty, _area_key),
    _pct
  );
end;
$$;

revoke all on function public.shop_area_sell_unit_price(public.products, numeric, numeric, text) from public, anon, authenticated;

create or replace function public.list_shop_products_for_area(_shop_area text)
returns setof public.products
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _area public.shop_areas;
  _p public.products;
  _src public.products;
  _pct numeric;
  _factor numeric;
  _divisor numeric;
  _catalog_unit numeric;
  _bulk_unit numeric;
  _src_price numeric;
  _src_bulk numeric;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select * into _area from public.shop_areas where key = _shop_area and is_active;
  if not found then
    raise exception 'Unbekannter oder inaktiver Shop-Bereich.' using errcode = 'P0001';
  end if;

  if not public.user_can_access_shop_area(_uid, _shop_area) then
    raise exception 'Kein Zugriff auf diesen Shop-Bereich.' using errcode = '42501';
  end if;

  _factor := _area.retail_price_factor;
  _divisor := _area.kit_unit_divisor;

  for _src in
    select * from public.products p
    where p.is_active = true
      and public.product_visible_in_shop_area(p.id, _shop_area)
    order by p.code
  loop
    _p := public.apply_shop_area_product_overrides(_src, _shop_area);
    _pct := public.markup_percent_for_area(_uid, _shop_area, _p.id);
    _src_price := _p.price_usd;
    _src_bulk := _p.bulk_price_usd;

    if _area.pricing_profile = 'group_buy' then
      _p.price_usd := public.apply_role_markup(_src_price, _pct)::numeric(12, 4);
      if _src_bulk is not null and _p.bulk_price_min_quantity is not null and _p.bulk_price_min_quantity > 0 then
        _p.bulk_price_usd := public.apply_role_markup(
          public.catalog_bulk_unit_price(_src_price, _src_bulk, _p.bulk_price_min_quantity),
          _pct
        )::numeric(12, 4);
      else
        _p.bulk_price_usd := null;
      end if;
    else
      if public.product_uses_kit_unit_pricing(_p) then
        _catalog_unit := (_src_price / _divisor) * _factor;
      else
        _catalog_unit := public.sell_unit_price(
          _src_price, _src_bulk, _p.bulk_price_min_quantity, 1, 0
        ) * _factor;
      end if;
      _p.price_usd := public.apply_role_markup(_catalog_unit, _pct)::numeric(12, 4);
      _p.bulk_price_usd := null;
      _p.bulk_price_min_quantity := null;
    end if;
    return next _p;
  end loop;
end;
$$;

revoke all on function public.list_shop_products_for_area(text) from public;
grant execute on function public.list_shop_products_for_area(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Kit carts land in the kit's area, not "first accessible GB"
-- ---------------------------------------------------------------------------

drop function if exists public.kit_share_target_cart_id(uuid);

create or replace function public.kit_share_target_cart_id(_user_id uuid, _area_key text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _area text;
  _cart_id uuid;
  _cart_name text;
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

  select id into _cart_id
  from public.carts
  where user_id = _user_id
    and shop_area = _area
    and deleted_at is null
    and status in ('draft', 'ready')
  order by is_active_cart desc, updated_at desc
  limit 1
  for update;

  if _cart_id is null then
    select coalesce(nullif(trim(username), ''), 'Warenkorb') into _cart_name
    from public.profiles where id = _user_id;
    if _cart_name is null then
      _cart_name := 'Warenkorb';
    end if;
    insert into public.carts (user_id, name, status, is_active_cart, shop_area)
    values (_user_id, _cart_name, 'draft', false, _area)
    returning id into _cart_id;
  end if;

  return _cart_id;
end;
$$;

revoke all on function public.kit_share_target_cart_id(uuid, text) from public, anon, authenticated;

create or replace function public.kit_share_sync_participant_cart(
  _kit_share_id uuid,
  _user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _kit public.kit_shares;
  _product public.products;
  _participant public.kit_share_participants;
  _cart_id uuid;
  _position integer;
  _markup numeric;
  _unit numeric;
  _allocated integer;
  _catalog_unit numeric;
  _pack_size integer;
  _rate numeric;
  _line numeric;
  _item_id uuid;
  _existing_id uuid;
  _variant_label text;
  _normal_unit numeric;
  _bulk_unit numeric;
  _tier text;
begin
  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found then
    return null;
  end if;

  if _kit.status in ('cancelled', 'ordered') then
    delete from public.cart_items ci
    using public.carts c
    where ci.cart_id = c.id
      and c.user_id = _user_id
      and c.deleted_at is null
      and ci.kit_share_id = _kit_share_id;
    return null;
  end if;

  select * into _participant
  from public.kit_share_participants
  where kit_share_id = _kit_share_id and user_id = _user_id;

  if not found then
    delete from public.cart_items ci
    using public.carts c
    where ci.cart_id = c.id
      and c.user_id = _user_id
      and c.deleted_at is null
      and ci.kit_share_id = _kit_share_id;
    return null;
  end if;

  select * into _product from public.products where id = _kit.product_id and is_active;
  if not found then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  _product := public.apply_shop_area_product_overrides(_product, _kit.shop_area);
  _cart_id := public.kit_share_target_cart_id(_user_id, _kit.shop_area);

  _allocated := public.kit_share_allocated_total(_kit_share_id);
  _markup := public.markup_percent_for_area(_user_id, _kit.shop_area, _product.id);
  _pack_size := public.kit_share_catalog_pack_size(_product);
  _catalog_unit := public.kit_share_catalog_unit_usd(_product, _kit.kit_size_vials, _allocated);
  _unit := public.apply_role_markup(_catalog_unit, _markup);

  _normal_unit := public.apply_role_markup(
    case
      when public.product_uses_kit_unit_pricing(_product) then _product.price_usd / _pack_size
      else _product.price_usd
    end,
    _markup
  );

  if public.kit_share_bulk_applies(_product, _allocated) then
    _bulk_unit := public.apply_role_markup(
      case
        when public.product_uses_kit_unit_pricing(_product) then _product.bulk_price_usd / _pack_size
        else _product.bulk_price_usd
      end,
      _markup
    );
    _tier := 'bulk';
  else
    _bulk_unit := case
      when _product.bulk_price_usd is not null then
        public.apply_role_markup(
          case
            when public.product_uses_kit_unit_pricing(_product) then _product.bulk_price_usd / _pack_size
            else _product.bulk_price_usd
          end,
          _markup
        )
      else null
    end;
    _tier := 'normal';
  end if;

  select rate into _rate
  from public.exchange_rates
  where base_currency = 'USD' and quote_currency = 'EUR'
  order by fetched_at desc nulls last
  limit 1;

  _line := round((_participant.quantity * _unit)::numeric, 2);
  _variant_label := coalesce(nullif(trim(_product.dosage_vial), ''), _product.code);

  select ci.id into _existing_id
  from public.cart_items ci
  where ci.cart_id = _cart_id
    and ci.kit_share_id = _kit_share_id
    and ci.product_id = _product.id
  limit 1;

  if _existing_id is not null then
    update public.cart_items
    set
      quantity = _participant.quantity,
      unit_price_usd_snapshot = _unit,
      normal_price_usd_snapshot = _normal_unit,
      bulk_price_usd_snapshot = _bulk_unit,
      bulk_price_min_quantity_snapshot = _product.bulk_price_min_quantity,
      applied_price_tier = _tier,
      exchange_rate_snapshot = _rate,
      eur_value_snapshot = case
        when _rate is not null and _rate > 0 then round((_line * _rate)::numeric, 2)
        else null
      end,
      price_snapshot_at = now(),
      resolution_status = 'resolved',
      product_code_snapshot = _product.code,
      product_name_snapshot = _product.name,
      note = format(
        'Kit Anteil · %s · %s · Gemeinsames %s-Einheiten-Kit',
        _variant_label,
        _participant.quantity,
        _kit.kit_size_vials
      )
    where id = _existing_id
    returning id into _item_id;

    return _item_id;
  end if;

  select coalesce(max(position), -1) + 1 into _position
  from public.cart_items
  where cart_id = _cart_id;

  insert into public.cart_items (
    cart_id, position, product_id, product_code_input, product_code_snapshot, product_name_snapshot,
    quantity, unit_price_usd_snapshot, normal_price_usd_snapshot, bulk_price_usd_snapshot,
    bulk_price_min_quantity_snapshot, applied_price_tier, exchange_rate_snapshot, eur_value_snapshot,
    price_snapshot_at, resolution_status, note, kit_share_id
  )
  values (
    _cart_id, _position, _product.id, _product.code, _product.code, _product.name,
    _participant.quantity, _unit,
    _normal_unit,
    _bulk_unit, _product.bulk_price_min_quantity, _tier,
    _rate,
    case when _rate is not null and _rate > 0 then round((_line * _rate)::numeric, 2) else null end,
    now(), 'resolved',
    format(
      'Kit Anteil · %s · %s · Gemeinsames %s-Einheiten-Kit',
      _variant_label,
      _participant.quantity,
      _kit.kit_size_vials
    ),
    _kit_share_id
  )
  returning id into _item_id;

  return _item_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Kit request RPCs: area-scoped
-- ---------------------------------------------------------------------------

create or replace function public.assert_kit_area_access(_uid uuid, _area_key text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if _area_key is null or _area_key not in ('group_buy_1', 'group_buy_2') then
    raise exception 'Kits sind nur in Group-Buy-Bereichen verfügbar.' using errcode = 'P0001';
  end if;
  if not public.user_can_access_shop_area(_uid, _area_key) then
    raise exception 'Kein Zugriff auf diesen Shop-Bereich.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_kit_area_access(uuid, text) from public, anon, authenticated;

create or replace function public.reject_kit_participant_area_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _area text;
begin
  select shop_area into _area from public.kit_shares where id = NEW.kit_share_id;
  if auth.uid() is not null then
    perform public.assert_kit_area_access(auth.uid(), _area);
  end if;
  return NEW;
end;
$$;

revoke all on function public.reject_kit_participant_area_access() from public, anon, authenticated;

drop trigger if exists kit_share_participants_protect_area on public.kit_share_participants;
create trigger kit_share_participants_protect_area
  before insert on public.kit_share_participants
  for each row execute function public.reject_kit_participant_area_access();

drop function if exists public.create_kit_request(uuid, integer, integer, text, timestamptz);

create or replace function public.create_kit_request(
  _product_id uuid,
  _kit_size_vials integer,
  _my_quantity integer,
  _note text default null,
  _expires_at timestamptz default null,
  _shop_area text default 'group_buy_1'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _product public.products;
  _username text;
  _clean_note text;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  perform public.assert_kit_area_access(_uid, _shop_area);

  select username into _username from public.profiles where id = _uid;
  if _username is null or trim(_username) = '' then
    raise exception 'Bitte setze zuerst einen Benutzernamen.' using errcode = 'P0001';
  end if;

  if _kit_size_vials is null
     or _kit_size_vials < 10
     or _kit_size_vials > 100
     or mod(_kit_size_vials, 10) <> 0 then
    raise exception 'Ungültige Kitgröße. Die Größe muss ein Vielfaches von 10 sein.' using errcode = '22023';
  end if;

  if _my_quantity is null or _my_quantity < 1 then
    raise exception 'Ungültige Menge.' using errcode = '22023';
  end if;

  if _my_quantity >= _kit_size_vials then
    raise exception 'Der Ersteller muss mindestens 1 Vial offen lassen, damit andere beitreten können.' using errcode = '22023';
  end if;

  if _expires_at is not null and _expires_at <= now() then
    raise exception 'Das Ablaufdatum muss in der Zukunft liegen.' using errcode = '22023';
  end if;

  _clean_note := nullif(trim(coalesce(_note, '')), '');
  if _clean_note is not null and char_length(_clean_note) > 280 then
    raise exception 'Der Hinweis darf höchstens 280 Zeichen lang sein.' using errcode = '22023';
  end if;

  select * into _product from public.products where id = _product_id and is_active;
  if not found then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if not public.product_visible_in_shop_area(_product_id, _shop_area) then
    raise exception 'Produkt ist in diesem Bereich nicht verfügbar.' using errcode = 'P0002';
  end if;

  insert into public.kit_shares (
    product_id,
    creator_user_id,
    kit_size_vials,
    status,
    is_open_request,
    note,
    expires_at,
    shop_area
  )
  values (
    _product_id,
    _uid,
    _kit_size_vials,
    'open',
    true,
    _clean_note,
    _expires_at,
    _shop_area
  )
  returning * into _kit;

  insert into public.kit_share_participants (kit_share_id, user_id, quantity)
  values (_kit.id, _uid, _my_quantity);

  perform public.log_audit(
    _uid,
    'kit_request_created',
    'kit_share',
    _kit.id,
    null,
    jsonb_build_object(
      'productId', _product.id,
      'kitSizeVials', _kit.kit_size_vials,
      'creatorQuantity', _my_quantity,
      'shopArea', _shop_area
    )
  );

  return public.kit_request_card_payload(_kit, _product, _uid);
end;
$$;

revoke all on function public.create_kit_request(uuid, integer, integer, text, timestamptz, text) from public;
grant execute on function public.create_kit_request(uuid, integer, integer, text, timestamptz, text) to authenticated;

drop function if exists public.list_open_kit_requests(text, text, uuid, text, text, integer, text, integer, integer);

create or replace function public.list_open_kit_requests(
  _search text default null,
  _category text default null,
  _product_id uuid default null,
  _product_name text default null,
  _variant text default null,
  _min_remaining integer default null,
  _sort text default 'newest',
  _page integer default 1,
  _page_size integer default 20,
  _shop_area text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _term text;
  _page_n integer;
  _size integer;
  _offset integer;
  _total integer;
  _items jsonb;
  _area text;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  _area := coalesce(nullif(trim(_shop_area), ''), 'group_buy_1');
  perform public.assert_kit_area_access(_uid, _area);

  perform public.kit_request_expire_overdue();

  _term := nullif(trim(coalesce(_search, '')), '');
  _page_n := greatest(coalesce(_page, 1), 1);
  _size := least(greatest(coalesce(_page_size, 20), 1), 50);
  _offset := (_page_n - 1) * _size;

  if _sort is null or _sort not in ('newest', 'fewest_remaining', 'most_remaining') then
    _sort := 'newest';
  end if;

  select count(*)::integer
  into _total
  from public.kit_shares k
  join public.products p on p.id = k.product_id
  left join (
    select kit_share_id, sum(quantity)::integer as allocated
    from public.kit_share_participants
    group by kit_share_id
  ) a on a.kit_share_id = k.id
  where k.is_open_request
    and k.status = 'open'
    and k.shop_area = _area
    and p.is_active
    and public.product_visible_in_shop_area(p.id, _area)
    and (_product_id is null or k.product_id = _product_id)
    and (_product_name is null or lower(p.name) = lower(_product_name))
    and (_category is null or public.kit_request_shop_category(p) = _category)
    and (
      _variant is null
      or lower(coalesce(p.dosage_vial, '')) = lower(_variant)
    )
    and (
      _min_remaining is null
      or (k.kit_size_vials - coalesce(a.allocated, 0)) >= _min_remaining
    )
    and (
      _term is null
      or p.name ilike '%' || _term || '%'
      or p.code ilike '%' || _term || '%'
      or coalesce(p.dosage_vial, '') ilike '%' || _term || '%'
      or exists (
        select 1 from public.profiles pr
        where pr.id = k.creator_user_id
          and pr.username ilike '%' || _term || '%'
      )
    );

  select coalesce(jsonb_agg(q.card order by q.ordinality), '[]'::jsonb)
  into _items
  from (
    select
      public.kit_request_card_payload(k, p, _uid) as card,
      row_number() over (
        order by
          case when _sort = 'fewest_remaining' then (k.kit_size_vials - coalesce(a.allocated, 0)) end asc nulls last,
          case when _sort = 'most_remaining' then (k.kit_size_vials - coalesce(a.allocated, 0)) end desc nulls last,
          k.created_at desc
      ) as ordinality
    from public.kit_shares k
    join public.products p on p.id = k.product_id
    left join (
      select kit_share_id, sum(quantity)::integer as allocated
      from public.kit_share_participants
      group by kit_share_id
    ) a on a.kit_share_id = k.id
    where k.is_open_request
      and k.status = 'open'
      and k.shop_area = _area
      and p.is_active
      and public.product_visible_in_shop_area(p.id, _area)
      and (_product_id is null or k.product_id = _product_id)
      and (_product_name is null or lower(p.name) = lower(_product_name))
      and (_category is null or public.kit_request_shop_category(p) = _category)
      and (
        _variant is null
        or lower(coalesce(p.dosage_vial, '')) = lower(_variant)
      )
      and (
        _min_remaining is null
        or (k.kit_size_vials - coalesce(a.allocated, 0)) >= _min_remaining
      )
      and (
        _term is null
        or p.name ilike '%' || _term || '%'
        or p.code ilike '%' || _term || '%'
        or coalesce(p.dosage_vial, '') ilike '%' || _term || '%'
        or exists (
          select 1 from public.profiles pr
          where pr.id = k.creator_user_id
            and pr.username ilike '%' || _term || '%'
        )
      )
  ) q
  where q.ordinality > _offset
    and q.ordinality <= (_offset + _size);

  return jsonb_build_object(
    'items', coalesce(_items, '[]'::jsonb),
    'total', coalesce(_total, 0),
    'page', _page_n,
    'pageSize', _size
  );
end;
$$;

revoke all on function public.list_open_kit_requests(text, text, uuid, text, text, integer, text, integer, integer, text) from public;
grant execute on function public.list_open_kit_requests(text, text, uuid, text, text, integer, text, integer, integer, text) to authenticated;

drop function if exists public.list_my_kit_requests();

create or replace function public.list_my_kit_requests(_shop_area text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _items jsonb;
  _area text;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  _area := nullif(trim(coalesce(_shop_area, '')), '');
  if _area is not null then
    perform public.assert_kit_area_access(_uid, _area);
  end if;

  perform public.kit_request_expire_overdue();

  select coalesce(
    jsonb_agg(public.kit_request_card_payload(k, p, _uid) order by k.created_at desc),
    '[]'::jsonb
  )
  into _items
  from public.kit_shares k
  join public.products p on p.id = k.product_id
  where k.is_open_request
    and k.creator_user_id = _uid
    and (_area is null or k.shop_area = _area);

  return jsonb_build_object('items', coalesce(_items, '[]'::jsonb));
end;
$$;

revoke all on function public.list_my_kit_requests(text) from public;
grant execute on function public.list_my_kit_requests(text) to authenticated;

drop function if exists public.list_my_kit_request_participations();

create or replace function public.list_my_kit_request_participations(_shop_area text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _items jsonb;
  _area text;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  _area := nullif(trim(coalesce(_shop_area, '')), '');
  if _area is not null then
    perform public.assert_kit_area_access(_uid, _area);
  end if;

  perform public.kit_request_expire_overdue();

  select coalesce(
    jsonb_agg(public.kit_request_card_payload(k, p, _uid) order by part.created_at desc),
    '[]'::jsonb
  )
  into _items
  from public.kit_share_participants part
  join public.kit_shares k on k.id = part.kit_share_id
  join public.products p on p.id = k.product_id
  where k.is_open_request
    and part.user_id = _uid
    and k.creator_user_id <> _uid
    and (_area is null or k.shop_area = _area);

  return jsonb_build_object('items', coalesce(_items, '[]'::jsonb));
end;
$$;

revoke all on function public.list_my_kit_request_participations(text) from public;
grant execute on function public.list_my_kit_request_participations(text) to authenticated;

create or replace function public.preview_kit_request_join(
  _kit_share_id uuid,
  _quantity integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _kit public.kit_shares;
  _product public.products;
  _allocated integer;
  _remaining integer;
  _markup numeric;
  _base numeric;
  _my_price numeric;
  _unit numeric;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if _quantity is null or _quantity < 1 then
    raise exception 'Ungültige Menge.' using errcode = '22023';
  end if;

  select * into _kit from public.kit_shares where id = _kit_share_id;
  if not found or not coalesce(_kit.is_open_request, false) then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  perform public.assert_kit_area_access(_uid, _kit.shop_area);

  if _kit.expires_at is not null and _kit.expires_at <= now() then
    raise exception 'Dieses Kit-Gesuch ist abgelaufen.' using errcode = 'P0001';
  end if;

  if _kit.status <> 'open' then
    raise exception 'Dieses Kit-Gesuch nimmt keine weiteren Teilnehmer auf.' using errcode = 'P0001';
  end if;

  if _kit.creator_user_id = _uid then
    raise exception 'Du kannst deinem eigenen Gesuch nicht beitreten.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.kit_share_participants
    where kit_share_id = _kit_share_id and user_id = _uid
  ) then
    raise exception 'Du bist bereits Teilnehmer dieses Kits.' using errcode = 'P0001';
  end if;

  select * into _product from public.products where id = _kit.product_id and is_active;
  if not found then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  _product := public.apply_shop_area_product_overrides(_product, _kit.shop_area);

  _allocated := public.kit_share_allocated_total(_kit_share_id);
  _remaining := _kit.kit_size_vials - _allocated;
  if _quantity > _remaining then
    raise exception 'Nicht genügend Vials verfügbar.' using errcode = 'P0001';
  end if;

  _markup := public.markup_percent_for_area(_uid, _kit.shop_area, _product.id);
  _base := public.kit_share_participant_base_usd(
    _product,
    _kit.kit_size_vials,
    _allocated + _quantity,
    _quantity
  );
  _my_price := round(public.apply_role_markup(_base, _markup)::numeric, 2);
  _unit := public.kit_request_viewer_unit_usd(_product, _kit.kit_size_vials, _allocated + _quantity, _uid);

  return jsonb_build_object(
    'kitRequestId', _kit.id,
    'myQuantity', _quantity,
    'remainingQuantity', _remaining,
    'remainingAfterJoin', _remaining - _quantity,
    'status', _kit.status,
    'myPriceUsd', _my_price,
    'myUnitPriceUsd', _unit
  );
end;
$$;

revoke all on function public.preview_kit_request_join(uuid, integer) from public;
grant execute on function public.preview_kit_request_join(uuid, integer) to authenticated;
