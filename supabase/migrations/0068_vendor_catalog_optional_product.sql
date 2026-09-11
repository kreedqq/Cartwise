-- 0068_vendor_catalog_optional_product.sql
-- Vendor-file rows are the assortment. Global products is an optional SKU link.
-- product_id may be NULL. Identity inside an area is vendor_code.
-- Does not write products.price_usd / name / category / code.
-- Does not rewrite historical orders or order_items.

-- ---------------------------------------------------------------------------
-- Schema: shop_area_products
-- ---------------------------------------------------------------------------

alter table public.shop_area_products
  add column if not exists id uuid;

alter table public.shop_area_products
  add column if not exists vendor_code text;

update public.shop_area_products sap
set vendor_code = p.code
from public.products p
where sap.product_id = p.id
  and (sap.vendor_code is null or btrim(sap.vendor_code) = '');

update public.shop_area_products
set vendor_code = upper(btrim(vendor_code))
where vendor_code is not null;

delete from public.shop_area_products
where vendor_code is null or btrim(vendor_code) = '';

update public.shop_area_products
set id = gen_random_uuid()
where id is null;

alter table public.shop_area_products
  alter column id set default gen_random_uuid();

alter table public.shop_area_products
  alter column id set not null;

alter table public.shop_area_products
  alter column vendor_code set not null;

alter table public.shop_area_products
  drop constraint if exists shop_area_products_pkey;

alter table public.shop_area_products
  drop constraint if exists shop_area_products_product_id_fkey;

alter table public.shop_area_products
  alter column product_id drop not null;

alter table public.shop_area_products
  add constraint shop_area_products_product_id_fkey
  foreign key (product_id) references public.products (id) on delete set null;

alter table public.shop_area_products
  add primary key (shop_area_key, vendor_code);

create unique index if not exists shop_area_products_id_key
  on public.shop_area_products (id);

create unique index if not exists shop_area_products_linked_product_uidx
  on public.shop_area_products (shop_area_key, product_id)
  where product_id is not null;

create unique index if not exists shop_area_product_prices_linked_product_uidx
  on public.shop_area_product_prices (shop_area_key, product_id)
  where product_id is not null;

comment on column public.shop_area_products.vendor_code is
  'Dealer SKU. Primary identity of a vendor catalog row inside one shop area.';

comment on column public.shop_area_products.product_id is
  'Optional link to global products. NULL = dealer SKU has no master row.';

comment on table public.shop_area_products is
  'Vendor catalog membership for one selling area. Existence is independent of products.';

-- ---------------------------------------------------------------------------
-- Schema: shop_area_product_prices
-- ---------------------------------------------------------------------------

alter table public.shop_area_product_prices
  add column if not exists vendor_code text;

update public.shop_area_product_prices pr
set vendor_code = p.code
from public.products p
where pr.product_id = p.id
  and (pr.vendor_code is null or btrim(pr.vendor_code) = '');

update public.shop_area_product_prices
set vendor_code = upper(btrim(vendor_code))
where vendor_code is not null;

delete from public.shop_area_product_prices
where vendor_code is null or btrim(vendor_code) = '';

alter table public.shop_area_product_prices
  alter column vendor_code set not null;

alter table public.shop_area_product_prices
  drop constraint if exists shop_area_product_prices_pkey;

alter table public.shop_area_product_prices
  drop constraint if exists shop_area_product_prices_product_id_fkey;

alter table public.shop_area_product_prices
  alter column product_id drop not null;

alter table public.shop_area_product_prices
  add constraint shop_area_product_prices_product_id_fkey
  foreign key (product_id) references public.products (id) on delete set null;

alter table public.shop_area_product_prices
  add primary key (shop_area_key, vendor_code);

comment on column public.shop_area_product_prices.vendor_code is
  'Dealer SKU matching shop_area_products.vendor_code in the same area.';

-- ---------------------------------------------------------------------------
-- Schema: cart_items.vendor_code
-- ---------------------------------------------------------------------------

alter table public.cart_items
  add column if not exists vendor_code text;

update public.cart_items
set vendor_code = upper(btrim(coalesce(product_code_snapshot, product_code_input)))
where vendor_code is null
  and coalesce(product_code_snapshot, product_code_input) is not null
  and btrim(coalesce(product_code_snapshot, product_code_input)) <> '';

create index if not exists cart_items_vendor_code_idx
  on public.cart_items (vendor_code);

