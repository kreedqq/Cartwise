-- 0013_cart_summary_view.sql
-- Aggregated per-cart totals for the dashboard list, so the UI doesn't need
-- to fetch every cart's full item list just to show a total. security_invoker
-- means the view runs with the querying user's own permissions, so the
-- existing RLS policies on carts/cart_items apply exactly as normal - this
-- view grants no additional access.

create view public.cart_summaries
with (security_invoker = true)
as
select
  c.id as cart_id,
  count(ci.id) as item_count,
  coalesce(sum(ci.quantity), 0) as total_quantity,
  coalesce(sum(round(ci.quantity * ci.unit_price_usd_snapshot, 2)), 0) as total_usd,
  case
    when count(ci.id) filter (where ci.unit_price_usd_snapshot is not null) = 0 then null
    when count(ci.id) filter (where ci.eur_value_snapshot is null and ci.unit_price_usd_snapshot is not null) > 0 then null
    else coalesce(sum(ci.eur_value_snapshot), 0)
  end as total_eur,
  count(ci.id) filter (where ci.resolution_status = 'not_found') as unresolved_count,
  count(ci.id) filter (where ci.unit_price_usd_snapshot is null) as missing_price_count,
  max(ci.price_snapshot_at) as latest_price_snapshot_at
from public.carts c
left join public.cart_items ci on ci.cart_id = c.id
group by c.id;

comment on view public.cart_summaries is
  'Read-only per-cart aggregate totals for dashboard cards. RLS-transparent via security_invoker.';

grant select on public.cart_summaries to authenticated;
