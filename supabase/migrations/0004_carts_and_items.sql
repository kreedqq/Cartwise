-- 0004_carts_and_items.sql
-- Carts and their line items. Strictly owner-scoped via RLS.

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  status text not null default 'draft' check (status in ('draft', 'ready', 'ordered', 'archived')),
  note text,
  is_active_cart boolean not null default false,
  deleted_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.carts is 'One row per shopping cart / order list. Soft-deleted via deleted_at.';
comment on column public.carts.is_active_cart is
  'At most one TRUE per user (see carts_one_active_per_user_idx). Marks the cart highlighted as "active" in the UI.';
comment on column public.carts.version is 'Optimistic locking: UPDATE ... WHERE version = :expected.';

create trigger carts_set_updated_at
  before update on public.carts
  for each row execute function public.set_updated_at();

-- Exactly one active, non-deleted cart per user.
create unique index carts_one_active_per_user_idx
  on public.carts (user_id)
  where is_active_cart and deleted_at is null;

create index carts_user_idx on public.carts (user_id, deleted_at);

alter table public.carts enable row level security;

create policy "carts_select_own_or_admin"
  on public.carts for select
  using (
    (user_id = auth.uid() and deleted_at is null)
    or public.has_role(auth.uid(), 'admin')
  );

create policy "carts_insert_own"
  on public.carts for insert
  with check (user_id = auth.uid());

create policy "carts_update_own"
  on public.carts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "carts_delete_own"
  on public.carts for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  position integer not null default 0,
  product_id uuid references public.products (id) on delete set null,
  product_code_input text not null,
  product_code_snapshot text,
  product_name_snapshot text,
  quantity numeric(12, 3) not null check (quantity > 0 and quantity <= 100000),
  unit_price_usd_snapshot numeric(12, 4),
  exchange_rate_snapshot numeric(12, 6),
  eur_value_snapshot numeric(12, 2),
  price_snapshot_at timestamptz,
  resolution_status text not null default 'pending'
    check (resolution_status in ('resolved', 'not_found', 'inactive', 'pending')),
  note text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cart_items is
  'Line items of a cart. Carries a full price snapshot so historical totals never silently change (see docs/KONZEPT.md §5).';

create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

-- Keep carts.updated_at in sync so "last modified" reflects item edits too.
create or replace function public.bump_cart_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.carts
  set updated_at = now()
  where id = coalesce(new.cart_id, old.cart_id);
  return coalesce(new, old);
end;
$$;

create trigger cart_items_bump_cart
  after insert or update or delete on public.cart_items
  for each row execute function public.bump_cart_updated_at();

create index cart_items_cart_idx on public.cart_items (cart_id, position);
create index cart_items_product_idx on public.cart_items (product_id);

alter table public.cart_items enable row level security;

create policy "cart_items_select_own_or_admin"
  on public.cart_items for select
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = auth.uid()
    )
    or public.has_role(auth.uid(), 'admin')
  );

create policy "cart_items_insert_own"
  on public.cart_items for insert
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = auth.uid()
    )
  );

create policy "cart_items_update_own"
  on public.cart_items for update
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = auth.uid()
    )
  );

create policy "cart_items_delete_own"
  on public.cart_items for delete
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = auth.uid()
    )
  );

-- Now that cart_items exists, provide the "is this product referenced"
-- helper used by the admin product screen before allowing a hard delete.
create or replace function public.product_is_referenced(_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.cart_items where product_id = _product_id);
$$;

comment on function public.product_is_referenced(uuid) is
  'Used by the admin UI to block hard-deleting a product still used in any cart (deactivate instead).';
