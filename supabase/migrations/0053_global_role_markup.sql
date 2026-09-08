-- 0053_global_role_markup.sql
-- Replaces markup_percent_for_area with a simple global role lookup.
-- The shop_area_product_role_markups table (from 0052) is retained but no longer used
-- by the pricing pipeline. It may be used in future features.
-- No destructive changes.

-- Replace the area+product+role markup function with global role markup only.
create or replace function public.markup_percent_for_area(
  _user_id uuid,
  _area_key text,
  _product_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.markup_percent_for(_user_id);
$$;

revoke all on function public.markup_percent_for_area(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.markup_percent_for_area(uuid, text, uuid) to authenticated;
