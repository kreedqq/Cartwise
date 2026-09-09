-- 0059_area_product_categories.sql
-- Per-area display categories. Assortment stays the vendor catalog (0056–0058).
-- Prices stay on shop_area_product_prices. Never writes products.category.
-- 0051–0058 files are unchanged.

create table if not exists public.shop_area_categories (
  shop_area_key text not null references public.shop_areas (key) on delete cascade,
  category_key  text not null,
  label         text not null,
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users (id) on delete set null,
  primary key (shop_area_key, category_key),
  constraint shop_area_categories_key_format
    check (category_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint shop_area_categories_label_present
    check (length(btrim(label)) > 0)
);

comment on table public.shop_area_categories is
  'Display categories for one selling area. Not a product whitelist.';

alter table public.shop_area_categories enable row level security;

drop policy if exists shop_area_categories_admin_all on public.shop_area_categories;
create policy shop_area_categories_admin_all
  on public.shop_area_categories for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.shop_area_categories to authenticated;

insert into public.shop_area_categories (shop_area_key, category_key, label, sort_order, is_active)
select a.key, c.category_key, c.label, c.sort_order, true
from public.shop_areas a
cross join (
  values
    ('peptides', 'Peptides', 1),
    ('injectable-oils', 'Oils', 2),
    ('orals', 'Orals', 3),
    ('reconstitution-water', 'Reconstitution Water', 4)
) as c(category_key, label, sort_order)
on conflict (shop_area_key, category_key) do nothing;

alter table public.shop_area_products
  add column if not exists imported_category_key text;

alter table public.shop_area_products
  add column if not exists manual_category_key text;

comment on column public.shop_area_products.imported_category_key is
  'Category key from the dealer file for this area. Never written to products.category.';

comment on column public.shop_area_products.manual_category_key is
  'Admin display-category override for this area. NULL = use imported_category_key.';

-- One-time seed: map existing catalog rows from the global stored category
-- only when the string is unambiguous. Do not guess peptides.
update public.shop_area_products sap
set imported_category_key = mapped.category_key
from public.products p
cross join lateral (
  select case
    when lower(coalesce(p.category, '')) like '%reconstitution%' then 'reconstitution-water'
    when lower(coalesce(p.category, '')) like '%oral%' then 'orals'
    when lower(coalesce(p.category, '')) like '%oil%'
      or lower(coalesce(p.category, '')) like '%inject%' then 'injectable-oils'
    when lower(coalesce(p.category, '')) like '%peptide%' then 'peptides'
    else null
  end as category_key
) mapped
where sap.product_id = p.id
  and sap.imported_category_key is null
  and mapped.category_key is not null
  and exists (
    select 1
    from public.shop_area_categories c
    where c.shop_area_key = sap.shop_area_key
      and c.category_key = mapped.category_key
  );

create or replace function public.effective_area_category_key(
  _imported text,
  _manual text
)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(btrim(coalesce(_manual, _imported, '')), '');
$$;

revoke all on function public.effective_area_category_key(text, text)
  from public, anon, authenticated;
grant execute on function public.effective_area_category_key(text, text)
  to authenticated;

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
  _uid          uuid := auth.uid();
  _row          record;
  _keep         record;
  _keep_cat     record;
  _prev_count   integer;
  _new_count    integer := 0;
  _skipped      integer := 0;
  _kept         integer := 0;
  _kept_cats    integer := 0;
  _saved        jsonb := '[]'::jsonb;
  _saved_cats   jsonb := '[]'::jsonb;
  _saved_imported jsonb := '[]'::jsonb;
  _imported_cat text;
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

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'product_id', product_id,
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
      'product_id', product_id,
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
    if not exists (select 1 from public.products where id = _row.product_id and is_active) then
      _skipped := _skipped + 1;
      continue;
    end if;

    if _row.price_usd is null or _row.price_usd <= 0 then
      _skipped := _skipped + 1;
      continue;
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
      shop_area_key, product_id, is_active, updated_at,
      vendor_name, vendor_dosage, vendor_raw,
      imported_category_key, manual_category_key
    )
    values (
      _area_key, _row.product_id, true, now(),
      nullif(trim(coalesce(_row.vendor_name, '')), ''),
      nullif(trim(coalesce(_row.vendor_dosage, '')), ''),
      _row.vendor_raw,
      _imported_cat,
      null
    )
    on conflict (shop_area_key, product_id)
    do update set
      is_active = true,
      updated_at = now(),
      vendor_name = excluded.vendor_name,
      vendor_dosage = excluded.vendor_dosage,
      vendor_raw = excluded.vendor_raw,
      imported_category_key = excluded.imported_category_key,
      manual_category_key = null;

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

  for _keep_cat in
    select *
    from jsonb_to_recordset(_saved_imported) as x(product_id uuid, imported_category_key text)
  loop
    update public.shop_area_products
    set imported_category_key = _keep_cat.imported_category_key,
        updated_at = now()
    where shop_area_key = _area_key
      and product_id = _keep_cat.product_id
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

  for _keep_cat in
    select *
    from jsonb_to_recordset(_saved_cats) as x(product_id uuid, manual_category_key text)
  loop
    update public.shop_area_products
    set manual_category_key = _keep_cat.manual_category_key,
        updated_at = now()
    where shop_area_key = _area_key
      and product_id = _keep_cat.product_id
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
  _uid     uuid := auth.uid();
  _row     public.shop_area_products;
  _manual  text;
