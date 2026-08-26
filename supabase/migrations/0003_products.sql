-- 0003_products.sql
-- Central product catalog + price history, admin-writable only.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null check (char_length(trim(name)) >= 1),
  description text,
  category text,
  price_usd numeric(12, 4) not null check (price_usd >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  is_active boolean not null default true,
  last_price_change_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.products is 'Central product catalog. code is normalized (trim+upper) by trigger.';
comment on column public.products.currency is
  'Reserved for future multi-currency support (assumption A1 in docs/KONZEPT.md); currently USD only.';

-- Normalize code on write, validate, and log price changes.
create or replace function public.products_before_write()
returns trigger
language plpgsql
as $$
begin
  new.code := upper(trim(new.code));
  if new.code = '' then
    raise exception 'Artikelcode darf nicht leer sein.' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.last_price_change_at := now();
  elsif tg_op = 'UPDATE' and new.price_usd is distinct from old.price_usd then
    new.last_price_change_at := now();
  end if;

  return new;
end;
$$;

create trigger products_before_write
  before insert or update on public.products
  for each row execute function public.products_before_write();

create or replace function public.products_log_price_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.product_price_history (product_id, old_price_usd, new_price_usd, changed_by)
    values (new.id, null, new.price_usd, auth.uid());
  elsif tg_op = 'UPDATE' and new.price_usd is distinct from old.price_usd then
    insert into public.product_price_history (product_id, old_price_usd, new_price_usd, changed_by)
    values (new.id, old.price_usd, new.price_usd, auth.uid());
  end if;
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Normalized-code uniqueness (case-insensitive, trim-insensitive is already
-- guaranteed because the trigger above normalizes before this index sees it).
create unique index products_code_key on public.products (code);
create index products_is_active_idx on public.products (is_active);
create index products_category_idx on public.products (category);

alter table public.products enable row level security;

create policy "products_select_active_for_users"
  on public.products for select
  using (is_active = true or public.has_role(auth.uid(), 'admin'));

create policy "products_write_admin"
  on public.products for insert
  with check (public.has_role(auth.uid(), 'admin'));

create policy "products_update_admin"
  on public.products for update
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "products_delete_admin"
  on public.products for delete
  using (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------

create table public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  old_price_usd numeric(12, 4),
  new_price_usd numeric(12, 4) not null,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index product_price_history_product_idx
  on public.product_price_history (product_id, changed_at desc);

alter table public.product_price_history enable row level security;

create policy "product_price_history_select_admin"
  on public.product_price_history for select
  using (public.has_role(auth.uid(), 'admin'));

-- Attach the price-history trigger now that the table exists.
create trigger products_log_price_history
  after insert or update on public.products
  for each row execute function public.products_log_price_history();

-- Note: public.product_is_referenced(uuid) is defined in
-- 0004_carts_and_items.sql once public.cart_items exists. The admin UI uses
-- it to explain *why* a hard delete is blocked (it prefers "deactivate").
