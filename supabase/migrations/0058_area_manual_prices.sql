-- 0058_area_manual_prices.sql
-- Per-area imported vs manual grundpreis. price_usd stays the effective value
-- so 0056 checkout / apply_shop_area_product_overrides keep reading one column.
-- 0051–0056 are unchanged. Does not write public.products.price_usd.

alter table public.shop_area_product_prices
  add column if not exists imported_price_usd numeric;

alter table public.shop_area_product_prices
  add column if not exists manual_price_usd numeric;

alter table public.shop_area_product_prices
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

comment on column public.shop_area_product_prices.imported_price_usd is
  'Vendor-file grundpreis for this area. Never written to products.price_usd.';

comment on column public.shop_area_product_prices.manual_price_usd is
  'Admin override for this area. NULL = use imported_price_usd.';

comment on column public.shop_area_product_prices.price_usd is
  'Effective area grundpreis: coalesce(manual_price_usd, imported_price_usd).';

update public.shop_area_product_prices
set imported_price_usd = price_usd
where imported_price_usd is null
  and price_usd is not null;

create or replace function public.shop_area_product_prices_sync_effective()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.imported_price_usd is null then
    NEW.imported_price_usd := NEW.price_usd;
  end if;

  if NEW.imported_price_usd is null or NEW.imported_price_usd <= 0 then
    raise exception 'Händler-Grundpreis fehlt.' using errcode = 'P0001';
  end if;

  if NEW.manual_price_usd is not null and NEW.manual_price_usd <= 0 then
    NEW.manual_price_usd := null;
  end if;

  NEW.price_usd := coalesce(NEW.manual_price_usd, NEW.imported_price_usd);
  return NEW;
end;
$$;

drop trigger if exists shop_area_product_prices_sync_effective on public.shop_area_product_prices;

create trigger shop_area_product_prices_sync_effective
before insert or update on public.shop_area_product_prices
for each row execute function public.shop_area_product_prices_sync_effective();

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
  where shop_area_key = _area_key and product_id = _product.id;

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

drop function if exists public.apply_area_vendor_catalog(text, jsonb, text, text);

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
  _uid         uuid := auth.uid();
  _row         record;
  _keep        record;
  _prev_count  integer;
  _new_count   integer := 0;
  _skipped     integer := 0;
  _kept        integer := 0;
  _saved       jsonb := '[]'::jsonb;
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
        'product_id', product_id,
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

  delete from public.shop_area_products where shop_area_key = _area_key;
  delete from public.shop_area_product_prices where shop_area_key = _area_key;

  for _row in
    select *
    from jsonb_to_recordset(_rows) as x(
      product_id              uuid,
      price_usd               numeric,
      bulk_price_usd          numeric,
      bulk_price_min_quantity numeric,
      vendor_name             text,
      vendor_dosage           text,
      vendor_raw              jsonb
    )
  loop
    if not exists (select 1 from public.products where id = _row.product_id and is_active) then
      _skipped := _skipped + 1;
      continue;
    end if;

    if _row.price_usd is null or _row.price_usd <= 0 then
      _skipped := _skipped + 1;
      continue;
    end if;

    insert into public.shop_area_products (
      shop_area_key, product_id, is_active, updated_at,
      vendor_name, vendor_dosage, vendor_raw
    )
    values (
      _area_key, _row.product_id, true, now(),
      nullif(trim(coalesce(_row.vendor_name, '')), ''),
      nullif(trim(coalesce(_row.vendor_dosage, '')), ''),
      _row.vendor_raw
    )
    on conflict (shop_area_key, product_id)
    do update set
      is_active = true,
      updated_at = now(),
      vendor_name = excluded.vendor_name,
      vendor_dosage = excluded.vendor_dosage,
      vendor_raw = excluded.vendor_raw;

    insert into public.shop_area_product_prices (
      shop_area_key, product_id, imported_price_usd, manual_price_usd,
      price_usd, bulk_price_usd, bulk_price_min_quantity, updated_at, updated_by
    )
    values (
      _area_key,
      _row.product_id,
      _row.price_usd,
      null,
      _row.price_usd,
      _row.bulk_price_usd,
      _row.bulk_price_min_quantity,
      now(),
      _uid
    )
    on conflict (shop_area_key, product_id)
    do update set
      imported_price_usd = excluded.imported_price_usd,
      manual_price_usd = null,
      bulk_price_usd = excluded.bulk_price_usd,
      bulk_price_min_quantity = excluded.bulk_price_min_quantity,
      updated_at = now(),
      updated_by = excluded.updated_by;

    _new_count := _new_count + 1;
  end loop;

  if coalesce(_keep_manual_overrides, true) then
    for _keep in
      select *
      from jsonb_to_recordset(_saved) as x(product_id uuid, manual_price_usd numeric)
    loop
      update public.shop_area_product_prices
      set manual_price_usd = _keep.manual_price_usd,
          updated_at = now(),
          updated_by = _uid
      where shop_area_key = _area_key
        and product_id = _keep.product_id;
      if found then
        _kept := _kept + 1;
      end if;
    end loop;
  end if;

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
    'storage_path', btrim(_storage_path),
    'file_name', btrim(_file_name)
  );
end;
$$;

revoke all on function public.apply_area_vendor_catalog(text, jsonb, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.apply_area_vendor_catalog(text, jsonb, text, text, boolean)
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
  _uid uuid := auth.uid();
  _row public.shop_area_product_prices;
begin
  if not public.has_role(_uid, 'admin') then
    raise exception 'Nur Admins dürfen Bereichspreise ändern.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.shop_area_products
    where shop_area_key = _area_key
      and product_id = _product_id
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
    and product_id = _product_id
  returning * into _row;

  if not found then
    raise exception 'Kein Bereichspreis für diesen Artikel.' using errcode = 'P0001';
  end if;

  perform public.log_audit(
    _uid, 'vendor_price.manual', 'shop_area', null, null,
    jsonb_build_object(
      'areaKey', _area_key,
      'productId', _product_id,
      'manualPriceUsd', _row.manual_price_usd,
      'importedPriceUsd', _row.imported_price_usd,
      'effectivePriceUsd', _row.price_usd
    )
  );

  return _row;
end;
$$;

revoke all on function public.set_area_product_manual_price(text, uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.set_area_product_manual_price(text, uuid, numeric)
  to authenticated;
