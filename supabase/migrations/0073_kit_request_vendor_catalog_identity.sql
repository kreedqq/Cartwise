-- 0073_kit_request_vendor_catalog_identity.sql
-- Vendor-only area catalog rows (product_id NULL) can be kit-requested without
-- inventing a products row and without mapping to another SKU.
-- Stable identity is shop_area + vendor_code. area_product_id is the current
-- catalog row only — catalog re-import recreates sap rows, so there is no FK.
-- Runtime resolve: master products.id, then sap.id, then vendor_code + shop_area.
-- Linked master products keep the 0072 path. Additive. Fail closed.
-- No historical kit or order rewrites. Does not touch 0070.
-- Does not replace the live One Cart create_order wrapper. Checkout
-- identity is patched in create_one_area_order only.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

alter table public.kit_shares
  add column if not exists area_product_id uuid;

alter table public.kit_shares
  add column if not exists vendor_code text;

alter table public.kit_shares
  alter column product_id drop not null;

update public.kit_shares
set vendor_code = upper(btrim(vendor_code))
where vendor_code is not null;

alter table public.kit_shares
  drop constraint if exists kit_shares_catalog_identity_chk;

alter table public.kit_shares
  add constraint kit_shares_catalog_identity_chk
  check (product_id is not null or vendor_code is not null);

create index if not exists kit_shares_area_product_id_idx
  on public.kit_shares (area_product_id);

create index if not exists kit_shares_vendor_code_idx
  on public.kit_shares (shop_area, vendor_code);

comment on column public.kit_shares.area_product_id is
  'Area catalog row when the kit article has no global products.id.';

comment on column public.kit_shares.product_id is
  'Global products.id when the area row is linked. NULL for vendor-only kits.';

comment on column public.kit_shares.vendor_code is
  'Dealer SKU snapshot. Required identity for vendor-only kits.';

-- ---------------------------------------------------------------------------
-- Catalog product for a kit share (linked master or vendor-only sap.id)
-- ---------------------------------------------------------------------------

create or replace function public.kit_share_catalog_product(_kit public.kit_shares)
returns public.products
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _product public.products;
  _sap public.shop_area_products;
  _price public.shop_area_product_prices;
begin
  if _kit.product_id is not null then
    select * into _product
    from public.products
    where id = _kit.product_id;
    if found then
      return _product;
    end if;
  end if;

  if _kit.area_product_id is not null then
    select * into _sap
    from public.shop_area_products
    where id = _kit.area_product_id
      and shop_area_key = _kit.shop_area
      and is_active;
  end if;

  if _sap.vendor_code is null and nullif(btrim(coalesce(_kit.vendor_code, '')), '') is not null then
    select * into _sap
    from public.shop_area_products
    where shop_area_key = _kit.shop_area
      and vendor_code = upper(btrim(_kit.vendor_code))
      and is_active
    limit 1;
  end if;

  if _sap.vendor_code is null then
    return _product;
  end if;

  select * into _price
  from public.shop_area_product_prices
  where shop_area_key = _kit.shop_area
    and vendor_code = _sap.vendor_code;

  return public.vendor_catalog_as_product(_sap, _product, _price);
end;
$$;

revoke all on function public.kit_share_catalog_product(public.kit_shares)
  from public, anon, authenticated;

create or replace function public.kit_request_catalog_id(_kit public.kit_shares)
returns uuid
language sql
stable
as $$
  select coalesce(_kit.product_id, _kit.area_product_id);
$$;

revoke all on function public.kit_request_catalog_id(public.kit_shares)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Requestable ids: linked masters AND vendor-only sap.id
-- ---------------------------------------------------------------------------

