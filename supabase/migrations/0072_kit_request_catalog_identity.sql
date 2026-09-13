-- 0072_kit_request_catalog_identity.sql
-- create_kit_request must use a real products.id. Area catalog rows may be
-- vendor-only (product_id NULL) and list_shop_products_for_area then returns
-- shop_area_products.id. Those rows stay buyable, but they are not kit-capable
-- because kit_shares.product_id references products. Additive. No product
-- invention. No historical kit or order rewrites.

create or replace function public.resolve_kit_request_master_product_id(
  _shop_area text,
  _product_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _master_id uuid;
begin
  if _product_id is null or nullif(btrim(coalesce(_shop_area, '')), '') is null then
    return null;
  end if;

  select sap.product_id
    into _master_id
  from public.shop_area_products sap
  where sap.shop_area_key = _shop_area
    and sap.is_active
    and (
      sap.product_id = _product_id
      or sap.id = _product_id
    )
    and sap.product_id is not null
  limit 1;

  if _master_id is not null and exists (select 1 from public.products p where p.id = _master_id) then
    return _master_id;
  end if;

  return null;
end;
$$;

revoke all on function public.resolve_kit_request_master_product_id(text, uuid)
  from public, anon, authenticated;

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

  select coalesce(array_agg(distinct sap.product_id), '{}'::uuid[])
    into _ids
  from public.shop_area_products sap
  where sap.shop_area_key = _shop_area
    and sap.is_active
    and sap.product_id is not null
    and exists (select 1 from public.products p where p.id = sap.product_id);

  return _ids;
end;
$$;

revoke all on function public.list_kit_requestable_product_ids(text) from public;
grant execute on function public.list_kit_requestable_product_ids(text) to authenticated;

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

  _master_id := public.resolve_kit_request_master_product_id(_shop_area, _product_id);

  if _master_id is null then
    if exists (
      select 1
      from public.shop_area_products sap
      where sap.shop_area_key = _shop_area
        and sap.is_active
        and sap.id = _product_id
        and sap.product_id is null
    ) then
      raise exception 'Dieses Produkt kann nicht als Kit Gesuch geteilt werden.' using errcode = 'P0001';
    end if;
    raise exception 'Produkt ist in diesem Bereich nicht verfügbar.' using errcode = 'P0002';
  end if;

  select * into _product from public.products where id = _master_id;
  if not found then
    raise exception 'Produkt wurde nicht gefunden.' using errcode = 'P0002';
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
    _master_id,
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
