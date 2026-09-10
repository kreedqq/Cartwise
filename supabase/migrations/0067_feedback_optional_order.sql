-- 0067_feedback_optional_order.sql
-- Additive: customers may submit general feedback without an order.
-- One review per concrete order remains. Multiple NULL order_id rows are allowed.
-- Does not rewrite orders, order_items, prices, existing feedback, or moderation rows.

alter table public.order_feedback
  alter column order_id drop not null;

alter table public.order_feedback
  drop constraint if exists order_feedback_order_unique;

create unique index if not exists order_feedback_order_unique
  on public.order_feedback (order_id)
  where order_id is not null;

comment on table public.order_feedback is
  'Optional order link. One review per order when order_id is set. Public feed shows approved rows only.';

drop policy if exists order_feedback_insert_own on public.order_feedback;
create policy order_feedback_insert_own
  on public.order_feedback for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      order_id is null
      or exists (
        select 1
        from public.orders o
        where o.id = order_id
          and o.user_id = auth.uid()
      )
    )
  );
