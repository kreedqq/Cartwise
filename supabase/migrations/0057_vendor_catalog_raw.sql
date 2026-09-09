-- 0057_vendor_catalog_raw.sql
-- Stores dealer-file fields that do not map 1:1 onto products.* so a vendor
-- catalog keep the original row payload. Visibility and checkout stay on 0056
-- (product_visible_in_shop_area allowlist + fail-closed create_order).
-- 0051–0056 are unchanged.

alter table public.shop_area_products
  add column if not exists vendor_name text;

alter table public.shop_area_products
  add column if not exists vendor_dosage text;

alter table public.shop_area_products
  add column if not exists vendor_raw jsonb;

comment on column public.shop_area_products.vendor_raw is
  'Original dealer-file row (name, dosage, extras). Does not change global products.';

comment on table public.shop_area_documents is
  'The dealer file currently applied to this area catalog. One row per area. Updated only inside apply_area_vendor_catalog.';

-- 0056 created the 2-arg form. Replace it so catalog + applied document
-- pointer stay in one Postgres transaction. Storage upload stays client-side
-- and must happen first; this function must not run if that upload failed.
drop function if exists public.apply_area_vendor_catalog(text, jsonb);

create or replace function public.apply_area_vendor_catalog(
  _area_key     text,
  _rows         jsonb,
  _storage_path text,
  _file_name    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid        uuid := auth.uid();
  _row        record;
  _prev_count integer;
  _new_count  integer := 0;
  _skipped    integer := 0;
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
      shop_area_key, product_id, price_usd, bulk_price_usd, bulk_price_min_quantity, updated_at
    )
    values (
      _area_key,
      _row.product_id,
      _row.price_usd,
      _row.bulk_price_usd,
      _row.bulk_price_min_quantity,
      now()
    )
    on conflict (shop_area_key, product_id)
    do update set
      price_usd = excluded.price_usd,
      bulk_price_usd = excluded.bulk_price_usd,
      bulk_price_min_quantity = excluded.bulk_price_min_quantity,
      updated_at = now();

    _new_count := _new_count + 1;
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
      'storagePath', btrim(_storage_path),
      'fileName', btrim(_file_name)
    )
  );

  return jsonb_build_object(
    'added', _new_count,
    'removed', _prev_count,
    'skipped', _skipped,
    'storage_path', btrim(_storage_path),
    'file_name', btrim(_file_name)
  );
end;
$$;

revoke all on function public.apply_area_vendor_catalog(text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_area_vendor_catalog(text, jsonb, text, text) to authenticated;

-- Vendor catalogs accept the same spreadsheet family as the global import,
-- including legacy .xls (content type set by the client).
update storage.buckets
set allowed_mime_types = array[
      'application/pdf',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]
where id = 'pdf-imports';
