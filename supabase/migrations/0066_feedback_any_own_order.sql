-- 0066_feedback_any_own_order.sql
-- Additive: customers may review any of their own orders, regardless of status.
-- Does not rewrite orders, order_items, prices, existing feedback, or moderation rows.

drop policy if exists order_feedback_insert_own on public.order_feedback;
create policy order_feedback_insert_own
  on public.order_feedback for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.orders o
      where o.id = order_id
        and o.user_id = auth.uid()
    )
  );