comment on column public.cart_items.vendor_code is
  'Dealer SKU for the cart line. Used when product_id is null.';

-- ---------------------------------------------------------------------------
-- Display category text for kit-unit pricing only (storefront still uses 0059).
-- ---------------------------------------------------------------------------

create or replace function public.vendor_category_as_product_category(_category_key text)
returns text
language sql
immutable
set search_path = public
as $$
  select case _category_key
    when 'peptides' then 'Peptides'
    when 'orals' then 'Orals'
    when 'injectable-oils' then 'Injectable Oils'
    when 'reconstitution-water' then 'Reconstitution Water'
    else null
  end;
$$;

revoke all on function public.vendor_category_as_product_category(text)
  from public, anon, authenticated;

create or replace function public.vendor_catalog_as_product(
  _sap public.shop_area_products,
  _product public.products,
  _price public.shop_area_product_prices
)
returns public.products
language plpgsql
stable
set search_path = public
as $$
declare
  _out public.products;
  _cat text;
begin
  _cat := public.vendor_category_as_product_category(
    public.effective_area_category_key(_sap.imported_category_key, _sap.manual_category_key)
  );

  if _product.id is not null then
    _out := _product;
  else
    _out.id := _sap.id;
    _out.code := _sap.vendor_code;
    _out.name := coalesce(nullif(btrim(coalesce(_sap.vendor_name, '')), ''), _sap.vendor_code);
    _out.description := null;
    _out.dosage_vial := _sap.vendor_dosage;
    _out.category := _cat;
    _out.price_usd := 0;
    _out.bulk_price_usd := null;
    _out.bulk_price_min_quantity := null;
    _out.currency := 'USD';
    _out.is_active := true;
    _out.last_price_change_at := null;
    _out.created_at := coalesce(_sap.updated_at, now());
    _out.updated_at := coalesce(_sap.updated_at, now());
  end if;

  _out.code := _sap.vendor_code;
  if nullif(btrim(coalesce(_sap.vendor_name, '')), '') is not null then
    _out.name := btrim(_sap.vendor_name);
  end if;
  if nullif(btrim(coalesce(_sap.vendor_dosage, '')), '') is not null then
    _out.dosage_vial := btrim(_sap.vendor_dosage);
  end if;
  if _cat is not null then
    _out.category := _cat;
  end if;

  if _price.shop_area_key is not null then
    _out.price_usd := coalesce(_price.manual_price_usd, _price.imported_price_usd, _price.price_usd, _out.price_usd);
    if _price.bulk_price_usd is not null then
      _out.bulk_price_usd := _price.bulk_price_usd;
      _out.bulk_price_min_quantity := _price.bulk_price_min_quantity;
    end if;
  end if;

  _out.is_active := coalesce(_sap.is_active, true);
  return _out;
end;
$$;

revoke all on function public.vendor_catalog_as_product(
  public.shop_area_products, public.products, public.shop_area_product_prices
) from public, anon, authenticated;

create or replace function public.resolve_area_catalog_product(
  _area_key text,
  _vendor_code text,
  _product_id uuid
)
returns public.products
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _sap public.shop_area_products;
  _p public.products;
  _pr public.shop_area_product_prices;
  _code text := upper(btrim(coalesce(_vendor_code, '')));
begin
  if _code <> '' then
    select * into _sap
    from public.shop_area_products
    where shop_area_key = _area_key
      and vendor_code = _code
      and is_active
    limit 1;
  end if;

  if _sap.vendor_code is null and _product_id is not null then
    select * into _sap
    from public.shop_area_products
    where shop_area_key = _area_key
      and is_active
      and (product_id = _product_id or id = _product_id)
    limit 1;
  end if;

  if _sap.vendor_code is null then
    return null;
  end if;

  if _sap.product_id is not null then
    select * into _p from public.products where id = _sap.product_id;
  end if;

  select * into _pr
  from public.shop_area_product_prices
  where shop_area_key = _area_key
    and vendor_code = _sap.vendor_code;

  return public.vendor_catalog_as_product(_sap, _p, _pr);
end;
$$;

revoke all on function public.resolve_area_catalog_product(text, text, uuid)
  from public, anon, authenticated;

create or replace function public.vendor_code_visible_in_shop_area(
  _vendor_code text,
  _area_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_area_products sap
    where sap.shop_area_key = _area_key
      and sap.vendor_code = upper(btrim(coalesce(_vendor_code, '')))
      and sap.is_active
  );
