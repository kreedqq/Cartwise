-- 0118_fix_admin_delete_carts_ordered.sql
-- Allow admin bulk delete for carts that still have leftover open lines after checkout
-- (status = ordered). Submitted cart_items and orders stay untouched.

create or replace function public.admin_delete_carts(_cart_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _admin uuid;
  _unique uuid[];
  _found integer;
  _cart public.carts;
  _id uuid;
  _deleted integer := 0;
  _open_items_before jsonb := '[]'::jsonb;
begin
  _admin := public.assert_admin_authenticated();

  if _cart_ids is null or coalesce(array_length(_cart_ids, 1), 0) = 0 then
    raise exception 'Keine Warenkörbe ausgewählt.' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(distinct cid order by cid), '{}'::uuid[])
  into _unique
  from unnest(_cart_ids) as cid;

  select count(*)::integer into _found
  from public.carts c
  where c.id = any(_unique);

  if _found <> coalesce(array_length(_unique, 1), 0) then
    raise exception 'Ein oder mehrere Warenkörbe wurden nicht gefunden.' using errcode = 'P0002';
  end if;

  foreach _id in array _unique loop
    select * into _cart from public.carts where id = _id for update;
    if _cart.deleted_at is not null then
      raise exception 'Warenkorb ist bereits gelöscht.' using errcode = 'P0001';
    end if;
    if not exists (
      select 1
      from public.cart_items ci
      where ci.cart_id = _cart.id
        and ci.submitted_order_id is null
        and ci.quantity > 0
    ) then
      raise exception 'Warenkorb hat keine offenen Positionen.' using errcode = 'P0001';
    end if;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(ci)), '[]'::jsonb)
  into _open_items_before
  from public.cart_items ci
  where ci.cart_id = any(_unique)
    and ci.submitted_order_id is null;

  perform set_config('kit.skip_customer_lock', 'on', true);
  perform set_config('kit.skip_cart_removal_tracking', 'on', true);

  delete from public.cart_items ci
  where ci.cart_id = any(_unique)
    and ci.submitted_order_id is null;

  perform set_config('kit.skip_customer_lock', '', true);
  perform set_config('kit.skip_cart_removal_tracking', '', true);

  update public.carts c
  set deleted_at = now(),
      is_active_cart = false,
      status = 'archived',
      updated_at = now(),
      version = c.version + 1
  where c.id = any(_unique)
    and c.deleted_at is null;

  get diagnostics _deleted = row_count;

  if _deleted <> coalesce(array_length(_unique, 1), 0) then
    raise exception 'Warenkörbe konnten nicht vollständig gelöscht werden.' using errcode = 'P0001';
  end if;

  perform public.log_audit(
    _admin,
    'admin.carts.bulk_delete',
    'cart',
    null,
    jsonb_build_object('cartIds', _unique, 'openItems', _open_items_before),
    jsonb_build_object('deletedCount', _deleted, 'cartIds', _unique)
  );

  return jsonb_build_object('deletedCount', _deleted, 'cartIds', to_jsonb(_unique));
end;
$$;

revoke all on function public.admin_delete_carts(uuid[]) from public, anon;
grant execute on function public.admin_delete_carts(uuid[]) to authenticated;
