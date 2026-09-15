-- Read-only order integrity audit (run against linked DB only with explicit approval).
-- Does NOT mutate data. Classifies post-checkout cart vs order lines.

-- Single order deep dive (replace order_number):
-- CW-2026-000063 / HeyAnna5 example documented in docs/audit reports.

select o.order_number, o.total_eur, o.submitted_at, p.username
from public.orders o
left join public.profiles p on p.id = o.user_id
where o.order_number = 'CW-2026-000063';

select position, product_code_snapshot, quantity, line_total_usd,
       kit_share_id_snapshot, kit_participant_quantity_snapshot
from public.order_items
where order_id = (select id from public.orders where order_number = 'CW-2026-000063')
order by position;

select ci.position, ci.product_code_snapshot, ci.quantity, ci.eur_value_snapshot,
       ci.kit_share_id, ci.submitted_order_id is not null as ordered,
       ks.status as kit_status,
       public.kit_share_allocated_total(ci.kit_share_id) as kit_allocated,
       ks.kit_size_vials
from public.cart_items ci
left join public.kit_shares ks on ks.id = ci.kit_share_id
where ci.cart_id = (select cart_id from public.orders where order_number = 'CW-2026-000063')
order by ci.position;

-- Fleet summary (2026+):
with o2026 as (
  select o.id, o.order_number, o.cart_id, o.total_eur
  from public.orders o
  where o.submitted_at >= '2026-01-01'
),
cart_at_order as (
  select o.id as order_id,
    count(ci.id) filter (where ci.submitted_order_id = o.id) as lines_linked,
    count(ci.id) filter (where ci.submitted_order_id is null and ci.kit_share_id is not null) as kit_remaining,
    count(ci.id) filter (where ci.submitted_order_id is null and ci.kit_share_id is null) as nonkit_remaining
  from o2026 o
  left join public.cart_items ci on ci.cart_id = o.cart_id
  group by o.id
)
select
  count(*) as orders_audited,
  count(*) filter (where kit_remaining > 0) as orders_with_remaining_kit_cart_lines,
  count(*) filter (where kit_remaining > 0 and nonkit_remaining = 0) as incomplete_or_skipped_kit_only,
  count(*) filter (where lines_linked = 0) as suspicious_zero_linked_lines
from cart_at_order;

-- Full kit ordered but cart line lacks submitted_order_id (investigate, do not auto-fix):
select pr.username, o.order_number, ci.product_code_snapshot, ci.kit_share_id,
       ksp.ordered_at, ci.submitted_order_id
from public.cart_items ci
join public.kit_share_participants ksp on ksp.kit_share_id = ci.kit_share_id
join public.carts c on c.id = ci.cart_id and c.user_id = ksp.user_id
join public.kit_shares ks on ks.id = ci.kit_share_id and ks.status in ('full', 'ordered')
left join public.profiles pr on pr.id = ksp.user_id
left join public.orders o on o.id = ksp.order_id
where ci.submitted_order_id is null
  and ksp.ordered_at is not null
  and ci.quantity = ksp.quantity;