$$;

revoke all on function public.vendor_code_visible_in_shop_area(text, text)
  from public, anon, authenticated;

create or replace function public.product_visible_in_shop_area(
  _product_id uuid,
  _area_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_area_products sap
    where sap.shop_area_key = _area_key
      and sap.is_active
      and (
        sap.product_id = _product_id
        or sap.id = _product_id
      )
  );
$$;

revoke all on function public.product_visible_in_shop_area(uuid, text)
  from public, anon, authenticated;

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
  _effective numeric;
begin
  select * into _over
  from public.shop_area_product_prices
  where shop_area_key = _area_key
    and vendor_code = upper(btrim(coalesce(_product.code, '')));

  if not found then
    select * into _over
    from public.shop_area_product_prices
    where shop_area_key = _area_key
      and product_id = _product.id;
  end if;

  if found then
    _effective := coalesce(_over.manual_price_usd, _over.imported_price_usd, _over.price_usd);
    if _effective is not null then
      _product.price_usd := _effective;
    end if;
    if _over.bulk_price_usd is not null then
      _product.bulk_price_usd := _over.bulk_price_usd;
      _product.bulk_price_min_quantity := _over.bulk_price_min_quantity;
    end if;
  end if;

  return _product;
end;
$$;

revoke all on function public.apply_shop_area_product_overrides(public.products, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- apply_area_vendor_catalog: vendor_code identity, optional product_id
-- ---------------------------------------------------------------------------

drop function if exists public.apply_area_vendor_catalog(text, jsonb, text, text, boolean);

create or replace function public.apply_area_vendor_catalog(
  _area_key              text,
  _rows                  jsonb,
  _storage_path          text,
  _file_name             text,
  _keep_manual_overrides boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid            uuid := auth.uid();
  _row            record;
  _keep           record;
  _keep_cat       record;
  _prev_count     integer;
  _new_count      integer := 0;
  _skipped        integer := 0;
  _kept           integer := 0;
  _kept_cats      integer := 0;
  _saved          jsonb := '[]'::jsonb;
  _saved_cats     jsonb := '[]'::jsonb;
  _saved_imported jsonb := '[]'::jsonb;
  _imported_cat   text;
  _vendor_code    text;
  _product_id     uuid;
begin
  if not public.has_role(_uid, 'admin') then
    raise exception 'Nur Admins dürfen den Händlerkatalog aktualisieren.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.shop_areas where key = _area_key) then
    raise exception 'Unbekannter Shop-Bereich: %', _area_key
      using errcode = 'P0001';
  end if;

  if nullif(btrim(coalesce(_storage_path, '')), '') is null
     or nullif(btrim(coalesce(_file_name, '')), '') is null then
    raise exception 'Händlerkatalog braucht eine gespeicherte Händlerdatei.'
      using errcode = 'P0001';
  end if;

  select count(*)::integer into _prev_count
  from public.shop_area_products
  where shop_area_key = _area_key;

  if coalesce(_keep_manual_overrides, true) then
    select coalesce(
      jsonb_agg(jsonb_build_object(
        'vendor_code', vendor_code,
        'manual_price_usd', manual_price_usd
      )),
      '[]'::jsonb
    )
    into _saved
    from public.shop_area_product_prices
    where shop_area_key = _area_key
      and manual_price_usd is not null
      and manual_price_usd > 0;
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'vendor_code', vendor_code,
      'manual_category_key', manual_category_key
    )),
    '[]'::jsonb
  )
  into _saved_cats
  from public.shop_area_products
  where shop_area_key = _area_key
    and manual_category_key is not null
    and btrim(manual_category_key) <> '';

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'vendor_code', vendor_code,
      'imported_category_key', imported_category_key
    )),
    '[]'::jsonb
  )
  into _saved_imported
  from public.shop_area_products
  where shop_area_key = _area_key
    and imported_category_key is not null
    and btrim(imported_category_key) <> '';

  delete from public.shop_area_products where shop_area_key = _area_key;
  delete from public.shop_area_product_prices where shop_area_key = _area_key;

  for _row in
    select *
    from jsonb_to_recordset(_rows) as x(
      vendor_code             text,
      product_id              uuid,
      price_usd               numeric,
      bulk_price_usd          numeric,
      bulk_price_min_quantity numeric,
      vendor_name             text,
      vendor_dosage           text,
      vendor_raw              jsonb,
      imported_category_key   text
    )
  loop
    _vendor_code := upper(btrim(coalesce(_row.vendor_code, '')));
    if _vendor_code = '' then
      _skipped := _skipped + 1;
      continue;
    end if;

    if _row.price_usd is null or _row.price_usd <= 0 then
      _skipped := _skipped + 1;
      continue;
    end if;

    _product_id := _row.product_id;
    if _product_id is not null and not exists (
      select 1 from public.products where id = _product_id
    ) then
      _product_id := null;
    end if;

    _imported_cat := nullif(btrim(coalesce(_row.imported_category_key, '')), '');
    if _imported_cat is not null and not exists (
      select 1
      from public.shop_area_categories
      where shop_area_key = _area_key
        and category_key = _imported_cat
    ) then
      _imported_cat := null;
    end if;

    insert into public.shop_area_products (
      shop_area_key, vendor_code, product_id, is_active, updated_at,
      vendor_name, vendor_dosage, vendor_raw,
      imported_category_key, manual_category_key
    )
    values (
      _area_key, _vendor_code, _product_id, true, now(),
      nullif(trim(coalesce(_row.vendor_name, '')), ''),
      nullif(trim(coalesce(_row.vendor_dosage, '')), ''),
      _row.vendor_raw,
      _imported_cat,
      null
    )
    on conflict (shop_area_key, vendor_code)
    do update set
      product_id = excluded.product_id,
      is_active = true,
      updated_at = now(),
      vendor_name = excluded.vendor_name,
      vendor_dosage = excluded.vendor_dosage,
      vendor_raw = excluded.vendor_raw,
      imported_category_key = excluded.imported_category_key,
      manual_category_key = null;

    insert into public.shop_area_product_prices (
      shop_area_key, vendor_code, product_id, imported_price_usd, manual_price_usd,
      price_usd, bulk_price_usd, bulk_price_min_quantity, updated_at, updated_by
    )
    values (
      _area_key,
      _vendor_code,
      _product_id,
      _row.price_usd,
      null,
      _row.price_usd,
      _row.bulk_price_usd,
      _row.bulk_price_min_quantity,
      now(),
      _uid
    )
    on conflict (shop_area_key, vendor_code)
    do update set
      product_id = excluded.product_id,
      imported_price_usd = excluded.imported_price_usd,
      manual_price_usd = null,
      bulk_price_usd = excluded.bulk_price_usd,
      bulk_price_min_quantity = excluded.bulk_price_min_quantity,
      updated_at = now(),
      updated_by = excluded.updated_by;

    _new_count := _new_count + 1;
  end loop;

  for _keep_cat in
    select *
    from jsonb_to_recordset(_saved_imported) as x(vendor_code text, imported_category_key text)
  loop
    update public.shop_area_products
    set imported_category_key = _keep_cat.imported_category_key,
        updated_at = now()
    where shop_area_key = _area_key
      and vendor_code = upper(btrim(_keep_cat.vendor_code))
      and imported_category_key is null
      and exists (
        select 1
        from public.shop_area_categories c
        where c.shop_area_key = _area_key
          and c.category_key = _keep_cat.imported_category_key
      );
  end loop;

  if coalesce(_keep_manual_overrides, true) then
    for _keep in
      select *
      from jsonb_to_recordset(_saved) as x(vendor_code text, manual_price_usd numeric)
    loop
      update public.shop_area_product_prices
      set manual_price_usd = _keep.manual_price_usd,
          updated_at = now(),
          updated_by = _uid
      where shop_area_key = _area_key
        and vendor_code = upper(btrim(_keep.vendor_code));
      if found then
        _kept := _kept + 1;
      end if;
    end loop;
  end if;

  for _keep_cat in
    select *
    from jsonb_to_recordset(_saved_cats) as x(vendor_code text, manual_category_key text)
  loop
    update public.shop_area_products
    set manual_category_key = _keep_cat.manual_category_key,
        updated_at = now()
    where shop_area_key = _area_key
      and vendor_code = upper(btrim(_keep_cat.vendor_code))
      and exists (
        select 1
        from public.shop_area_categories c
        where c.shop_area_key = _area_key
          and c.category_key = _keep_cat.manual_category_key
      );
    if found then
      _kept_cats := _kept_cats + 1;
    end if;
  end loop;

  insert into public.shop_area_documents (
    shop_area_key, storage_path, file_name, uploaded_by, updated_at
  )
  values (
    _area_key, btrim(_storage_path), btrim(_file_name), _uid, now()
  )
  on conflict (shop_area_key) do update set
    storage_path = excluded.storage_path,
    file_name = excluded.file_name,
    uploaded_by = excluded.uploaded_by,
    updated_at = now();

  perform public.log_audit(
    _uid, 'vendor_catalog.apply', 'shop_area', null, null,
    jsonb_build_object(
      'areaKey', _area_key,
      'prevCount', _prev_count,
      'newCount', _new_count,
      'skipped', _skipped,
      'keptManuals', _kept,
      'keptCategoryManuals', _kept_cats,
      'keepManualOverrides', coalesce(_keep_manual_overrides, true),
      'storagePath', btrim(_storage_path),
      'fileName', btrim(_file_name)
    )
  );

  return jsonb_build_object(
    'added', _new_count,
    'removed', _prev_count,
    'skipped', _skipped,
    'kept_manuals', _kept,
    'kept_category_manuals', _kept_cats,
    'storage_path', btrim(_storage_path),
    'file_name', btrim(_file_name)
  );
