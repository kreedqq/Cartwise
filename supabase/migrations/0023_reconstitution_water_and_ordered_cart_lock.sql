-- 0023_reconstitution_water_and_ordered_cart_lock.sql
-- 1) Move BAC Water / AA Water into RECONSTITUTION-WATER without touching prices.
-- 2) Lock customer writes on carts that have already been submitted as an order.
-- list_shop_products (0021) is not redefined here.

update public.products
set category = 'RECONSTITUTION-WATER'
where is_active
  and (
    lower(btrim(name)) in ('bac water', 'aa water')
    or upper(btrim(code)) in ('AA10', 'BA03', 'BA10')
  );

update public.carts
set is_active_cart = false
where status = 'ordered' and is_active_cart = true;

drop policy if exists "carts_update_own" on public.carts;
create policy "carts_update_own"
  on public.carts for update
  using (
    (user_id = auth.uid() and status <> 'ordered')
    or public.has_role(auth.uid(), 'admin')
  )
  with check (
    (user_id = auth.uid() and status <> 'ordered')
    or public.has_role(auth.uid(), 'admin')
  );

drop policy if exists "carts_delete_own" on public.carts;
create policy "carts_delete_own"
  on public.carts for delete
  using (
    (user_id = auth.uid() and status <> 'ordered')
    or public.has_role(auth.uid(), 'admin')
  );

create or replace function public.set_active_cart(_cart_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.carts
    where id = _cart_id
      and user_id = auth.uid()
      and deleted_at is null
      and status <> 'ordered'
  ) then
    raise exception 'Warenkorb wurde nicht gefunden oder ist bereits bestellt.' using errcode = 'P0002';
  end if;

  update public.carts
  set is_active_cart = false
  where user_id = auth.uid() and is_active_cart = true and id <> _cart_id and status <> 'ordered';

  update public.carts
  set is_active_cart = true
  where id = _cart_id and status <> 'ordered';
end;
$$;
