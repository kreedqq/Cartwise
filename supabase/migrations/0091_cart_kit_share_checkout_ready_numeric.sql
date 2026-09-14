-- 0091_cart_kit_share_checkout_ready_numeric.sql
-- Fix 0088 helper signature: cart_items.quantity is numeric(12,3), so calls
-- cart_kit_share_is_checkout_ready(..., ci.quantity) fail with 42883 when the
-- helper only accepts integer. Align parameter type to numeric.
-- Idempotent. Does not change checkout skip semantics.

drop function if exists public.cart_kit_share_is_checkout_ready(uuid, uuid, integer);
drop function if exists public.cart_kit_share_is_checkout_ready(uuid, uuid, numeric);

create function public.cart_kit_share_is_checkout_ready(
  _kit_share_id uuid,
  _user_id uuid,
  _quantity numeric
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.kit_shares ks
    join public.kit_share_participants ksp
      on ksp.kit_share_id = ks.id
     and ksp.user_id = _user_id
    where ks.id = _kit_share_id
      and ks.status in ('full', 'ordered')
      and ksp.quantity = _quantity
      and ksp.ordered_at is null
  );
$$;

revoke all on function public.cart_kit_share_is_checkout_ready(uuid, uuid, numeric)
  from public, anon, authenticated;