end;
$$;

revoke all on function public.apply_area_vendor_catalog(text, jsonb, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.apply_area_vendor_catalog(text, jsonb, text, text, boolean)
  to authenticated;

create or replace function public.set_area_vendor_manual_price(
  _area_key         text,
  _vendor_code      text,
  _manual_price_usd numeric
)
returns public.shop_area_product_prices
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _row public.shop_area_product_prices;
  _code text := upper(btrim(coalesce(_vendor_code, '')));
begin
  if not public.has_role(_uid, 'admin') then
    raise exception 'Nur Admins dürfen Bereichspreise ändern.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.shop_area_products
    where shop_area_key = _area_key
      and vendor_code = _code
      and is_active
  ) then
    raise exception 'Artikel gehört nicht zum Händlerkatalog dieses Bereichs.'
      using errcode = 'P0001';
  end if;

  update public.shop_area_product_prices
  set manual_price_usd = case
        when _manual_price_usd is null or _manual_price_usd <= 0 then null
        else _manual_price_usd
      end,
      updated_at = now(),
      updated_by = _uid
  where shop_area_key = _area_key
    and vendor_code = _code
  returning * into _row;

  if not found then
    raise exception 'Kein Bereichspreis für diesen Artikel.' using errcode = 'P0001';
  end if;

  perform public.log_audit(
    _uid, 'vendor_price.manual', 'shop_area', null, null,
    jsonb_build_object(
      'areaKey', _area_key,
      'vendorCode', _code,
      'productId', _row.product_id,
      'manualPriceUsd', _row.manual_price_usd,
      'importedPriceUsd', _row.imported_price_usd,
      'effectivePriceUsd', _row.price_usd
    )
  );

  return _row;
