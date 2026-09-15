-- Read-only: legacy orders with zero submitted_order_id links (2026 fleet).
-- Classify in app via orderIntegrityClassification.ts — do not auto-update.

-- 12 legacy orders (production snapshot 2026-09-15):
-- All: lines_linked = 0, order_item_count > 0 → VALID_LEGACY_STATE (pre backfill / pre one-cart linking).
-- Exception note: CW-2026-000048 already owned by rime41; transfer not required.

with o2026 as (
  select o.id, o.order_number, o.cart_id, o.user_id, o.submitted_at, o.total_eur, o.shop_area
  from public.orders o
  where o.submitted_at >= '2026-01-01'
),
cart_at_order as (
  select o.id as order_id, o.order_number, o.user_id, o.cart_id, o.submitted_at, o.total_eur, o.shop_area,
    count(ci.id) filter (where ci.submitted_order_id = o.id) as lines_linked,
    count(ci.id) filter (where ci.submitted_order_id is null) as lines_unlinked,
    count(oi.id) as order_item_count
  from o2026 o
  left join public.cart_items ci on ci.cart_id = o.cart_id
  left join public.order_items oi on oi.order_id = o.id
  group by o.id, o.order_number, o.user_id, o.cart_id, o.submitted_at, o.total_eur, o.shop_area
)
select c.order_number, pr.username, c.submitted_at::date, c.shop_area,
  c.order_item_count, c.lines_linked, c.lines_unlinked
from cart_at_order c
left join public.profiles pr on pr.id = c.user_id
where c.lines_linked = 0 and c.order_item_count > 0
order by c.submitted_at;

-- Seven kit cart lines: participant ordered_at set, submitted_order_id null
-- PROVABLE_MISSING_LINK (4): larpcomgirll x2, Penbuddy x2 — participant.order_id matches order
-- AMBIGUOUS (2): peptixx — ordered_at but participant.order_id null
-- UNKNOWN (1): larpcomgirll SK5 full kit — ordered_at, no order_id on participant

select pr.username, o.order_number, ci.id as cart_item_id,
  ci.product_code_snapshot, ci.kit_share_id,
  ksp.order_id as participant_order_id, ksp.ordered_at,
  ci.submitted_order_id
from public.cart_items ci
join public.kit_share_participants ksp on ksp.kit_share_id = ci.kit_share_id
join public.carts c on c.id = ci.cart_id and c.user_id = ksp.user_id
left join public.profiles pr on pr.id = ksp.user_id
left join public.orders o on o.id = ksp.order_id
where ci.submitted_order_id is null
  and ksp.ordered_at is not null
  and ci.quantity = ksp.quantity
order by ksp.ordered_at;
