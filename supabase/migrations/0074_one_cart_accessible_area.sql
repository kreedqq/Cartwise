-- 0074: One Cart create for area-restricted users
-- Problem found during AD10 vendor-only kit cart sync QA:
-- get_or_create_user_cart_for always inserted shop_area='shop'.
-- Group-buy-only users (no retail access, no existing cart) failed kit completion
-- cart sync with "Kein Zugriff auf diesen Shop-Bereich."
--
-- Fix:
-- 1) Pick a shop_area the cart owner can actually access (prefer 'shop').
-- 2) On INSERT, validate access for NEW.user_id (cart owner), not auth.uid(),
--    so SECURITY DEFINER kit cart sync can create carts for participants.
-- UPDATE still freezes shop_area (immutable after create).
-- Does not change One Cart identity, pricing, or order engines.

create or replace function public.reject_cart_shop_area_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.shop_area is null
       or NEW.user_id is null
       or not public.user_can_access_shop_area(NEW.user_id, NEW.shop_area) then
      raise exception 'Kein Zugriff auf diesen Shop-Bereich.' using errcode = '42501';
    end if;
    return NEW;
  end if;

  if NEW.shop_area is distinct from OLD.shop_area then
    raise exception 'Der Shop-Bereich eines Warenkorbs kann nicht geändert werden.' using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

revoke all on function public.reject_cart_shop_area_mutation() from public, anon, authenticated;

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

  -- Prefer retail 'shop' when the owner can access it; otherwise first accessible area.
  select coalesce(
    (
      select sa.key
      from public.shop_areas sa
      where sa.key = 'shop'
        and public.user_can_access_shop_area(_user_id, sa.key)
      limit 1
    ),
    (
      select sa.key
      from public.shop_areas sa
      where public.user_can_access_shop_area(_user_id, sa.key)
      order by sa.sort_order, sa.key
      limit 1
    )
  )
  into _legacy_area;

  if _legacy_area is null then
    raise exception 'Kein Zugriff auf diesen Shop-Bereich.' using errcode = '42501';
  end if;

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