end;
$$;

revoke all on function public.set_area_vendor_manual_price(text, text, numeric)
  from public, anon, authenticated;
grant execute on function public.set_area_vendor_manual_price(text, text, numeric)
  to authenticated;

create or replace function public.set_area_product_manual_price(
  _area_key         text,
  _product_id       uuid,
  _manual_price_usd numeric
)
returns public.shop_area_product_prices
language plpgsql
security definer
set search_path = public
as $$
declare
  _code text;
begin
  select vendor_code into _code
  from public.shop_area_products
  where shop_area_key = _area_key
    and product_id = _product_id
    and is_active
  limit 1;

  if _code is null then
    raise exception 'Artikel gehört nicht zum Händlerkatalog dieses Bereichs.'
      using errcode = 'P0001';
  end if;

  return public.set_area_vendor_manual_price(_area_key, _code, _manual_price_usd);
end;
$$;

revoke all on function public.set_area_product_manual_price(text, uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.set_area_product_manual_price(text, uuid, numeric)
  to authenticated;

create or replace function public.set_area_vendor_category(
  _area_key     text,
  _vendor_code  text,
  _category_key text
)
returns public.shop_area_products
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid     uuid := auth.uid();
  _row     public.shop_area_products;
  _manual  text;
  _code    text := upper(btrim(coalesce(_vendor_code, '')));
begin
  if not public.has_role(_uid, 'admin') then
    raise exception 'Nur Admins dürfen Bereichskategorien ändern.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.shop_area_products
    where shop_area_key = _area_key
      and vendor_code = _code
      and is_active
  ) then
    raise exception 'Artikel gehört nicht zum Händlerkatalog dieses Bereichs.'
      using errcode = 'P0001';
  end if;

  _manual := nullif(btrim(coalesce(_category_key, '')), '');

  if _manual is not null and not exists (
    select 1
    from public.shop_area_categories
    where shop_area_key = _area_key
      and category_key = _manual
  ) then
    raise exception 'Unbekannte Bereichskategorie: %', _manual using errcode = 'P0001';
  end if;

  update public.shop_area_products
  set manual_category_key = case
        when _manual is null then null
        when _manual is not distinct from imported_category_key then null
        else _manual
      end,
      updated_at = now()
  where shop_area_key = _area_key
    and vendor_code = _code
  returning * into _row;

  if not found then
    raise exception 'Artikel gehört nicht zum Händlerkatalog dieses Bereichs.'
      using errcode = 'P0001';
  end if;

  perform public.log_audit(
    _uid, 'vendor_category.manual', 'shop_area', null, null,
    jsonb_build_object(
      'areaKey', _area_key,
      'vendorCode', _code,
      'productId', _row.product_id,
      'manualCategoryKey', _row.manual_category_key,
      'importedCategoryKey', _row.imported_category_key
    )
  );

  return _row;