create or replace function public.list_kit_requestable_product_ids(_shop_area text)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _ids uuid[];
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  perform public.assert_kit_area_access(_uid, _shop_area);

  select coalesce(array_agg(distinct catalog_id), '{}'::uuid[])
    into _ids
  from (
    select sap.product_id as catalog_id
    from public.shop_area_products sap
    where sap.shop_area_key = _shop_area
      and sap.is_active
      and sap.product_id is not null
      and exists (select 1 from public.products p where p.id = sap.product_id)
    union
    select sap.id
    from public.shop_area_products sap
    where sap.shop_area_key = _shop_area
      and sap.is_active
      and sap.product_id is null
  ) q;

  return _ids;
end;
$$;

revoke all on function public.list_kit_requestable_product_ids(text) from public;
grant execute on function public.list_kit_requestable_product_ids(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Category match accepts master id or area catalog id
-- ---------------------------------------------------------------------------

create or replace function public.kit_request_matches_area_category(
  _product_id uuid,
  _shop_area text,
  _category text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _category is null
    or exists (
      select 1
      from public.shop_area_products sap
      join public.shop_area_categories sac
        on sac.shop_area_key = sap.shop_area_key
       and sac.category_key = public.effective_area_category_key(
         sap.imported_category_key,
         sap.manual_category_key
       )
      where sap.shop_area_key = _shop_area
        and (
          sap.product_id = _product_id
          or sap.id = _product_id
        )
        and sac.is_active
        and sac.category_key = _category
    );
$$;

revoke all on function public.kit_request_matches_area_category(uuid, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Card payload: catalog id is master or sap.id
-- ---------------------------------------------------------------------------

create or replace function public.kit_request_card_payload(
  _kit public.kit_shares,
  _product public.products,
  _uid uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _allocated integer;
  _creator_qty integer;
  _my_qty integer := 0;
  _creator_username text;
  _unit numeric;
  _my_price numeric;
begin
  _allocated := public.kit_share_allocated_total(_kit.id);

  select quantity into _creator_qty
  from public.kit_share_participants
  where kit_share_id = _kit.id and user_id = _kit.creator_user_id;

  select quantity into _my_qty
  from public.kit_share_participants
  where kit_share_id = _kit.id and user_id = _uid;

  select username into _creator_username
  from public.profiles
  where id = _kit.creator_user_id;

  _unit := public.kit_request_viewer_unit_usd(_product, _kit.kit_size_vials, _allocated, _uid);

  if coalesce(_my_qty, 0) > 0 then
    _my_price := public.kit_share_participant_price_usd(_kit.id, _uid);
  else
    _my_price := null;
  end if;

  return jsonb_build_object(
    'id', _kit.id,
    'productId', public.kit_request_catalog_id(_kit),
    'productName', _product.name,
    'productCode', _product.code,
    'variantLabel', coalesce(nullif(trim(_product.dosage_vial), ''), _product.code),
    'category', public.kit_request_shop_category(_product),
    'creatorUsername', coalesce(nullif(trim(_creator_username), ''), 'Teilnehmer'),
    'kitSizeVials', _kit.kit_size_vials,
    'allocatedTotal', _allocated,
    'remainingVials', _kit.kit_size_vials - _allocated,
    'creatorQuantity', coalesce(_creator_qty, 0),
    'myQuantity', coalesce(_my_qty, 0),
    'myUnitPriceUsd', _unit,
    'myPriceUsd', _my_price,
    'isCreator', _kit.creator_user_id = _uid,
    'isParticipant', coalesce(_my_qty, 0) > 0,
    'status', _kit.status,
    'createdAt', _kit.created_at,
    'expiresAt', _kit.expires_at,
    'completedAt', _kit.completed_at,
    'note', _kit.note
  );
end;
$$;

revoke all on function public.kit_request_card_payload(public.kit_shares, public.products, uuid) from public;

-- ---------------------------------------------------------------------------
-- create_kit_request: linked master or vendor-only sap.id
-- ---------------------------------------------------------------------------

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
  _sap public.shop_area_products;
  _username text;
  _clean_note text;
  _master_id uuid;
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

  if _product_id is null then
    raise exception 'Produkt ist in diesem Bereich nicht verfügbar.' using errcode = 'P0002';
  end if;

  select * into _sap
  from public.shop_area_products sap
  where sap.shop_area_key = _shop_area
    and sap.is_active
    and (sap.product_id = _product_id or sap.id = _product_id)
  limit 1;

  if not found then
    raise exception 'Produkt ist in diesem Bereich nicht verfügbar.' using errcode = 'P0002';
  end if;

  if nullif(btrim(coalesce(_sap.vendor_code, '')), '') is null then
    raise exception 'Produkt ist in diesem Bereich nicht verfügbar.' using errcode = 'P0002';
  end if;

  if _sap.product_id is not null then
    if not exists (select 1 from public.products p where p.id = _sap.product_id) then
      raise exception 'Produkt ist in diesem Bereich nicht verfügbar.' using errcode = 'P0002';
    end if;
    _master_id := _sap.product_id;

    insert into public.kit_shares (
      product_id,
      area_product_id,
      vendor_code,
      creator_user_id,
      kit_size_vials,
      status,
      is_open_request,
      note,
      expires_at,
      shop_area
    )
    values (
      _master_id,
      _sap.id,
      _sap.vendor_code,
      _uid,
      _kit_size_vials,
      'open',
      true,
      _clean_note,
      _expires_at,
      _shop_area
    )
    returning * into _kit;
  else
    insert into public.kit_shares (
      product_id,
      area_product_id,
      vendor_code,
      creator_user_id,
      kit_size_vials,
      status,
      is_open_request,
      note,
      expires_at,
      shop_area
    )
    values (
      null,
      _sap.id,
      _sap.vendor_code,
      _uid,
      _kit_size_vials,
      'open',
      true,
      _clean_note,
      _expires_at,
      _shop_area
    )
    returning * into _kit;
  end if;

  insert into public.kit_share_participants (kit_share_id, user_id, quantity)
  values (_kit.id, _uid, _my_quantity);

  _product := public.kit_share_catalog_product(_kit);
  if _product.id is null then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  perform public.log_audit(
    _uid,
    'kit_request_created',
    'kit_share',
    _kit.id,
    null,
    jsonb_build_object(
      'productId', public.kit_request_catalog_id(_kit),
      'vendorCode', _kit.vendor_code,
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

-- ---------------------------------------------------------------------------
-- List / mine / joined use kit_share_catalog_product
-- ---------------------------------------------------------------------------

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
  cross join lateral public.kit_share_catalog_product(k) p
  left join (
    select kit_share_id, sum(quantity)::integer as allocated
    from public.kit_share_participants
    group by kit_share_id
  ) a on a.kit_share_id = k.id
  where k.is_open_request
    and k.status = 'open'
    and k.shop_area = _area
    and p.is_active
    and (
      public.product_visible_in_shop_area(public.kit_request_catalog_id(k), _area)
      or exists (
        select 1
        from public.shop_area_products sap
        where sap.shop_area_key = k.shop_area
          and sap.is_active
          and sap.vendor_code = upper(btrim(coalesce(k.vendor_code, '')))
      )
    )
    and (
      _product_id is null
      or k.product_id = _product_id
      or k.area_product_id = _product_id
      or exists (
        select 1
        from public.shop_area_products sap
        where sap.shop_area_key = k.shop_area
          and sap.is_active
          and sap.id = _product_id
          and sap.vendor_code = upper(btrim(coalesce(k.vendor_code, '')))
      )
    )
    and (_product_name is null or lower(p.name) = lower(_product_name))
    and public.kit_request_matches_area_category(public.kit_request_catalog_id(k), _area, _category)
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
    cross join lateral public.kit_share_catalog_product(k) p
    left join (
      select kit_share_id, sum(quantity)::integer as allocated
      from public.kit_share_participants
      group by kit_share_id
    ) a on a.kit_share_id = k.id
    where k.is_open_request
      and k.status = 'open'
      and k.shop_area = _area
      and p.is_active
      and (
        public.product_visible_in_shop_area(public.kit_request_catalog_id(k), _area)
        or exists (
          select 1
          from public.shop_area_products sap
          where sap.shop_area_key = k.shop_area
            and sap.is_active
            and sap.vendor_code = upper(btrim(coalesce(k.vendor_code, '')))
        )
      )
      and (
        _product_id is null
        or k.product_id = _product_id
        or k.area_product_id = _product_id
        or exists (
          select 1
          from public.shop_area_products sap
          where sap.shop_area_key = k.shop_area
            and sap.is_active
            and sap.id = _product_id
            and sap.vendor_code = upper(btrim(coalesce(k.vendor_code, '')))
        )
      )
      and (_product_name is null or lower(p.name) = lower(_product_name))
      and public.kit_request_matches_area_category(public.kit_request_catalog_id(k), _area, _category)
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

revoke all on function public.list_open_kit_requests(text, text, uuid, text, text, integer, text, integer, integer, text)
  from public;
grant execute on function public.list_open_kit_requests(text, text, uuid, text, text, integer, text, integer, integer, text)
  to authenticated;

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
  cross join lateral public.kit_share_catalog_product(k) p
  where k.is_open_request
    and k.creator_user_id = _uid
    and (_area is null or k.shop_area = _area);

  return jsonb_build_object('items', coalesce(_items, '[]'::jsonb));
end;
$$;

revoke all on function public.list_my_kit_requests(text) from public;
grant execute on function public.list_my_kit_requests(text) to authenticated;

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
  cross join lateral public.kit_share_catalog_product(k) p
  where k.is_open_request
    and part.user_id = _uid
    and k.creator_user_id <> _uid
    and (_area is null or k.shop_area = _area);

  return jsonb_build_object('items', coalesce(_items, '[]'::jsonb));
end;
$$;

revoke all on function public.list_my_kit_request_participations(text) from public;
grant execute on function public.list_my_kit_request_participations(text) to authenticated;


-- ---------------------------------------------------------------------------
-- join / preview / cart sync / checkout use catalog product helper
-- ---------------------------------------------------------------------------

create or replace function public.join_kit_request(
  _kit_share_id uuid,
  _quantity integer
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
  _allocated integer;
  _remaining integer;
  _cart_synced boolean := false;
  _username text;
begin
  if _uid is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select username into _username from public.profiles where id = _uid;
  if _username is null or trim(_username) = '' then
    raise exception 'Bitte setze zuerst einen Benutzernamen.' using errcode = 'P0001';
  end if;

  if _quantity is null or _quantity < 1 then
    raise exception 'Ungültige Menge.' using errcode = '22023';
  end if;

  select * into _kit
  from public.kit_shares
  where id = _kit_share_id
  for update;

  if not found then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if not coalesce(_kit.is_open_request, false) then
    raise exception 'Kit-Gesuch wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _kit.expires_at is not null and _kit.expires_at <= now() then
    update public.kit_shares
    set status = 'expired', updated_at = now()
    where id = _kit.id and status = 'open';
    raise exception 'Dieses Kit-Gesuch ist abgelaufen.' using errcode = 'P0001';
  end if;

  if _kit.status = 'full' then
    raise exception 'Dieses Kit ist bereits vollständig.' using errcode = 'P0001';
  end if;

  if _kit.status = 'cancelled' then
    raise exception 'Dieses Kit-Gesuch wurde storniert.' using errcode = 'P0001';
  end if;

  if _kit.status = 'expired' then
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

  _product := public.kit_share_catalog_product(_kit);
  if _product.id is null or not _product.is_active then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  _allocated := public.kit_share_allocated_total(_kit_share_id);
  _remaining := _kit.kit_size_vials - _allocated;

  if _quantity > _remaining then
    raise exception 'Nicht genügend Vials verfügbar.' using errcode = 'P0001';
  end if;

  perform set_config('peptix.allow_kit_request_join', '1', true);

  begin
    insert into public.kit_share_participants (kit_share_id, user_id, quantity)
    values (_kit_share_id, _uid, _quantity);
  exception
    when unique_violation then
      raise exception 'Du bist bereits Teilnehmer dieses Kits.' using errcode = 'P0001';
  end;

  _allocated := public.kit_share_allocated_total(_kit_share_id);

  if _allocated = _kit.kit_size_vials then
    _product := public.kit_share_catalog_product(_kit);
    if _product.id is null or not _product.is_active then
      raise exception 'Produkt ist nicht mehr verfügbar. Das Kit kann nicht abgeschlossen werden.' using errcode = 'P0001';
    end if;

    _kit := public.kit_share_refresh_status_locked(_kit_share_id);
    perform public.kit_share_sync_all_participant_carts(_kit_share_id);

    update public.kit_shares
    set completed_at = coalesce(completed_at, now()), updated_at = now()
    where id = _kit_share_id
    returning * into _kit;

    _cart_synced := true;

    perform public.log_audit(
      _uid,
      'kit_request_completed',
      'kit_share',
      _kit.id,
      null,
      jsonb_build_object('allocatedTotal', _allocated)
    );
  else
    _kit := public.kit_share_refresh_status_locked(_kit_share_id);
  end if;

  perform public.log_audit(
    _uid,
    'kit_request_joined',
    'kit_share',
    _kit.id,
    null,
    jsonb_build_object('myQuantity', _quantity, 'status', _kit.status)
  );

  return jsonb_build_object(
    'success', true,
    'kitRequestId', _kit.id,
    'myQuantity', _quantity,
    'remainingQuantity', _kit.kit_size_vials - _allocated,
    'status', _kit.status,
    'myPriceUsd', public.kit_share_participant_price_usd(_kit.id, _uid),
    'myUnitPriceUsd', public.kit_request_viewer_unit_usd(_product, _kit.kit_size_vials, _allocated, _uid),
    'cartSynced', _cart_synced
  );
end;
$$;

revoke all on function public.join_kit_request(uuid, integer) from public;
grant execute on function public.join_kit_request(uuid, integer) to authenticated;


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

  _product := public.kit_share_catalog_product(_kit);
  if _product.id is null or not _product.is_active then
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

  _product := public.kit_share_catalog_product(_kit);
  if _product.id is null or not _product.is_active then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.products p where p.id = _product.id) then
    _product := public.apply_shop_area_product_overrides(_product, _kit.shop_area);
  end if;
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
    and (
      (exists (select 1 from public.products p where p.id = _product.id) and ci.product_id = _product.id)
      or (
        not exists (select 1 from public.products p where p.id = _product.id)
        and ci.vendor_code = _product.code
      )
    )
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
    cart_id, position, product_id, vendor_code, product_code_input, product_code_snapshot, product_name_snapshot,
    quantity, unit_price_usd_snapshot, normal_price_usd_snapshot, bulk_price_usd_snapshot,
    bulk_price_min_quantity_snapshot, applied_price_tier, exchange_rate_snapshot, eur_value_snapshot,
    price_snapshot_at, resolution_status, note, kit_share_id, shop_area
  )
  values (
    _cart_id, _position,
    case when exists (select 1 from public.products p where p.id = _product.id) then _product.id else null end,
    _product.code, _product.code, _product.code, _product.name,
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
    _kit_share_id,
    _kit.shop_area
  )
  returning id into _item_id;

  return _item_id;
end;
$$;


-- Checkout: patch create_one_area_order only. Do not replace the One Cart
-- create_order wrapper. Pricing, payment, shipping, and multi-area split stay.

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
      _master_id := _kit.product_id;
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

revoke all on function public.create_one_area_order(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
