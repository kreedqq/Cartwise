-- 0064_order_groups.sql
-- Persistent admin order groups. Membership is 1:1 (an order is in at most one group).
-- Does not change orders, order_items, prices, role snapshots, or kit logic.

create table if not exists public.order_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  note        text,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null,
  constraint order_groups_name_len check (char_length(btrim(name)) between 1 and 160),
  constraint order_groups_note_len check (note is null or char_length(note) <= 2000)
);

comment on table public.order_groups is
  'Admin-created persistent order batches. Independent of orders.status.';

create table if not exists public.order_group_orders (
  group_id uuid not null references public.order_groups (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid references auth.users (id) on delete set null,
  primary key (group_id, order_id),
  constraint order_group_orders_order_unique unique (order_id)
);

comment on table public.order_group_orders is
  'Order-to-group membership. UNIQUE(order_id) enforces at most one group per order.';

create index if not exists order_groups_created_at_idx
  on public.order_groups (created_at desc);

create index if not exists order_group_orders_group_idx
  on public.order_group_orders (group_id);

alter table public.order_groups enable row level security;
alter table public.order_group_orders enable row level security;

drop policy if exists order_groups_admin_select on public.order_groups;
create policy order_groups_admin_select
  on public.order_groups for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists order_groups_admin_insert on public.order_groups;
create policy order_groups_admin_insert
  on public.order_groups for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists order_groups_admin_update on public.order_groups;
create policy order_groups_admin_update
  on public.order_groups for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists order_groups_admin_delete on public.order_groups;
create policy order_groups_admin_delete
  on public.order_groups for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists order_group_orders_admin_select on public.order_group_orders;
create policy order_group_orders_admin_select
  on public.order_group_orders for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists order_group_orders_admin_insert on public.order_group_orders;
create policy order_group_orders_admin_insert
  on public.order_group_orders for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists order_group_orders_admin_update on public.order_group_orders;
create policy order_group_orders_admin_update
  on public.order_group_orders for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists order_group_orders_admin_delete on public.order_group_orders;
create policy order_group_orders_admin_delete
  on public.order_group_orders for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.order_groups to authenticated;
grant select, insert, update, delete on public.order_group_orders to authenticated;
grant select, insert, update, delete on public.order_groups to service_role;
grant select, insert, update, delete on public.order_group_orders to service_role;

drop trigger if exists order_groups_set_updated_at on public.order_groups;
create trigger order_groups_set_updated_at
  before update on public.order_groups
  for each row execute function public.set_updated_at();

create or replace function public.order_groups_set_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  new.name := btrim(new.name);
  return new;
end;
$$;

revoke all on function public.order_groups_set_created_by() from public, anon, authenticated;
grant execute on function public.order_groups_set_created_by() to authenticated, service_role;

drop trigger if exists order_groups_set_created_by on public.order_groups;
create trigger order_groups_set_created_by
  before insert on public.order_groups
  for each row execute function public.order_groups_set_created_by();

create or replace function public.order_group_orders_set_added_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.added_by is null then
    new.added_by := auth.uid();
  end if;
  return new;
end;
$$;

revoke all on function public.order_group_orders_set_added_by() from public, anon, authenticated;
grant execute on function public.order_group_orders_set_added_by() to authenticated, service_role;

drop trigger if exists order_group_orders_set_added_by on public.order_group_orders;
create trigger order_group_orders_set_added_by
  before insert on public.order_group_orders
  for each row execute function public.order_group_orders_set_added_by();