end;
$$;

revoke all on function public.set_area_vendor_category(text, text, text)
  from public, anon, authenticated;
grant execute on function public.set_area_vendor_category(text, text, text)
  to authenticated;

create or replace function public.set_area_product_category(
  _area_key     text,
  _product_id   uuid,
  _category_key text
)
returns public.shop_area_products
language plpgsql
security definer
set search_path = public
as $$
declare
  _code text;
begin
  select vendor_code into _code
  from public.shop_area_products
  where shop_area_key = _area_key
    and product_id = _product_id
    and is_active
  limit 1;

  if _code is null then
    raise exception 'Artikel gehört nicht zum Händlerkatalog dieses Bereichs.'
      using errcode = 'P0001';
  end if;

  return public.set_area_vendor_category(_area_key, _code, _category_key);
end;
$$;

revoke all on function public.set_area_product_category(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_area_product_category(text, uuid, text)
  to authenticated;

create or replace function public.list_shop_area_storefront(_shop_area text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.user_can_access_shop_area(auth.uid(), _shop_area) then
    raise exception 'Kein Zugriff auf diesen Shop-Bereich.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'category_key', c.category_key,
          'label', c.label,
          'sort_order', c.sort_order,
          'is_active', c.is_active
        )
        order by c.sort_order, c.label
      )
      from public.shop_area_categories c
      where c.shop_area_key = _shop_area
        and c.is_active
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_id', coalesce(sap.product_id, sap.id),
          'vendor_code', sap.vendor_code,
          'category_key', public.effective_area_category_key(
            sap.imported_category_key,
            sap.manual_category_key
          )
        )
      )
      from public.shop_area_products sap
      join public.shop_area_categories c
        on c.shop_area_key = sap.shop_area_key
       and c.category_key = public.effective_area_category_key(
         sap.imported_category_key,
         sap.manual_category_key
       )
      where sap.shop_area_key = _shop_area
        and sap.is_active
        and c.is_active
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.list_shop_area_storefront(text)
  from public, anon, authenticated;
grant execute on function public.list_shop_area_storefront(text)
  to authenticated;