begin
  if not public.has_role(_uid, 'admin') then
    raise exception 'Nur Admins dürfen Bereichskategorien ändern.' using errcode = '42501';
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
    and product_id = _product_id
  returning * into _row;

  if not found then
    raise exception 'Artikel gehört nicht zum Händlerkatalog dieses Bereichs.'
      using errcode = 'P0001';
  end if;

  perform public.log_audit(
    _uid, 'vendor_category.manual', 'shop_area', null, null,
    jsonb_build_object(
      'areaKey', _area_key,
      'productId', _product_id,
      'manualCategoryKey', _row.manual_category_key,
      'importedCategoryKey', _row.imported_category_key
    )
  );

  return _row;
end;
$$;

revoke all on function public.set_area_product_category(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_area_product_category(text, uuid, text)
  to authenticated;

create or replace function public.set_shop_area_category_active(
  _area_key     text,
  _category_key text,
  _is_active    boolean
)
returns public.shop_area_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _row public.shop_area_categories;
begin
  if not public.has_role(_uid, 'admin') then
    raise exception 'Nur Admins dürfen Bereichskategorien ändern.' using errcode = '42501';
  end if;

  update public.shop_area_categories
  set is_active = coalesce(_is_active, false),
      updated_at = now(),
      updated_by = _uid
  where shop_area_key = _area_key
    and category_key = _category_key
  returning * into _row;

  if not found then
    raise exception 'Unbekannte Bereichskategorie: %', _category_key using errcode = 'P0001';
  end if;

  return _row;
end;
$$;

revoke all on function public.set_shop_area_category_active(text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.set_shop_area_category_active(text, text, boolean)
  to authenticated;

create or replace function public.rename_shop_area_category(
  _area_key     text,
  _category_key text,
  _label        text
)
returns public.shop_area_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid       uuid := auth.uid();
  _row       public.shop_area_categories;
  _new_label text := btrim(coalesce(_label, ''));
begin
  if not public.has_role(_uid, 'admin') then
    raise exception 'Nur Admins dürfen Bereichskategorien ändern.' using errcode = '42501';
  end if;

  if _new_label = '' then
    raise exception 'Kategoriename darf nicht leer sein.' using errcode = 'P0001';
  end if;

  update public.shop_area_categories
  set label = _new_label,
      updated_at = now(),
      updated_by = _uid
  where shop_area_key = _area_key
    and category_key = _category_key
  returning * into _row;

  if not found then
    raise exception 'Unbekannte Bereichskategorie: %', _category_key using errcode = 'P0001';
  end if;

  return _row;
end;
$$;

revoke all on function public.rename_shop_area_category(text, text, text)
  from public, anon, authenticated;
grant execute on function public.rename_shop_area_category(text, text, text)
  to authenticated;

create or replace function public.reorder_shop_area_categories(
  _area_key text,
  _keys     text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _i   integer;
begin
  if not public.has_role(_uid, 'admin') then
    raise exception 'Nur Admins dürfen Bereichskategorien ändern.' using errcode = '42501';
  end if;

  if _keys is null then
    raise exception 'Kategorie-Reihenfolge fehlt.' using errcode = 'P0001';
  end if;

  for _i in 1 .. coalesce(array_length(_keys, 1), 0) loop
    update public.shop_area_categories
    set sort_order = _i,
        updated_at = now(),
        updated_by = _uid
    where shop_area_key = _area_key
      and category_key = _keys[_i];
  end loop;
end;
$$;

revoke all on function public.reorder_shop_area_categories(text, text[])
  from public, anon, authenticated;
grant execute on function public.reorder_shop_area_categories(text, text[])
  to authenticated;

create or replace function public.create_shop_area_category(
  _area_key     text,
  _category_key text,
  _label        text
)
returns public.shop_area_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid       uuid := auth.uid();
  _row       public.shop_area_categories;
  _key       text := lower(btrim(coalesce(_category_key, '')));
  _new_label text := btrim(coalesce(_label, ''));
  _order     integer;
begin
  if not public.has_role(_uid, 'admin') then
    raise exception 'Nur Admins dürfen Bereichskategorien ändern.' using errcode = '42501';
  end if;

  if _key !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Ungültiger Kategorie-Schlüssel.' using errcode = 'P0001';
  end if;

  if _new_label = '' then
    raise exception 'Kategoriename darf nicht leer sein.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.shop_areas where key = _area_key) then
    raise exception 'Unbekannter Shop-Bereich: %', _area_key using errcode = 'P0001';
  end if;

  select coalesce(max(sort_order), 0) + 1
  into _order
  from public.shop_area_categories
  where shop_area_key = _area_key;

  insert into public.shop_area_categories (
    shop_area_key, category_key, label, sort_order, is_active, updated_at, updated_by
  )
  values (_area_key, _key, _new_label, _order, true, now(), _uid)
  returning * into _row;

  return _row;
end;
$$;

revoke all on function public.create_shop_area_category(text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_shop_area_category(text, text, text)
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
          'product_id', sap.product_id,
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
