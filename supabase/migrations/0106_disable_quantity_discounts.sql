-- 0106: Live Mengenpreise / quantity discounts off (historical order snapshots unchanged).

update public.app_settings
set value_bool = false,
    updated_at = now()
where key = 'quantity_discounts_enabled';

create or replace function public.quantity_discounts_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select false;
$$;

revoke all on function public.quantity_discounts_enabled() from public, anon, authenticated;
grant execute on function public.quantity_discounts_enabled() to authenticated;