create or replace function public.list_shop_products_for_area(_shop_area text)
returns setof public.products
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid          uuid := auth.uid();
  _area         public.shop_areas;
  _p            public.products;
  _src          public.products;
  _sap          public.shop_area_products;
  _master       public.products;
  _price        public.shop_area_product_prices;
  _pct          numeric;
  _factor       numeric;
  _divisor      numeric;
  _catalog_unit numeric;
  _src_price    numeric;
  _src_bulk     numeric;
  _discounts    boolean;
  _markup_id    uuid;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  perform public.assert_public_site_access();

  select * into _area from public.shop_areas where key = _shop_area and is_active;
  if not found then
    raise exception 'Unbekannter oder inaktiver Shop-Bereich.' using errcode = 'P0001';
  end if;

  if not public.user_can_access_shop_area(_uid, _shop_area) then
    raise exception 'Kein Zugriff auf diesen Shop-Bereich.' using errcode = '42501';
  end if;

  _factor    := _area.base_price_factor_pct / 100.0;
  _divisor   := _area.kit_unit_divisor;
  _discounts := public.quantity_discounts_enabled();

  for _sap in
    select *
    from public.shop_area_products
    where shop_area_key = _shop_area
      and is_active
    order by vendor_code
  loop
    _master := null::public.products;
    if _sap.product_id is not null then
      select * into _master from public.products where id = _sap.product_id;
    end if;

    select * into _price
    from public.shop_area_product_prices
    where shop_area_key = _shop_area
      and vendor_code = _sap.vendor_code;

    _src := public.vendor_catalog_as_product(_sap, _master, _price);
    if _src.price_usd is null or _src.price_usd <= 0 then
      continue;
    end if;

    _p         := public.apply_shop_area_product_overrides(_src, _shop_area);
    _markup_id := coalesce(_sap.product_id, _p.id);
    _pct       := public.markup_percent_for_area(_uid, _shop_area, _markup_id);
    _src_price := _p.price_usd;
    _src_bulk  := _p.bulk_price_usd;

    if not _discounts then
      _src_bulk := null;
      _p.bulk_price_usd := null;
      _p.bulk_price_min_quantity := null;
    end if;

    if _area.pricing_profile = 'group_buy' then
      _p.price_usd := public.apply_role_markup(_src_price * _factor, _pct)::numeric(12, 4);
      if _discounts
         and _src_bulk is not null
         and _p.bulk_price_min_quantity is not null
         and _p.bulk_price_min_quantity > 0 then
        _p.bulk_price_usd := public.apply_role_markup(
          public.catalog_bulk_unit_price(_src_price, _src_bulk, _p.bulk_price_min_quantity) * _factor,
          _pct
        )::numeric(12, 4);
      else
        _p.bulk_price_usd := null;
        _p.bulk_price_min_quantity := null;
      end if;
    else
      if public.product_uses_kit_unit_pricing(_p) then
        _catalog_unit := (_src_price / _divisor) * _factor;
      else
        _catalog_unit := public.sell_unit_price(
          _src_price, _src_bulk, _p.bulk_price_min_quantity, 1, 0
        ) * _factor;
      end if;
      _p.price_usd               := public.apply_role_markup(_catalog_unit, _pct)::numeric(12, 4);
      _p.bulk_price_usd          := null;
      _p.bulk_price_min_quantity := null;
    end if;
    return next _p;
  end loop;
end;
$$;

revoke all on function public.list_shop_products_for_area(text) from public;
grant execute on function public.list_shop_products_for_area(text) to authenticated;

create or replace function public.sync_cart_selling_prices(_cart_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid          uuid := auth.uid();
  _area         text;
  _area_factor  numeric := 1.0;
  _markup       numeric;
  _item         record;
  _product      public.products;
  _p_for_bulk   public.products;
  _sell         numeric;
  _normal       numeric;
  _bulk         numeric;
  _tier         text;
  _rate         numeric;
  _line         numeric;
  _discounts    boolean;
  _code         text;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  perform public.assert_public_site_access();

  if not exists (
    select 1 from public.carts
    where id = _cart_id and user_id = _uid and deleted_at is null and status <> 'ordered'
  ) then
    return;
  end if;

  select shop_area into _area from public.carts where id = _cart_id;

  if not public.user_can_access_shop_area(_uid, coalesce(_area, 'shop')) then
    return;
  end if;

  _markup    := public.markup_percent_for(_uid);
  _discounts := public.quantity_discounts_enabled();

  select base_price_factor_pct / 100.0
  into _area_factor
  from public.shop_areas
  where key = coalesce(_area, 'shop');
  _area_factor := coalesce(_area_factor, 1.0);

  for _item in
    select * from public.cart_items where cart_id = _cart_id
  loop
    if _item.kit_share_id is not null then
      continue;
    end if;

    _code := coalesce(
      nullif(btrim(coalesce(_item.vendor_code, '')), ''),
      nullif(btrim(coalesce(_item.product_code_snapshot, '')), ''),
      nullif(btrim(coalesce(_item.product_code_input, '')), '')
    );
    _product := public.resolve_area_catalog_product(coalesce(_area, 'shop'), _code, _item.product_id);
    if _product.id is null or not _product.is_active then
      continue;
    end if;

    _sell   := public.shop_area_sell_unit_price(_product, _item.quantity, _markup, coalesce(_area, 'shop'));
    _normal := public.shop_area_sell_unit_price(_product, 1,             _markup, coalesce(_area, 'shop'));

    if public.shop_area_pricing_profile(coalesce(_area, 'shop')) = 'retail'
       and public.product_uses_kit_unit_pricing(_product) then
      _bulk := null;
      _tier := 'normal';
    elsif _discounts
          and _product.bulk_price_usd is not null
          and _product.bulk_price_min_quantity is not null
          and _product.bulk_price_min_quantity > 0 then
      _p_for_bulk := public.apply_shop_area_product_overrides(_product, coalesce(_area, 'shop'));
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
      resolution_status                = 'resolved',
      product_code_snapshot            = _product.code,
      product_name_snapshot            = _product.name,
      vendor_code                      = _product.code
    where id = _item.id;
  end loop;
end;
$$;

revoke all on function public.sync_cart_selling_prices(uuid) from public;
grant execute on function public.sync_cart_selling_prices(uuid) to authenticated;

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
  _cart                 record;
  _area                 text;
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
  _telegram             text;
  _first                text;
  _last                 text;
  _street               text;
  _house                text;
  _extra                text;
  _postal               text;
  _city                 text;
  _country              text;
  _delivery             text;
  _packstation          text;
  _post_number          text;
  _role_name            text;
  _catalog_unit         numeric;
  _base_line            numeric(12, 2);
  _allocated            integer;
  _code                 text;
  _master_id            uuid;
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

  _area := coalesce(_cart.shop_area, 'shop');

  if not public.user_can_access_shop_area(auth.uid(), _area) then
    raise exception 'Kein Zugriff auf diesen Shop-Bereich.' using errcode = '42501';
  end if;

  select base_price_factor_pct / 100.0
  into _area_factor
  from public.shop_areas
  where key = _area;
  _area_factor := coalesce(_area_factor, 1.0);

  if _cart.status not in ('draft', 'ready') then
    raise exception 'Dieser Warenkorb wurde bereits bestellt oder ist archiviert.' using errcode = 'P0001';
  end if;

  select count(*) into _line_count
  from public.cart_items ci
  where ci.cart_id = _cart_id
    and ci.quantity > 0
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
    _delivery,
    _first, _last, _street, _house,
    _extra, _packstation, _post_number,
    _postal, _city, _country,
    0, null, null, now(),
    _area
  )
  returning id, order_number into _order_id, _order_number;

  for _item in
    select ci.*
    from public.cart_items ci
    where ci.cart_id = _cart_id and ci.quantity > 0
    order by ci.position
  loop
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

      if public.shop_area_pricing_profile(_area) = 'retail' then
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
      _product := public.resolve_area_catalog_product(_area, _code, _item.product_id);
      if _product.id is null then
        raise exception 'Ein Produkt gehört nicht zum aktuellen Händlerkatalog.'
          using errcode = 'P0002';
      end if;

      _sell   := public.shop_area_sell_unit_price(_product, _item.quantity, _markup, _area);
      _normal := public.shop_area_sell_unit_price(_product, 1,             _markup, _area);

      if public.shop_area_pricing_profile(_area) = 'retail'
         and public.product_uses_kit_unit_pricing(_product) then
        _bulk := null;
        _tier := 'normal';
      elsif public.quantity_discounts_enabled()
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
    where sap.shop_area_key = _area
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
      _catalog_unit := public.shop_area_catalog_unit(_product, _item.quantity, _area);
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

  update public.carts
  set status = 'ordered', is_active_cart = false
  where id = _cart_id;

  insert into public.order_status_history (order_id, old_status, new_status, changed_by)
  values (_order_id, null, 'pending', auth.uid());

  perform public.log_audit(
    auth.uid(), 'order.create', 'order', _order_id, null,
    jsonb_build_object(
      'orderNumber',   _order_number,
      'totalUsd',      _total_usd,
      'itemCount',     _line_count,
      'paymentMethod', _payment_method,
      'deliveryMethod', _delivery,
      'shopArea',      _area
    )
  );

  return jsonb_build_object('orderId', _order_id, 'orderNumber', _order_number, 'totalUsd', _total_usd);
end;
$$;

revoke all on function public.create_order(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.create_order(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;
